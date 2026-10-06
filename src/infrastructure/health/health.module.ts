import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  // Pha drain traffic do GracefulShutdownService điều phối → Terminus không tự trì hoãn shutdown
  imports: [TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 0 })],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
  exports: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
