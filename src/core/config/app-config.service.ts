import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './env.schema';

export interface DatabaseNodeConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  private get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.configService.get(key, { infer: true });
  }

  // Môi trường thực thi
  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.get('PORT');
  }

  get apiPrefix(): string {
    return this.get('API_PREFIX');
  }

  get trustProxy(): boolean | number | string {
    return this.get('TRUST_PROXY');
  }

  get logLevel(): NonNullable<EnvConfig['LOG_LEVEL']> {
    return this.get('LOG_LEVEL') ?? (this.isProduction ? 'info' : 'debug');
  }

  get allowedOrigins(): string[] {
    return this.get('ALLOWED_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  // Cấu hình Database Master & Replica
  get database() {
    const master: DatabaseNodeConfig = {
      host: this.get('DB_MASTER_HOST'),
      port: this.get('DB_MASTER_PORT'),
      username: this.get('DB_MASTER_USER'),
      password: this.get('DB_MASTER_PASSWORD'),
      database: this.get('DB_NAME'),
    };

    const replicaHost = this.get('DB_REPLICA_HOST');
    const replica: DatabaseNodeConfig | undefined = replicaHost
      ? {
          host: replicaHost,
          port: this.get('DB_REPLICA_PORT'),
          username: this.get('DB_REPLICA_USER') as string,
          password: this.get('DB_REPLICA_PASSWORD') as string,
          database: this.get('DB_NAME'),
        }
      : undefined;

    return {
      master,
      replica,
      pool: {
        max: this.get('DB_POOL_MAX'),
        min: this.get('DB_POOL_MIN'),
        connectionTimeoutMs: this.get('DB_CONNECTION_TIMEOUT_MS'),
        idleTimeoutMs: this.get('DB_IDLE_TIMEOUT_MS'),
      },
      statementTimeoutMs: this.get('DB_STATEMENT_TIMEOUT_MS'),
      slowQueryMs: this.get('DB_SLOW_QUERY_MS'),
      ssl: this.get('DB_SSL')
        ? { rejectUnauthorized: this.get('DB_SSL_REJECT_UNAUTHORIZED') }
        : false,
    };
  }

  // Cấu hình Redis
  get redis() {
    return {
      enabled: this.get('REDIS_ENABLED'),
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      username: this.get('REDIS_USERNAME') || undefined,
      password: this.get('REDIS_PASSWORD') || undefined,
      db: this.get('REDIS_DB'),
      tls: this.get('REDIS_TLS'),
      keyPrefix: this.get('REDIS_KEY_PREFIX'),
    };
  }

  // Cấu hình Bảo mật & Khóa mã hóa
  get security() {
    const legacyKeys = this.get('ENCRYPTION_LEGACY_KEYS')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [version, key] = entry.split(':');
        return { version, key };
      });

    return {
      encryptionKey: this.get('ENCRYPTION_KEY'),
      encryptionKeyVersion: this.get('ENCRYPTION_KEY_VERSION'),
      encryptionLegacyKeys: legacyKeys,
      jwt: {
        secret: this.get('JWT_SECRET'),
        expiresIn: this.get('JWT_EXPIRES_IN'),
        refreshSecret: this.get('JWT_REFRESH_SECRET'),
        refreshExpiresIn: this.get('JWT_REFRESH_EXPIRES_IN'),
      },
    };
  }

  // Cấu hình Throttling 3 tầng
  get throttler() {
    return {
      ttl: this.get('THROTTLE_TTL'),
      limit: this.get('THROTTLE_LIMIT'),
      searchLimit: this.get('THROTTLE_SEARCH_LIMIT'),
      sensitiveLimit: this.get('THROTTLE_SENSITIVE_LIMIT'),
    };
  }

  get resilience() {
    return {
      timeoutMs: this.get('CIRCUIT_BREAKER_TIMEOUT_MS'),
      resetTimeoutMs: this.get('CIRCUIT_BREAKER_RESET_TIMEOUT_MS'),
    };
  }

  get shutdown() {
    return {
      drainDelayMs: this.get('SHUTDOWN_DRAIN_DELAY_MS'),
      hookTimeoutMs: this.get('SHUTDOWN_HOOK_TIMEOUT_MS'),
      timeoutMs: this.get('SHUTDOWN_TIMEOUT_MS'),
    };
  }

  /**
   * Xuất cấu hình đã che dấu (Masked) để phục vụ in log khi khởi động hoặc API giám sát.
   * Chỉ chứa giá trị không nhạy cảm; secret chỉ được báo là "đã cấu hình".
   */
  getSanitizedConfig(): Record<string, any> {
    const db = this.database;
    const redis = this.redis;
    const security = this.security;

    return {
      nodeEnv: this.nodeEnv,
      port: this.port,
      apiPrefix: this.apiPrefix,
      trustProxy: this.trustProxy,
      logLevel: this.logLevel,
      allowedOrigins: this.allowedOrigins,
      database: {
        masterHost: db.master.host,
        replicaHost: db.replica?.host ?? null,
        dbName: db.master.database,
        pool: db.pool,
        statementTimeoutMs: db.statementTimeoutMs,
        ssl: db.ssl !== false,
      },
      redis: {
        enabled: redis.enabled,
        host: redis.host,
        port: redis.port,
        db: redis.db,
        tls: redis.tls,
        passwordConfigured: !!redis.password,
      },
      throttler: this.throttler,
      resilience: this.resilience,
      shutdown: this.shutdown,
      security: {
        encryptionKeyConfigured: !!security.encryptionKey,
        encryptionKeyVersion: security.encryptionKeyVersion,
        legacyEncryptionKeyVersions: security.encryptionLegacyKeys.map(
          (k) => k.version,
        ),
        jwtSecretConfigured: !!security.jwt.secret,
        jwtRefreshSecretConfigured: !!security.jwt.refreshSecret,
      },
    };
  }
}
