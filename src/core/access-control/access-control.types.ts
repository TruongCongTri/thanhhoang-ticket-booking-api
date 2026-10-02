export enum Action {
  MANAGE = 'manage', // Toàn quyền (Create, Read, Update, Delete)
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute', // Xuất vé, thanh toán, đối soát
}

export enum Scope {
  OWN = 'own', // Thuộc sở hữu của chính user
  DEPARTMENT = 'department', // Thuộc phạm vi phòng ban/chi nhánh
  GLOBAL = 'global', // Toàn quyền trên toàn hệ thống/tenant
}

export enum PermissionEffect {
  GRANT = 'GRANT',
  DENY = 'DENY',
}

export interface EffectivePermissionRule {
  resource: string;
  action: Action;
  scope: Scope;
  effect: PermissionEffect;
  conditions?: Record<string, any>; // Phục vụ ABAC nâng cao
}

export interface ResourceEntity {
  userId?: string;
  departmentId?: string;
  tenantId?: string;
  [key: string]: any;
}
