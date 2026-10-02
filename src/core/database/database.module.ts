/**
 * Cấu hình phân tách luồng:
 *  các câu truy vấn ghi (INSERT, UPDATE, DELETE) tự động trỏ về node Master,
 *  các câu truy vấn đọc (SELECT) được phân tải sang cụm Replica.
 * Tuyệt đối đặt synchronize: false trong doanh nghiệp.
 */
import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { ShutdownRegistry } from '../shutdown/shutdown.registry';
import { ShutdownPhase } from '../shutdown/shutdown.interface';
import { TypeOrmLoggerService } from './typeorm-logger.service';
import { buildDataSourceOptions } from './database.options';

/**
 * Tự đăng ký việc đóng pool vào Pha 5 (sau Redis) thay vì hardcode trong GracefulShutdownService.
 */
@Injectable()
class DatabaseShutdownHook implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly shutdownRegistry: ShutdownRegistry,
  ) {}

  onModuleInit(): void {
    this.shutdownRegistry.register(
      'TypeOrmConnectionPool',
      ShutdownPhase.CLOSE_RESOURCES,
      async () => {
        if (this.dataSource.isInitialized) {
          await this.dataSource.destroy();
        }
      },
      100, // Đóng sau cùng
    );
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      extraProviders: [TypeOrmLoggerService],
      inject: [AppConfigService, TypeOrmLoggerService],
      useFactory: (config: AppConfigService, typeOrmLogger: TypeOrmLoggerService) => ({
        ...buildDataSourceOptions(config, typeOrmLogger),
        autoLoadEntities: true,
        retryAttempts: config.isProduction ? 10 : 3,
        retryDelay: 3000,
      }),
    }),
  ],
  providers: [TypeOrmLoggerService, DatabaseShutdownHook],
  exports: [TypeOrmModule, TypeOrmLoggerService],
})
export class DatabaseModule {}
