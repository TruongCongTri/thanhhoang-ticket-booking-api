import { Module } from '@nestjs/common';
import { AccessControlModule } from './access-control/access-control.module';
import { AppConfigModule } from './config/app-config.module';
import { RequestContextModule } from './context/request-context.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { ResilienceModule } from './resilience/resilience.module';
import { SecurityModule } from './security/security.module';
import { GracefulShutdownModule } from './shutdown/graceful-shutdown.module';
import { MultiTenancyModule } from './multitenancy/multitenancy.module';
import { RedisModule } from './redis/redis.module';

/**
 * Thứ tự import quyết định thứ tự đăng ký middleware / interceptor toàn cục:
 *  - GracefulShutdown trước RequestContext: đếm in-flight cho mọi request.
 *  - RequestContext trước Logger: AsyncLocalStorage đã sẵn sàng khi pino-http ghi log.
 */
@Module({
  imports: [
    AppConfigModule,
    GracefulShutdownModule,
    RequestContextModule,
    LoggerModule,
    RedisModule,
    DatabaseModule,
    MultiTenancyModule,
    AccessControlModule,
    ResilienceModule,
    SecurityModule,
  ],
  exports: [
    AppConfigModule,
    GracefulShutdownModule,
    RequestContextModule,
    LoggerModule,
    RedisModule,
    DatabaseModule,
    MultiTenancyModule,
    AccessControlModule,
    ResilienceModule,
    SecurityModule,
  ],
})
export class CoreModule {}
