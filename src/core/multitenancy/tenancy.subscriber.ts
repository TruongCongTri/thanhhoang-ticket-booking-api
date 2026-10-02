/**
 * TypeORM Subscriber tự động hóa ở tầng ứng dụng (lớp phòng thủ thứ nhất, RLS là lớp thứ hai):
 *  tự động gán tenantId cho các bản ghi mới
 *  và ngăn chặn ghi đè chéo dữ liệu.
 *
 * Subscriber tự đăng ký vào DataSource (autoLoadEntities không nạp subscriber,
 * và @EventSubscriber() sẽ khởi tạo class KHÔNG có dependency injection).
 */
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
} from 'typeorm';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { RequestContextService } from '../context/request-context.service';
import { TenantBaseEntity } from './tenant-base.entity';

type TenantScoped = { tenantId?: string | null };

@Injectable()
export class TenancySubscriber implements EntitySubscriberInterface {
  constructor(
    private readonly contextService: RequestContextService,
    dataSource?: DataSource,
  ) {
    if (dataSource && !dataSource.subscribers.includes(this)) {
      dataSource.subscribers.push(this);
    }
  }

  private isTenantScoped(entity: unknown): entity is TenantScoped {
    return (
      !!entity &&
      typeof entity === 'object' &&
      (entity instanceof TenantBaseEntity || 'tenantId' in entity)
    );
  }

  /**
   * Request đặc quyền (SUPER_ADMIN / SYSTEM / worker nền) được phép thao tác chéo tenant có kiểm soát
   */
  private canBypass(): boolean {
    return this.contextService.isBackgroundJob() || this.contextService.isPrivileged();
  }

  /**
   * Tự động inject tenant_id trước khi INSERT vào DB (chỉ dùng tenant ĐÃ XÁC THỰC)
   */
  beforeInsert(event: InsertEvent<any>): void {
    const entity = event.entity;
    if (!this.isTenantScoped(entity)) return;

    const activeTenantId = this.contextService.getTenantId();

    if (!entity.tenantId) {
      if (!activeTenantId) {
        throw new UnauthorizedException(
          'Tenant context is required to create tenant-scoped entities.',
        );
      }
      entity.tenantId = activeTenantId;
      return;
    }

    if (entity.tenantId !== activeTenantId && !this.canBypass()) {
      // Ngăn chặn việc gửi body cố ý gán sang tenant khác
      throw new ForbiddenException('Cross-tenant resource creation is prohibited.');
    }
  }

  /**
   * Bảo vệ trước khi UPDATE
   */
  beforeUpdate(event: UpdateEvent<any>): void {
    const entity = event.entity;
    if (!this.isTenantScoped(entity)) return;

    const persistedTenantId = (event.databaseEntity as TenantScoped | undefined)?.tenantId;

    // Ngăn chặn đổi giá trị cột tenant_id (bỏ qua partial update không mang tenantId)
    if (
      persistedTenantId &&
      entity.tenantId !== undefined &&
      entity.tenantId !== persistedTenantId
    ) {
      throw new ForbiddenException(
        'Modifying tenant_id of an existing entity is strictly forbidden.',
      );
    }

    const activeTenantId = this.contextService.getTenantId();
    if (
      persistedTenantId &&
      activeTenantId &&
      persistedTenantId !== activeTenantId &&
      !this.canBypass()
    ) {
      throw new ForbiddenException('Cannot modify entities belonging to another tenant.');
    }
  }

  /**
   * Bảo vệ trước khi DELETE (cứng hoặc mềm)
   */
  beforeRemove(event: RemoveEvent<any>): void {
    this.assertSameTenantOnDelete(event.databaseEntity ?? event.entity);
  }

  beforeSoftRemove(event: SoftRemoveEvent<any>): void {
    this.assertSameTenantOnDelete(event.databaseEntity ?? event.entity);
  }

  private assertSameTenantOnDelete(target: unknown): void {
    if (!this.isTenantScoped(target) || !target.tenantId) return;

    const activeTenantId = this.contextService.getTenantId();
    if (activeTenantId && target.tenantId !== activeTenantId && !this.canBypass()) {
      throw new ForbiddenException('Cannot delete entities belonging to another tenant.');
    }
  }
}
