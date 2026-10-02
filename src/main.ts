import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './core/config/app-config.service';
import { AppLoggerService } from './core/logger/app-logger.service';
import {
  buildCorsConfig,
  helmetSecurityConfig,
} from './core/security/headers/security-headers.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Khi shutdown: đóng các kết nối keep-alive nhàn rỗi để server.close() không treo tới watchdog
    forceCloseConnections: true,
  });

  const config = app.get(AppConfigService);

  // 1. Logger có ngữ cảnh (traceId, userId, tenantId) cho toàn bộ application lifecycle
  app.useLogger(app.get(AppLoggerService));
  const logger = new Logger('Bootstrap');

  // 2. Chỉ tin X-Forwarded-For từ proxy đã cấu hình (req.ip dùng cho rate limit, audit)
  app.set('trust proxy', config.trustProxy);

  // 3. Kích hoạt Graceful Shutdown Hooks cho SIGTERM/SIGINT
  app.enableShutdownHooks();

  // 4. Security Headers & CORS Whitelist
  app.use(helmet(helmetSecurityConfig));
  app.enableCors(buildCorsConfig(config.allowedOrigins));

  app.setGlobalPrefix(config.apiPrefix);

  await app.listen(config.port);

  logger.log(`Application listening on port ${config.port} (${config.nodeEnv})`);
  logger.log({ msg: 'Effective configuration', config: config.getSanitizedConfig() });
}

process.on('unhandledRejection', (reason) => {
  new Logger('Process').error(
    `Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    reason instanceof Error ? reason.stack : undefined,
  );
});

process.on('uncaughtException', (err) => {
  new Logger('Process').fatal(`Uncaught exception: ${err.message}`, err.stack);
  process.exit(1);
});

bootstrap().catch((err) => {
  // Logger có thể chưa khởi tạo (vd: env không hợp lệ) → ghi thẳng stderr
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
