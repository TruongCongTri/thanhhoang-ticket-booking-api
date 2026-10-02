import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyStorageService } from './idempotency-storage.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Global()
@Module({
  providers: [
    IdempotencyStorageService,
    IdempotencyInterceptor,
    // Đăng ký toàn cục để @Idempotent() hoạt động khai báo, không cần @UseInterceptors
    { provide: APP_INTERCEPTOR, useExisting: IdempotencyInterceptor },
  ],
  exports: [IdempotencyStorageService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
