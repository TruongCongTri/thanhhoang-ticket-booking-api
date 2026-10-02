export const TENANT_HEADER = 'x-tenant-id';

// Biến phiên RLS trong PostgreSQL Engine (truy xuất qua current_setting)
export const RLS_CURRENT_TENANT_VAR = 'app.current_tenant_id';
export const RLS_BYPASS_VAR = 'app.bypass_rls';

/** UUID bất kỳ phiên bản (v1-v8, bao gồm v7 time-ordered) theo RFC 9562 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
