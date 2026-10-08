/**
 * Triển khai dịch vụ gom dữ liệu phòng khách sạn tương thích cơ chế non-blocking:
 * Scatter-Gather & Circuit Breaker)
 * */

// src/modules/search/services/hotel-aggregator.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import CircuitBreaker from 'opossum';
import * as crypto from 'crypto';
import { 
  HotelAdapterInterface, 
  SearchHotelCriteria, 
  UnifiedHotelRoomDto 
} from '../adapters/hotel/hotel-adapter.interface';
import { HotelbedsAdapter } from '../adapters/hotel/hotelbeds.adapter';
import { AgodaAdapter } from '../adapters/hotel/agoda.adapter';

type HotelCircuitBreaker = CircuitBreaker<
  [SearchHotelCriteria, AbortSignal],
  UnifiedHotelRoomDto[]
>;

@Injectable()
export class HotelAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(HotelAggregatorService.name);
  private adapters: HotelAdapterInterface[] = [];
  private circuitBreakers = new Map<string, HotelCircuitBreaker>();

  private readonly GLOBAL_AGGREGATION_TIMEOUT_MS = 6000;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly redisClient: any, // Inject từ CacheModule
  ) {}

  onModuleInit() {
    const rawAdapters: (HotelAdapterInterface | undefined)[] = [
      this.moduleRef.get(HotelbedsAdapter, { strict: false }),
      this.moduleRef.get(AgodaAdapter, { strict: false }),
    ];

    this.adapters = rawAdapters.filter(
      (adapter): adapter is HotelAdapterInterface => Boolean(adapter),
    );

    this.adapters.forEach((adapter) => {
      const breaker: HotelCircuitBreaker = new CircuitBreaker<
        [SearchHotelCriteria, AbortSignal],
        UnifiedHotelRoomDto[]
      >(
        (criteria: SearchHotelCriteria, signal: AbortSignal) =>
          adapter.searchHotels(criteria, signal),
        {
          timeout: 5500,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
          volumeThreshold: 5,
        },
      );

      breaker.fallback(() => {
        this.logger.warn(
          `Circuit Breaker OPEN or TIMEOUT for Hotel Partner [${adapter.partnerCode}]. Returning fallback.`,
        );
        return [];
      });

      this.circuitBreakers.set(adapter.partnerCode, breaker);
    });
  }

  async aggregate(criteria: SearchHotelCriteria): Promise<UnifiedHotelRoomDto[]> {
    // 1. Kiểm tra Cache L2
    const cacheKey = this.generateCacheKey(criteria);
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Global AbortController chặn rò rỉ socket khi quá hạn Hard Deadline
    const globalAbortController = new AbortController();
    const hardTimeoutTimer = setTimeout(() => {
      globalAbortController.abort();
      this.logger.warn(
        `Global hotel search deadline of ${this.GLOBAL_AGGREGATION_TIMEOUT_MS}ms exceeded. Aborting tasks.`,
      );
    }, this.GLOBAL_AGGREGATION_TIMEOUT_MS);

    try {
      // 3. Phân tán song song (Scatter)[cite: 2]
      const searchPromises: Promise<UnifiedHotelRoomDto[]>[] = this.adapters.map((adapter) => {
        const breaker = this.circuitBreakers.get(adapter.partnerCode);
        if (!breaker) {
          return adapter.searchHotels(criteria, globalAbortController.signal);
        }
        return breaker.fire(criteria, globalAbortController.signal);
      });

      // 4. Thu gom kết quả (Gather)[cite: 2]
      const settledOutcomes = await Promise.allSettled(searchPromises);
      const aggregatedRooms: UnifiedHotelRoomDto[] = [];

      settledOutcomes.forEach((outcome, index) => {
        const partnerCode = this.adapters[index]?.partnerCode ?? 'UNKNOWN';

        if (outcome.status === 'fulfilled') {
          aggregatedRooms.push(...outcome.value);
        } else {
          const reason =
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason);
          this.logger.error(`Hotel Adapter [${partnerCode}] failed: ${reason}`);
        }
      });

      // 5. Sắp xếp phòng theo giá thấp nhất
      const sortedRooms = aggregatedRooms.sort((a, b) => a.totalAmount - b.totalAmount);

      // 6. Lưu Redis Cache trong 60 giây
      if (sortedRooms.length > 0) {
        await this.redisClient.set(cacheKey, JSON.stringify(sortedRooms), 'EX', 60);
      }

      return sortedRooms;
    } finally {
      clearTimeout(hardTimeoutTimer);
    }
  }

  private generateCacheKey(criteria: SearchHotelCriteria): string {
    const raw = `${criteria.destinationCode}:${criteria.checkInDate}:${criteria.checkOutDate}:${criteria.roomsCount}:${criteria.adultsCount}`;
    return `cache:hotel_search:${crypto.createHash('md5').update(raw).digest('hex')}`;
  }
}