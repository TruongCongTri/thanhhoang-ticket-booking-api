/**
 * Danh sách seed theo thứ tự thực thi. Module nghiệp vụ đăng ký seed của mình tại đây, ví dụ:
 *
 *   export const systemPermissionsSeed: DatabaseSeed = {
 *     name: 'system-permissions',
 *     async run(manager) {
 *       await manager.query(
 *         `INSERT INTO permissions (code, description) VALUES ($1, $2)
 *          ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
 *         ['audit:read:global', 'Read all audit trails of the tenant'],
 *       );
 *     },
 *   };
 *
 *   export const SEEDS: DatabaseSeed[] = [systemPermissionsSeed];
 */
import type { DatabaseSeed } from './seed.interface';

export const SEEDS: DatabaseSeed[] = [];
