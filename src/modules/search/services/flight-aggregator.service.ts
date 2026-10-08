/**
 * 2. Dịch vụ Gom dữ liệu (Scatter-Gather Pattern với Circuit Breaker)
 * Dịch vụ này bắn song song toàn bộ request sang các Adapter, sử dụng Promise.allSettled() để cô lập lỗi:
 * */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import CircuitBreaker from 'opossum';
import { AviationAdapterInterface } from '../adapters/aviation/aviation-adapter.interface';
import { SabreAdapter } from '../adapters/aviation/sabre.adapter';
import { AmadeusAdapter } from '../adapters/aviation/amadeus.adapter';
import { VietjetAdapter } from '../adapters/aviation/vietjet.adapter';
import { AirAsiaAdapter } from '../adapters/aviation/airasia.adapter';
import { SearchFlightQueryDto } from '../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../dto/unified-flight-result.dto';
import { SearchCacheService } from './search-cache.service';
import { FareNormalizationService } from './fare-normalization.service';

// 1. Chỉ định chính xác tuple tham số đầu vào là [SearchFlightQueryDto, AbortSignal]
type FlightCircuitBreaker = CircuitBreaker<
  [SearchFlightQueryDto, AbortSignal],
  UnifiedFlightSegmentDto[]
>;

@Injectable()
export class FlightAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(FlightAggregatorService.name);
  private adapters: AviationAdapterInterface[] = [];
  private circuitBreakers = new Map<string, FlightCircuitBreaker>();

  // Thời gian tối đa cho toàn bộ phiên Scatter-Gather (Hard SLA Deadline: 6s)[cite: 2]
  private readonly GLOBAL_AGGREGATION_TIMEOUT_MS = 6000;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly searchCacheService: SearchCacheService,
    private readonly normalizationService: FareNormalizationService,
  ) {}

  onModuleInit() {
    // Ép kiểu mảng nguồn về (AviationAdapterInterface | undefined)[] để tránh lỗi TS2677
    const rawAdapters: (AviationAdapterInterface | undefined)[] = [
      this.moduleRef.get(SabreAdapter, { strict: false }),
      this.moduleRef.get(AmadeusAdapter, { strict: false }),
      this.moduleRef.get(VietjetAdapter, { strict: false }),
      this.moduleRef.get(AirAsiaAdapter, { strict: false }),
    ];

    this.adapters = rawAdapters.filter(
      (adapter): adapter is AviationAdapterInterface => Boolean(adapter),
    );

    // 2. Khởi tạo Circuit Breaker cho từng Adapter, adapter được giữ an toàn trong closure[cite: 2]
    this.adapters.forEach((adapter) => {
      const breaker: FlightCircuitBreaker = new CircuitBreaker<
        [SearchFlightQueryDto, AbortSignal],
        UnifiedFlightSegmentDto[]
      >(
        (query: SearchFlightQueryDto, signal: AbortSignal) =>
          adapter.searchFlights(query, signal),
        {
          timeout: 5500, // Timeout Breaker 5.5s (lớn hơn HTTP socket timeout 5s)[cite: 2]
          errorThresholdPercentage: 50, // Ngưỡng lỗi 50% để ngắt mạch[cite: 2]
          resetTimeout: 30000, // Thử kết nối lại sau 30s[cite: 2]
          volumeThreshold: 5,
        },
      );

      // Fallback trả về mảng rỗng ngay lập tức khi lỗi hoặc timeout[cite: 2]
      breaker.fallback(() => {
        this.logger.warn(
          `Circuit Breaker OPEN or TIMEOUT for [${adapter.partnerCode}]. Returning empty fallback.`,
        );
        return [];
      });

      this.circuitBreakers.set(adapter.partnerCode, breaker);
    });
  }

  async aggregate(query: SearchFlightQueryDto): Promise<UnifiedFlightSegmentDto[]> {
    // 1. Kiểm tra Cache L2 (Redis)[cite: 2]
    const cachedResults = await this.searchCacheService.getDynamicFareCache(query);
    if (cachedResults) {
      return cachedResults;
    }

    // 2. Khởi tạo Global AbortController để chặn rò rỉ socket khi chạm Hard Timeout
    const globalAbortController = new AbortController();
    const hardTimeoutTimer = setTimeout(() => {
      globalAbortController.abort();
      this.logger.warn(
        `Global search deadline of ${this.GLOBAL_AGGREGATION_TIMEOUT_MS}ms exceeded. Aborting hanging tasks.`,
      );
    }, this.GLOBAL_AGGREGATION_TIMEOUT_MS);

    try {
      // 3. Phân tán song song (Scatter): truyền thẳng query và signal vào .fire()[cite: 2]
      const searchPromises: Promise<UnifiedFlightSegmentDto[]>[] = this.adapters.map(
        (adapter) => {
          const breaker = this.circuitBreakers.get(adapter.partnerCode);

          if (!breaker) {
            return adapter.searchFlights(query, globalAbortController.signal);
          }

          return breaker.fire(query, globalAbortController.signal);
        },
      );

      // 4. Thu gom kết quả (Gather) bằng Promise.allSettled để cô lập lỗi[cite: 2]
      const settledOutcomes = await Promise.allSettled(searchPromises);

      const aggregatedFares: UnifiedFlightSegmentDto[] = [];

      settledOutcomes.forEach((outcome, index) => {
        const partnerCode = this.adapters[index]?.partnerCode ?? 'UNKNOWN';

        if (outcome.status === 'fulfilled') {
          aggregatedFares.push(...outcome.value);
        } else {
          const reason =
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason);
          this.logger.error(`Adapter [${partnerCode}] failed: ${reason}`);
        }
      });

      // 5. Chuẩn hóa giá bán (Markup + Service fee) và sắp xếp tăng dần
      const normalizedFares = this.normalizationService.normalizeFares(aggregatedFares);
      const sortedFares = this.normalizationService.sortByCheapest(normalizedFares);

      // 6. Ghi Cache nếu có kết quả hợp lệ với TTL 45 giây[cite: 2]
      if (sortedFares.length > 0) {
        await this.searchCacheService.setDynamicFareCache(query, sortedFares, 45);
      }

      return sortedFares;
    } finally {
      // Dọn dẹp timer để tránh memory leak
      clearTimeout(hardTimeoutTimer);
    }
  }
}
