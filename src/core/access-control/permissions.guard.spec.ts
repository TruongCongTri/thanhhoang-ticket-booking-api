import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { CaslAbilityFactory } from './casl-ability.factory';
import { RequestContextService } from '../context/request-context.service';
import { Action, PermissionEffect, Scope } from './access-control.types';
import { PERMISSIONS_KEY, RequiredPermission } from './permission.decorator';
import { RequestUserContext } from '../context/request-context.model';

describe('PermissionsGuard (ABAC & RBAC Test)', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let abilityFactory: CaslAbilityFactory;
  let contextService: RequestContextService;

  beforeEach(() => {
    reflector = new Reflector();
    abilityFactory = new CaslAbilityFactory();
    contextService = new RequestContextService();
    guard = new PermissionsGuard(reflector, abilityFactory, contextService);
  });

  const createMockContext = (requestData: any): ExecutionContext =>
    ({
      getType: () => 'http',
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(requestData),
      }),
    }) as unknown as ExecutionContext;

  it('should allow access if no permissions are required on route', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({});

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if user context is missing', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([
        { resource: 'bookings', action: Action.READ, scope: Scope.GLOBAL },
      ]);
    jest.spyOn(contextService, 'getCurrentUser').mockReturnValue(undefined);

    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should block access when user lacks required permission', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([
        { resource: 'bookings', action: Action.DELETE, scope: Scope.GLOBAL },
      ]);
    jest.spyOn(contextService, 'getCurrentUser').mockReturnValue({
      id: 'usr_1',
      email: 'agent@travel.com',
      roles: ['AGENT'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.GRANT,
        },
      ],
    });

    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should evaluate ABAC and allow access when department matches', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) {
        return [
          {
            resource: 'bookings',
            action: Action.READ,
            scope: Scope.DEPARTMENT,
          },
        ];
      }
      return undefined;
    });

    // User thuộc phòng SALES
    jest.spyOn(contextService, 'getCurrentUser').mockReturnValue({
      id: 'usr_lead',
      email: 'lead@travel.com',
      departmentId: 'dep_SALES',
      roles: ['LEAD'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
      ],
    });

    // Request truy vấn tài nguyên của phòng SALES
    const context = createMockContext({
      params: { departmentId: 'dep_SALES' },
    });

    const isAllowed = await guard.canActivate(context);
    expect(isAllowed).toBe(true);
  });

  it('should evaluate ABAC and reject access when department mismatches', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) {
        return [
          {
            resource: 'bookings',
            action: Action.READ,
            scope: Scope.DEPARTMENT,
          },
        ];
      }
      return undefined;
    });

    jest.spyOn(contextService, 'getCurrentUser').mockReturnValue({
      id: 'usr_lead',
      email: 'lead@travel.com',
      departmentId: 'dep_SALES',
      roles: ['LEAD'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
      ],
    });

    // Request truy vấn tài nguyên của phòng MARKETING
    const context = createMockContext({
      params: { departmentId: 'dep_MARKETING' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('Enterprise hardening', () => {
    const salesLead: RequestUserContext = {
      id: 'usr_lead',
      email: 'lead@travel.com',
      departmentId: 'dep_SALES',
      roles: ['LEAD'],
      rules: [
        {
          resource: 'bookings',
          action: Action.UPDATE,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const requirePermissions = (...perms: RequiredPermission[]) =>
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key) => (key === PERMISSIONS_KEY ? perms : undefined));

    it('should read the user from request.user (set by JwtAuthGuard) because guards run before interceptors', async () => {
      requirePermissions({ resource: 'bookings', action: Action.UPDATE });
      const context = createMockContext({ user: salesLead });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('should reject when user scope is narrower than the required scope', async () => {
      requirePermissions({ resource: 'bookings', action: Action.UPDATE, scope: Scope.GLOBAL });
      const context = createMockContext({ user: salesLead });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should NOT trust ownership attributes from the body for UPDATE (spoofing)', async () => {
      // Bản ghi thật thuộc phòng IT, client khai man departmentId = SALES trong body
      requirePermissions({
        resource: 'bookings',
        action: Action.UPDATE,
        scope: Scope.DEPARTMENT,
        subjectResolver: () => ({ id: 'bk_1', departmentId: 'dep_IT' }),
      });
      const context = createMockContext({
        user: salesLead,
        params: { id: 'bk_1' },
        body: { departmentId: 'dep_SALES' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should expose the resolved entity on request.targetResource for controller reuse', async () => {
      const entity = { id: 'bk_2', departmentId: 'dep_SALES' };
      requirePermissions({
        resource: 'bookings',
        action: Action.UPDATE,
        subjectResolver: async () => entity,
      });
      const request: any = { user: salesLead, params: { id: 'bk_2' } };

      await expect(guard.canActivate(createMockContext(request))).resolves.toBe(true);
      expect(request.targetResource).toBe(entity);
    });
  });
});

// npx jest src/core/access-control/permissions.guard.spec.ts
