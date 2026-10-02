import { EffectivePermissionRule } from '../access-control/access-control.types';

export const SYSTEM_USER_ID = 'SYSTEM_INTERNAL_SERVICE';
export const SYSTEM_ROLE = 'SYSTEM';
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export interface RequestUserContext {
  id: string;
  email: string;
  tenantId?: string;
  departmentId?: string;
  roles: string[];
  // Danh sách ma trận quyền đã hợp nhất gồm cả Base Grants và Direct Overrides (Grant/Deny)
  rules: EffectivePermissionRule[];
}

export interface RequestContextData {
  traceId: string;
  clientIp: string;
  userAgent?: string;
  user?: RequestUserContext;
  startTime: number;
  isBackgroundJob?: boolean;
  /**
   * Tenant đã được xác thực khác với user.tenantId (chỉ SUPER_ADMIN/SYSTEM được phép chuyển tenant)
   */
  tenantOverride?: string;
  /**
   * Tenant client yêu cầu qua header (CHƯA XÁC THỰC) - không được dùng để ghi dữ liệu
   */
  requestedTenantId?: string;
  metadata: Map<string, unknown>;
}

/** Tham số khởi tạo context cho tác vụ nền / test */
export type ContextSeed = Partial<Omit<RequestContextData, 'metadata'>> & {
  metadata?: Map<string, unknown>;
};
