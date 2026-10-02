import { TenancySubscriber } from './tenancy.subscriber';
import { RlsService } from './rls.service';
import { TenancyContextInterceptor } from './tenancy-context.interceptor';
import { TenantBaseEntity } from './tenant-base.entity';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, InsertEvent, UpdateEvent } from 'typeorm';
import { of } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';
import { RequestContextData, RequestUserContext } from '../context/request-context.model';

class MockBookingEntity extends TenantBaseEntity {
  bookingReference: string;
}

describe('MultiTenancyModule (RLS & TypeORM Tenancy Isolation)', () => {
  let subscriber: TenancySubscriber;
  let rlsService: RlsService;
  let contextService: RequestContextService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;

  const validTenantA = '11111111-1111-4111-8111-111111111111';
  const validTenantB = '22222222-2222-4222-8222-222222222222';
  const uuidV7Tenant = '01890a5d-ac96-774b-bcce-b302099a8057';

  const userOf = (tenantId: string, roles: string[] = ['AGENT']): RequestUserContext => ({
    id: 'usr_1',
    email: 'agent@travel.com',
    tenantId,
    roles,
    rules: [],
  });

  const baseContext = (user?: RequestUserContext): RequestContextData => ({
    traceId: 'TRACE-TENANCY',
    clientIp: '10.0.0.1',
    startTime: Date.now(),
    isBackgroundJob: false,
    user,
    metadata: new Map(),
  });

  beforeEach(() => {
    contextService = new RequestContextService();

    mockEntityManager = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EntityManager>;

    mockDataSource = {
      subscribers: [],
      transaction: jest.fn().mockImplementation((cb) => cb(mockEntityManager)),
    } as unknown as jest.Mocked<DataSource>;

    subscriber = new TenancySubscriber(contextService, mockDataSource);
    rlsService = new RlsService(mockDataSource, contextService);
  });

  describe('TenancySubscriber', () => {
    it('should register itself on the DataSource (autoLoadEntities does not load subscribers)', () => {
      expect(mockDataSource.subscribers).toContain(subscriber);
    });

    it('should automatically inject tenantId from the authenticated context upon INSERT', () => {
      contextService.run(baseContext(userOf(validTenantA)), () => {
        const entity = new MockBookingEntity();
        subscriber.beforeInsert({ entity } as unknown as InsertEvent<any>);
        expect(entity.tenantId).toBe(validTenantA);
      });
    });

    it('should NOT trust an unauthenticated x-tenant-id header for INSERT', () => {
      contextService.run(baseContext(), () => {
        contextService.setRequestedTenantId(validTenantB);
        const entity = new MockBookingEntity();
        expect(() =>
          subscriber.beforeInsert({ entity } as unknown as InsertEvent<any>),
        ).toThrow(UnauthorizedException);
      });
    });

    it('should block cross-tenant INSERT with a forged tenantId in the body', () => {
      contextService.run(baseContext(userOf(validTenantA)), () => {
        const entity = new MockBookingEntity();
        entity.tenantId = validTenantB;
        expect(() =>
          subscriber.beforeInsert({ entity } as unknown as InsertEvent<any>),
        ).toThrow(ForbiddenException);
      });
    });

    it('should block attempts to modify tenant_id on existing entities upon UPDATE', () => {
      const databaseEntity = { tenantId: validTenantA };
      const entity = { tenantId: validTenantB };

      expect(() => {
        subscriber.beforeUpdate({ entity, databaseEntity } as unknown as UpdateEvent<any>);
      }).toThrow(ForbiddenException);
    });

    it('should allow partial UPDATE payloads that do not carry tenantId', () => {
      contextService.run(baseContext(userOf(validTenantA)), () => {
        const databaseEntity = { tenantId: validTenantA, status: 'DRAFT' };
        const entity = { tenantId: undefined, status: 'PAID' };
        expect(() =>
          subscriber.beforeUpdate({ entity, databaseEntity } as unknown as UpdateEvent<any>),
        ).not.toThrow();
      });
    });
  });

  describe('TenancyContextInterceptor', () => {
    const interceptor = () => new TenancyContextInterceptor(contextService);
    const handler: CallHandler = { handle: () => of('ok') };
    const httpContext = (request: any) =>
      ({
        getType: () => 'http',
        switchToHttp: () => ({ getRequest: () => request }),
      }) as unknown as ExecutionContext;

    it('should reject malformed tenant header', () => {
      contextService.run(baseContext(), () => {
        expect(() =>
          interceptor().intercept(httpContext({ headers: { 'x-tenant-id': 'abc' } }), handler),
        ).toThrow(BadRequestException);
      });
    });

    it('should reject tenant spoofing by a regular authenticated user', () => {
      contextService.run(baseContext(), () => {
        const req = { headers: { 'x-tenant-id': validTenantB }, user: userOf(validTenantA) };
        expect(() => interceptor().intercept(httpContext(req), handler)).toThrow(
          ForbiddenException,
        );
      });
    });

    it('should allow SUPER_ADMIN to switch tenant via header (accepting UUID v7)', () => {
      contextService.run(baseContext(), () => {
        const req = {
          headers: { 'x-tenant-id': uuidV7Tenant },
          user: userOf(validTenantA, ['SUPER_ADMIN']),
        };
        interceptor().intercept(httpContext(req), handler);
        expect(contextService.getTenantId()).toBe(uuidV7Tenant);
      });
    });

    it('should keep anonymous header tenant as unverified only', () => {
      contextService.run(baseContext(), () => {
        interceptor().intercept(httpContext({ headers: { 'x-tenant-id': validTenantB } }), handler);
        expect(contextService.getTenantId()).toBeUndefined();
        expect(contextService.getRequestedTenantId()).toBe(validTenantB);
      });
    });
  });

  describe('RlsService', () => {
    it('should set app.current_tenant_id transaction-locally via parameterized set_config', async () => {
      const operation = jest.fn().mockResolvedValue('TRANSACTION_SUCCESS');

      const result = await contextService.run(baseContext(userOf(validTenantA)), () =>
        rlsService.runInTenantContext(operation),
      );

      expect(mockEntityManager.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
        'app.current_tenant_id',
        validTenantA,
      ]);
      expect(operation).toHaveBeenCalledWith(mockEntityManager);
      expect(result).toBe('TRANSACTION_SUCCESS');
    });

    it('should refuse to run in another tenant for a regular user', async () => {
      await contextService.run(baseContext(userOf(validTenantA)), async () => {
        await expect(
          rlsService.runInTenantContext(jest.fn(), validTenantB),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    it('should enable app.bypass_rls for background workers', async () => {
      const operation = jest.fn().mockResolvedValue('BYPASS_SUCCESS');

      const result = await contextService.runAsSystem('RECONCILIATION', () =>
        rlsService.runWithBypass(operation),
      );

      expect(mockEntityManager.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
        'app.bypass_rls',
        'on',
      ]);
      expect(result).toBe('BYPASS_SUCCESS');
    });

    it('should forbid RLS bypass from a regular HTTP request', async () => {
      await contextService.run(baseContext(userOf(validTenantA)), async () => {
        await expect(rlsService.runWithBypass(jest.fn())).rejects.toThrow(ForbiddenException);
      });
    });
  });
});

// npx jest src/core/multitenancy/multitenancy.spec.ts
