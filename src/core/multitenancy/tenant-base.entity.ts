import { Column, Index } from 'typeorm';
import { AbstractBaseEntity } from '../database/base.entity';

export abstract class TenantBaseEntity extends AbstractBaseEntity {
  @Index()
  @Column({
    type: 'uuid',
    name: 'tenant_id',
    nullable: false,
    update: false, // Bất biến: Không cho phép đổi tenant của một bản ghi sau khi đã tạo
  })
  tenantId: string;
}