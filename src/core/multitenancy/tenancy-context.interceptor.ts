/**
 * Xác định tenant hiệu lực của request SAU khi Auth Guard đã chạy
 * (middleware chạy trước Guard nên không thể so khớp với JWT),
 * ngăn chặn tấn công giả mạo Tenant (Tenant Spoofing):
 *  - Header x-tenant-id phải là UUID hợp lệ.
 *  - User đã đăng nhập: header phải trùng tenant trong token, trừ SUPER_ADMIN/SYSTEM (được chuyển tenant).
 *  - Request ẩn danh: header chỉ được lưu dạng "requestedTenantId" (chưa xác thực),
 *    KHÔNG BAO GIỜ được dùng làm tenant ghi dữ liệu.
 */
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';
import { syncUserFromRequest } from '../context/request-context.interceptor';
import { SUPER_ADMIN_ROLE, SYSTEM_ROLE } from '../context/request-context.model';
import { TENANT_HEADER, UUID_REGEX } from './tenancy.constants';

@Injectable()
export class TenancyContextInterceptor implements NestInterceptor {
  constructor(private readonly contextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const rawHeader = req.headers?.[TENANT_HEADER];
    const headerTenantId: string | undefined = Array.isArray(rawHeader)
      ? rawHeader[0]
      : rawHeader;

    if (headerTenantId && !UUID_REGEX.test(headerTenantId)) {
      throw new BadRequestException(`Invalid '${TENANT_HEADER}' format. Must be a valid UUID.`);
    }

    // Không phụ thuộc thứ tự đăng ký interceptor: tự đồng bộ request.user vào context
    const user = syncUserFromRequest(context, this.contextService);

    if (!user) {
      this.contextService.setRequestedTenantId(headerTenantId);
      return next.handle();
    }

    if (headerTenantId && headerTenantId !== user.tenantId) {
      const canSwitchTenant =
        user.roles.includes(SUPER_ADMIN_ROLE) || user.roles.includes(SYSTEM_ROLE);
      if (!canSwitchTenant) {
        throw new ForbiddenException(
          'Tenant access mismatch: Header does not match authenticated token.',
        );
      }
      this.contextService.setTenantOverride(headerTenantId);
    }

    return next.handle();
  }
}
