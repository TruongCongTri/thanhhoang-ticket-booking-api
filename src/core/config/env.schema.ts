/**
 * Hệ thống sẽ crash ngay lập tức tại thời điểm bootstrap
 * nếu biến môi trường bị thiếu hoặc sai kiểu dữ liệu,
 * ngăn ngừa lỗi runtime âm thầm.
 */
import { z } from 'zod';

const HEX_256_BIT = /^[0-9a-fA-F]{64}$/;
const KEY_VERSION = /^[A-Za-z0-9_-]{1,16}$/;

/** Boolean từ chuỗi env ('true'/'false'/'1'/'0'/'yes'/'no'). z.coerce.boolean() coi 'false' là true nên không dùng. */
const envBool = (defaultValue: boolean) =>
  z.stringbool().default(defaultValue);

/**
 * Express `trust proxy`: 'true' | 'false' | số hop | danh sách subnet (loopback, 10.0.0.0/8, ...).
 * Mặc định false: chỉ tin X-Forwarded-For khi đã cấu hình tường minh, chống giả mạo IP.
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform((raw): boolean | number | string => {
    const value = raw.trim();
    if (value === 'true') return true;
    if (value === 'false' || value === '') return false;
    if (/^\d+$/.test(value)) return Number(value);
    return value;
  });

/** Danh sách khóa cũ phục vụ giải mã sau khi xoay khóa: "v0:<hex64>,v1:<hex64>" */
const legacyKeysSchema = z
  .string()
  .default('')
  .refine(
    (raw) =>
      raw.trim() === '' ||
      raw.split(',').every((entry) => {
        const [version, key, ...rest] = entry.trim().split(':');
        return (
          rest.length === 0 &&
          KEY_VERSION.test(version ?? '') &&
          HEX_256_BIT.test(key ?? '')
        );
      }),
    'ENCRYPTION_LEGACY_KEYS must be a comma-separated list of "<version>:<64-hex-key>"',
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z.string().default('api/v1'),
    ALLOWED_ORIGINS: z.string().default('*'),
    TRUST_PROXY: trustProxySchema,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .optional(),

    // PostgreSQL Master (Write Node)
    DB_MASTER_HOST: z.string().min(1, 'DB_MASTER_HOST is required'),
    DB_MASTER_PORT: z.coerce.number().int().default(5432),
    DB_MASTER_USER: z.string().min(1, 'DB_MASTER_USER is required'),
    DB_MASTER_PASSWORD: z.string().min(1, 'DB_MASTER_PASSWORD is required'),
    DB_NAME: z.string().min(1, 'DB_NAME is required'),

    // PostgreSQL Replica (Read Node) - tùy chọn, bỏ trống sẽ đọc/ghi trên Master
    DB_REPLICA_HOST: z.string().optional(),
    DB_REPLICA_PORT: z.coerce.number().int().default(5432),
    DB_REPLICA_USER: z.string().optional(),
    DB_REPLICA_PASSWORD: z.string().optional(),

    // Connection Pool & Timeouts
    DB_POOL_MAX: z.coerce.number().int().min(1).default(20),
    DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(15000),
    DB_SLOW_QUERY_MS: z.coerce.number().int().min(1).default(500),
    DB_SSL: envBool(false),
    DB_SSL_REJECT_UNAUTHORIZED: envBool(true),

    // Redis (Cache, Lock, Throttler, Idempotency, Permission cache)
    REDIS_ENABLED: envBool(true),
    REDIS_HOST: z.string().default('127.0.0.1'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_USERNAME: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_TLS: envBool(false),
    REDIS_KEY_PREFIX: z.string().default('tba:'),

    // Security & Encryption
    ENCRYPTION_KEY: z
      .string()
      .regex(
        HEX_256_BIT,
        'ENCRYPTION_KEY must be exactly a 64-character HEX string (32 bytes)',
      ),
    ENCRYPTION_KEY_VERSION: z
      .string()
      .regex(KEY_VERSION, 'ENCRYPTION_KEY_VERSION must match [A-Za-z0-9_-]{1,16}')
      .default('v1'),
    ENCRYPTION_LEGACY_KEYS: legacyKeysSchema,
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters long for HMAC-SHA256'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Rate Limiting (Throttler) - 3 tầng nghiệp vụ, cửa sổ chung THROTTLE_TTL (ms)
    THROTTLE_TTL: z.coerce.number().int().min(1000).default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(60),
    THROTTLE_SEARCH_LIMIT: z.coerce.number().int().min(1).default(100),
    THROTTLE_SENSITIVE_LIMIT: z.coerce.number().int().min(1).default(5),

    // Resilience & Circuit Breaker
    CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().int().min(1).default(8000),
    CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1)
      .default(30000),

    // Graceful Shutdown (phải nhỏ hơn terminationGracePeriodSeconds của K8s)
    SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().min(0).default(5000),
    SHUTDOWN_HOOK_TIMEOUT_MS: z.coerce.number().int().min(100).default(10000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(25000),
  })
  .superRefine((env, ctx) => {
    if (env.DB_POOL_MIN > env.DB_POOL_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_POOL_MIN'],
        message: 'DB_POOL_MIN must be <= DB_POOL_MAX',
      });
    }

    if (env.SHUTDOWN_DRAIN_DELAY_MS >= env.SHUTDOWN_TIMEOUT_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHUTDOWN_DRAIN_DELAY_MS'],
        message: 'SHUTDOWN_DRAIN_DELAY_MS must be < SHUTDOWN_TIMEOUT_MS',
      });
    }

    if (env.DB_REPLICA_HOST && (!env.DB_REPLICA_USER || !env.DB_REPLICA_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_REPLICA_USER'],
        message:
          'DB_REPLICA_USER and DB_REPLICA_PASSWORD are required when DB_REPLICA_HOST is set',
      });
    }

    const legacyVersions = env.ENCRYPTION_LEGACY_KEYS.split(',')
      .map((entry) => entry.trim().split(':')[0])
      .filter(Boolean);
    if (legacyVersions.includes(env.ENCRYPTION_KEY_VERSION)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_LEGACY_KEYS'],
        message: `Legacy key list must not redefine the active version '${env.ENCRYPTION_KEY_VERSION}'`,
      });
    }

    // Các ràng buộc chỉ áp dụng cho Production
    if (env.NODE_ENV !== 'production') return;

    if (
      env.ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .includes('*')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ALLOWED_ORIGINS'],
        message: "Wildcard '*' CORS origin is not allowed in production",
      });
    }

    if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_SECRET in production',
      });
    }

    if (!env.REDIS_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_ENABLED'],
        message:
          'Redis is mandatory in production (rate limit, idempotency and permission cache must be shared across pods)',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

const SECRET_NAME_PATTERN = /PASSWORD|SECRET|KEY|TOKEN/i;
const MAX_DISPLAY_LENGTH = 40;

/**
 * Hiển thị giá trị hiện tại của biến một cách an toàn trong log của Pod:
 * biến nhạy cảm chỉ hiện độ dài, biến thường bị cắt ngắn.
 */
export function describeEnvValue(name: string, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '<missing>';
  }
  const str = String(value);
  if (SECRET_NAME_PATTERN.test(name)) {
    return `<redacted, ${str.length} chars>`;
  }
  return str.length > MAX_DISPLAY_LENGTH
    ? `"${str.slice(0, MAX_DISPLAY_LENGTH)}…"`
    : `"${str}"`;
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
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
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
