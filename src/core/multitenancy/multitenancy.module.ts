import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenancyContextInterceptor } from './tenancy-context.interceptor';
import { TenancySubscriber } from './tenancy.subscriber';
import { RlsService } from './rls.service';

@Global()
@Module({
  providers: [
    TenancySubscriber,
    RlsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenancyContextInterceptor,
    },
  ],
  exports: [TenancySubscriber, RlsService],
})
export class MultiTenancyModule {}
