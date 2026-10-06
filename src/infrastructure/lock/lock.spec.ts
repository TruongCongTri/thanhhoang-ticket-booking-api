/**
 * Tạo test suite kiểm tra:
 *  Mutual Exclusion: Cấp lock thành công cho người gọi đầu tiên và ném ConflictException cho người gọi thứ hai khi hết lượt retry[cite: 1].
 *  Safe Release: Gọi đúng lệnh Lua script với token chuẩn và ngăn chặn xóa lock sai[cite: 1].
 *  RAII Execution: runWithLock tự động giải phóng lock ngay cả khi tác vụ bên trong ném lỗi[cite: 1].
 *  Watchdog Heartbeat: Gia hạn lock thành công bằng eval script.
 * 
 * */ 

import { ConflictException } from '@nestjs/common';
import Redis from 'ioredis';
import { DistributedLockService } from './services/distributed-lock.service';
import { RequestContextService } from '../../core/context/request-context.service';
import { SAFE_RELEASE_LUA, SAFE_EXTEND_LUA } from './scripts/lua-scripts';
import { resolveLockKeyTemplate } from './decorators/distributed-lock.decorator';

describe('DistributedLockModule (Enterprise Redlock Suite)', () => {
  let lockService: DistributedLockService;
  let mockRedis: jest.Mocked<Redis>;
  let contextService: RequestContextService;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(),
      eval: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    contextService = new RequestContextService();
    jest.spyOn(contextService, 'getTenantId').mockReturnValue('tenant_airline_vn');

    lockService = new DistributedLockService(mockRedis, contextService);
  });

  describe('acquire', () => {
    it('should acquire lock successfully on first attempt', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const handle = await lockService.acquire('seat:VN123:12A', { ttlMs: 5000 });

      expect(handle.key).toBe('dlock:tenant_airline_vn:seat:VN123:12A');
      expect(handle.token).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'dlock:tenant_airline_vn:seat:VN123:12A',
        handle.token,
        'PX',
        5000,
        'NX',
      );
    });

    it('should throw ConflictException when all retry attempts fail', async () => {
      mockRedis.set.mockResolvedValue(null); // Luôn trả về null (đã bị lock bởi luồng khác)

      await expect(
        lockService.acquire('seat:VN123:12A', { retryCount: 2, retryDelayMs: 10 }),
      ).rejects.toThrow(ConflictException);

      expect(mockRedis.set).toHaveBeenCalledTimes(3); // 1 lần đầu + 2 lần retry
    });
  });

  describe('release', () => {
    it('should invoke safe release Lua script with key and matching token', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const handle = {
        key: 'dlock:tenant_airline_vn:seat:VN123:12A',
        token: 'token_uuid_abc',
        ttlMs: 5000,
        acquiredAt: Date.now(),
      };

      const released = await lockService.release(handle);

      expect(released).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        SAFE_RELEASE_LUA,
        1,
        handle.key,
        'token_uuid_abc',
      );
    });
  });

  describe('runWithLock', () => {
    it('should execute operation and automatically release lock upon completion', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const businessOperation = jest.fn().mockResolvedValue('SEAT_RESERVED');

      const result = await lockService.runWithLock('hotel:room:101', businessOperation);

      expect(result).toBe('SEAT_RESERVED');
      expect(businessOperation).toHaveBeenCalledTimes(1);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        SAFE_RELEASE_LUA,
        1,
        'dlock:tenant_airline_vn:hotel:room:101',
        expect.any(String),
      );
    });

    it('should ensure lock is released even if operation throws an exception', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const faultyOperation = jest.fn().mockRejectedValue(new Error('Payment gateway down'));

      await expect(
        lockService.runWithLock('hotel:room:101', faultyOperation),
      ).rejects.toThrow('Payment gateway down');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        SAFE_RELEASE_LUA,
        1,
        'dlock:tenant_airline_vn:hotel:room:101',
        expect.any(String),
      );
    });
  });

  describe('extend', () => {
    it('should execute safe extend Lua script to renew TTL', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const handle = {
        key: 'dlock:tenant_airline_vn:settlement',
        token: 'token_worker_999',
        ttlMs: 10000,
        acquiredAt: Date.now(),
      };

      const extended = await lockService.extend(handle, 10000);

      expect(extended).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        SAFE_EXTEND_LUA,
        1,
        handle.key,
        'token_worker_999',
        10000,
      );
    });
  });

  describe('minimum lock retention (clock drift protection)', () => {
    it('should shorten the TTL instead of deleting when released before minHoldMs', async () => {
      mockRedis.eval.mockResolvedValue(1);
      const handle = { key: 'dlock:global:cron:settlement', token: 't1', ttlMs: 60000, acquiredAt: Date.now() };

      await lockService.release(handle, { minHoldMs: 30000 });

      expect(mockRedis.eval).toHaveBeenCalledWith(SAFE_EXTEND_LUA, 1, handle.key, 't1', expect.any(Number));
      expect(mockRedis.eval).not.toHaveBeenCalledWith(SAFE_RELEASE_LUA, 1, handle.key, 't1');
    });
  });

  describe('watchdog', () => {
    it('should flag the handle as lost and abort its signal when renewal fails', async () => {
      jest.useFakeTimers();
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(0); // Token không còn khớp → gia hạn thất bại

      const handle = await lockService.acquire('settlement', { ttlMs: 1000, autoRenew: true });
      await jest.advanceTimersByTimeAsync(600);

      expect(handle.lost).toBe(true);
      expect(handle.signal?.aborted).toBe(true);
      jest.useRealTimers();
    });
  });

  describe('in-process fallback (REDIS_ENABLED=false)', () => {
    it('should still provide mutual exclusion within a single instance', async () => {
      const memoryLocks = new DistributedLockService(null, contextService);

      const first = await memoryLocks.acquire('seat:VN1:1A', { ttlMs: 5000 });
      await expect(memoryLocks.acquire('seat:VN1:1A', { retryCount: 0 })).rejects.toThrow(ConflictException);

      await expect(memoryLocks.release(first)).resolves.toBe(true);
      await expect(memoryLocks.acquire('seat:VN1:1A', { retryCount: 0 })).resolves.toBeDefined();
    });
  });

  describe('@DistributedLock key templates', () => {
    it('should resolve {index} and {index.path} placeholders from method arguments', () => {
      expect(resolveLockKeyTemplate('flight:seat:{0}:{1.seat}', ['VN123', { seat: '12A' }])).toBe(
        'flight:seat:VN123:12A',
      );
      expect(() => resolveLockKeyTemplate('flight:{0}', [])).toThrow(/could not resolve/);
    });
  });
});

// npx jest src/infrastructure/lock/lock.spec.ts