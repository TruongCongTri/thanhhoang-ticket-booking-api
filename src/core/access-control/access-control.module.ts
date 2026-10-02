import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { AccessControlService } from './access-control.service';
import { PermissionsGuard } from './permissions.guard';
import { PermissionCacheService } from './permission-cache.service';

@Global()
@Module({
  providers: [
    CaslAbilityFactory,
    AccessControlService,
    PermissionCacheService,
    PermissionsGuard,
  ],
  exports: [
    CaslAbilityFactory,
    AccessControlService,
    PermissionCacheService,
    PermissionsGuard,
  ],
})
export class AccessControlModule {}
