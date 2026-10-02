import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { EncryptionService } from './encryption/encryption.service';
import { CustomThrottlerGuard } from './throttler/custom-throttler.guard';
import { THROTTLE_TIERS } from './throttler/throttler.constants';
import { resolveThrottleTier } from './throttler/throttler.decorators';
import { createThrottlerStorage } from './throttler/throttler-storage.provider';
import { IdempotencyModule } from './idempotency/idempotency.module';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService, REDIS_CLIENT],
      useFactory: (config: AppConfigService, redis: Redis | null) => {
        const { ttl, limit, searchLimit, sensitiveLimit } = config.throttler;
        return {
          // Mỗi route chỉ bị tính bởi đúng một tầng (mặc định PUBLIC);
          // nếu không có skipIf, cả 3 tầng cùng áp dụng và mọi API bị giới hạn ở mức SENSITIVE.
          throttlers: [
            {
              name: THROTTLE_TIERS.PUBLIC,
              ttl,
              limit,
              skipIf: (ctx) => resolveThrottleTier(ctx) !== THROTTLE_TIERS.PUBLIC,
            },
            {
              name: THROTTLE_TIERS.SEARCH,
              ttl,
              limit: searchLimit,
              skipIf: (ctx) => resolveThrottleTier(ctx) !== THROTTLE_TIERS.SEARCH,
            },
            {
              name: THROTTLE_TIERS.SENSITIVE,
              ttl,
              limit: sensitiveLimit,
              skipIf: (ctx) => resolveThrottleTier(ctx) !== THROTTLE_TIERS.SENSITIVE,
            },
          ],
          storage: createThrottlerStorage(redis),
        };
      },
    }),
    IdempotencyModule,
  ],
  providers: [
    EncryptionService,
    CustomThrottlerGuard,
    // Áp dụng rate limit toàn cục; dùng @SkipThrottle() cho health/metrics
    { provide: APP_GUARD, useExisting: CustomThrottlerGuard },
  ],
  exports: [IdempotencyModule, EncryptionService, CustomThrottlerGuard, ThrottlerModule],
})
export class SecurityModule {}
