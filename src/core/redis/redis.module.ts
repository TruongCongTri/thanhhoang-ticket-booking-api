/**
 * Kết nối Redis dùng chung cho Throttler, Idempotency, Permission Cache.
 * Khi REDIS_ENABLED=false (chỉ cho phép ngoài production), REDIS_CLIENT = null
 * và các module tiêu thụ tự động fallback về bộ nhớ trong tiến trình.
 */
import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
import { ShutdownRegistry } from '../shutdown/shutdown.registry';
import { ShutdownPhase } from '../shutdown/shutdown.interface';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService, ShutdownRegistry],
      useFactory: (
        config: AppConfigService,
        shutdownRegistry: ShutdownRegistry,
      ): Redis | null => {
        const logger = new Logger('Redis');
        const options = config.redis;

        if (!options.enabled) {
          logger.warn(
            'REDIS_ENABLED=false: using per-process in-memory stores. Not safe for multi-instance deployments.',
          );
          return null;
        }

        const client = new Redis({
          host: options.host,
          port: options.port,
          username: options.username,
          password: options.password,
          db: options.db,
          tls: options.tls ? {} : undefined,
          keyPrefix: options.keyPrefix,
          connectionName: 'ticket-booking-api',
          maxRetriesPerRequest: 2,
          connectTimeout: 5000,
          // Tránh dồn lệnh khi mất kết nối: lỗi ngay để caller fallback/fail-fast
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        });

        client.on('ready', () => logger.log('Redis connection ready'));
        client.on('error', (err) =>
          logger.error(`Redis connection error: ${err.message}`),
        );

        shutdownRegistry.register(
          'RedisClient',
          ShutdownPhase.CLOSE_RESOURCES,
          async () => {
            await client.quit().catch(() => client.disconnect());
          },
          90,
        );

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
