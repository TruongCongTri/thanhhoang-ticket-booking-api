/**
 * Hệ thống sẽ crash ngay lập tức tại thời điểm bootstrap
 * nếu biến môi trường bị thiếu hoặc sai kiểu dữ liệu,
 * ngăn ngừa lỗi runtime âm thầm.
 *
 * Schema được chia theo miền (schemas/*.schema.ts) và hợp nhất tại đây.
 */
import { z } from 'zod';
import { appEnvShape, refineAppEnv } from './schemas/app.schema';
import { databaseEnvShape, refineDatabaseEnv } from './schemas/database.schema';
import { redisEnvShape, refineRedisEnv } from './schemas/redis.schema';
import { securityEnvShape, refineSecurityEnv } from './schemas/security.schema';
import { observabilityEnvShape, refineObservabilityEnv } from './schemas/observability.schema';
import { infrastructureEnvShape, refineInfrastructureEnv } from './schemas/infrastructure.schema';
import type { ZodRefineCtx } from './schemas/env.helpers';

export const envSchema = z
  .object({
    ...appEnvShape,
    ...databaseEnvShape,
    ...redisEnvShape,
    ...securityEnvShape,
    ...observabilityEnvShape,
    ...infrastructureEnvShape,
  })
  .superRefine(
    (env, ctx) => {
      const refinements = [
        refineAppEnv,
        refineDatabaseEnv,
        refineRedisEnv,
        refineSecurityEnv,
        refineObservabilityEnv,
        refineInfrastructureEnv,
      ] as Array<(env: unknown, refinementCtx: ZodRefineCtx) => void>;
      for (const refine of refinements) {
        try {
          refine(env, ctx);
        } catch {
          // Một số trường đã sai kiểu (lỗi gốc đã nằm trong bảng) → bỏ qua kiểm tra chéo phụ thuộc trường đó
        }
      }
    },
    // Luôn chạy kiểm tra chéo kể cả khi có trường sai kiểu: DevOps thấy TOÀN BỘ lỗi trong một lần boot
    { when: () => true },
  );

export type EnvConfig = z.infer<typeof envSchema>;

const SECRET_NAME_PATTERN = /PASSWORD|SECRET|KEY|TOKEN|HEADERS|SID/i;
const URL_NAME_PATTERN = /_URL$/;
const MAX_DISPLAY_LENGTH = 40;

/** Che mật khẩu trong connection string: postgresql://user:***@host:5432/db */
export function maskUrlCredentials(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return raw.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:***@');
  }
}

/**
 * Hiển thị giá trị hiện tại của biến một cách an toàn trong log của Pod:
 * biến nhạy cảm chỉ hiện độ dài, connection string bị che mật khẩu, biến thường bị cắt ngắn.
 */
export function describeEnvValue(name: string, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '<missing>';
  }
  const str = String(value);
  if (SECRET_NAME_PATTERN.test(name)) {
    return `<redacted, ${str.length} chars>`;
  }
  const display = URL_NAME_PATTERN.test(name) ? maskUrlCredentials(str) : str;
  return display.length > MAX_DISPLAY_LENGTH
    ? `"${display.slice(0, MAX_DISPLAY_LENGTH)}…"`
    : `"${display}"`;
}

/**
 * Định dạng lỗi Zod thành bảng dễ đọc trên console Kubernetes (VARIABLE | CURRENT VALUE | PROBLEM)
 */
export function formatEnvErrors(
  issues: z.core.$ZodIssue[],
  rawConfig: Record<string, unknown>,
): string {
  const rows = issues.map((issue) => {
    const name = issue.path.map(String).join('.') || '(root)';
    return [name, describeEnvValue(name, rawConfig[name]), issue.message];
  });

  const header = ['VARIABLE', 'CURRENT VALUE', 'PROBLEM'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

  return [line(header), separator, ...rows.map(line)].join('\n');
}

/**
 * Hàm phân tích và xác thực biến môi trường theo cơ chế Fail-Fast
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessage = [
      '',
      '================================================================================',
      '[CRITICAL APPLICATION BOOTSTRAP FAILURE: INVALID ENVIRONMENT CONFIGURATION]',
      'The application stopped because environment variables are missing or malformed.',
      'Review your .env file, ConfigMap or Secret:',
      '',
      formatEnvErrors(result.error.issues, config),
      '================================================================================',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  return result.data;
}
