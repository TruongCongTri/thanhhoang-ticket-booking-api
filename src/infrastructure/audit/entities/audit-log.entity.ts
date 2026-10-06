/**
 * Entity bất biến (WORM - Write Once, Read Many).
 * Bảng này tuyệt đối không có cột updated_at hay deleted_at; trigger PostgreSQL (migration
 * CreateInfrastructureTables) chặn UPDATE / DELETE / TRUNCATE ở tầng database.
 *
 * */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { AuditAction, EntityDiffSnapshot } from '../interfaces/audit.interface';

export const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Entity('audit_logs')
@Index('idx_audit_logs_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_audit_logs_resource', ['resource', 'resourceId'])
@Index('idx_audit_logs_actor_created', ['actorId', 'createdAt'])
@Index('idx_audit_logs_department_created', ['departmentId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, name: 'actor_id' })
  actorId: string;

  @Column({ type: 'varchar', length: 255, name: 'actor_email', nullable: true })
  actorEmail?: string | null;

  @Column({ type: 'varchar', length: 100, name: 'department_id', nullable: true })
  departmentId?: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Column({ type: 'varchar', length: 255, name: 'resource_id' })
  resourceId: string;

  // Lưu trữ khác biệt dữ liệu (old_val vs new_val) dạng JSONB
  @Column({ type: 'jsonb', nullable: true, name: 'diff_snapshot' })
  diffSnapshot?: EntityDiffSnapshot | null;

  // Siêu dữ liệu ngữ cảnh: HTTP method/path/status/duration, lý do, kênh thao tác...
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 128, name: 'trace_id' })
  traceId: string;

  @Column({ type: 'varchar', length: 45, name: 'client_ip' })
  clientIp: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
