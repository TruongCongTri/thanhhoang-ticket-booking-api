import { join } from 'path';
import { DataSourceOptions, Logger as TypeOrmLogger } from 'typeorm';
import { AppConfigService, DatabaseNodeConfig } from '../config/app-config.service';
import { SnakeNamingStrategy } from './snake-naming.strategy';

const APPLICATION_NAME = 'ticket-booking-api';

/**
 * Cấu hình DataSource dùng chung cho runtime (DatabaseModule) và TypeORM CLI (data-source.ts),
 * đảm bảo migration chạy với đúng naming strategy và tham số kết nối như ứng dụng.
 */
export function buildDataSourceOptions(
  config: AppConfigService,
  logger?: TypeOrmLogger,
): DataSourceOptions {
  const db = config.database;

  const toNode = (node: DatabaseNodeConfig) => ({
    host: node.host,
    port: node.port,
    username: node.username,
    password: node.password,
    database: node.database,
    ssl: db.ssl,
    applicationName: APPLICATION_NAME,
  });

  return {
    type: 'postgres',
    // Ghi → Master, đọc → Replica. Không cấu hình Replica thì dùng Master cho cả hai.
    replication: {
      master: toNode(db.master),
      slaves: [toNode(db.replica ?? db.master)],
    },
    connectTimeoutMS: db.pool.connectionTimeoutMs,
    extra: {
      // 1. Quản trị kích thước Connection Pool
      max: db.pool.max,
      min: db.pool.min,
      idleTimeoutMillis: db.pool.idleTimeoutMs,
      connectionTimeoutMillis: db.pool.connectionTimeoutMs,

      // 2. Tự động phát hiện & ngắt kết nối chết (Dead Connection Reaping)
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // 3. Ngắt câu query treo phía server (statement_timeout) và phía driver (query_timeout)
      statement_timeout: db.statementTimeoutMs,
      query_timeout: db.statementTimeoutMs + 1000,
      // Không giữ transaction mở vô thời hạn (khóa dòng/bảng)
      idle_in_transaction_session_timeout: db.statementTimeoutMs * 2,
    },
    namingStrategy: new SnakeNamingStrategy(),
    logger,
    synchronize: false, // Bắt buộc false: schema chỉ thay đổi qua migration
    migrationsRun: false, // Migration chạy bởi Job/InitContainer, không chạy khi Pod boot
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    maxQueryExecutionTime: db.slowQueryMs, // Kích hoạt logQuerySlow khi vượt ngưỡng
  };
}
