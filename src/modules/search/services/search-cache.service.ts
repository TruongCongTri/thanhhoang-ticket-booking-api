/**
 * 3. Bộ nhớ đệm động và chuẩn hóa Cache Key
 * Dùng hàm băm MD5/SHA256 để định danh tiêu chí truy vấn:
 * 
 * */

// src/modules/search/services/search-cache.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SearchFlightQueryDto } from '../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../dto/unified-flight-result.dto';

@Injectable()
export class SearchCacheService {
  constructor(private readonly redisClient: any /* Inject từ CacheModule/Redis */) {}

  private generateKey(query: SearchFlightQueryDto): string {
    const raw = `${query.origin}:${query.destination}:${query.departureDate}:${query.adults}:${query.children}:${query.cabinClass}`;
    const hash = crypto.createHash('md5').update(raw).digest('hex');
    return `cache:flight_search:${hash}`;
  }

  async getDynamicFareCache(query: SearchFlightQueryDto): Promise<UnifiedFlightSegmentDto[] | null> {
    const key = this.generateKey(query);
    const data = await this.redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setDynamicFareCache(
    query: SearchFlightQueryDto,
    results: UnifiedFlightSegmentDto[],
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.generateKey(query);
    await this.redisClient.set(key, JSON.stringify(results), 'EX', ttlSeconds);
  }
}