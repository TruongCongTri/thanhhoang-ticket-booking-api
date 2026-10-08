/**
 * 4. Controller phục vụ API
 * Cung cấp endpoint tìm kiếm tích hợp các Decorator giám sát và tài liệu hóa:
 * 
 * */

// src/modules/search/controllers/search.controller.ts
import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FlightAggregatorService } from '../services/flight-aggregator.service';
import { SearchFlightQueryDto } from '../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../dto/unified-flight-result.dto';

@ApiTags('Flight Search & Aggregation')
@Controller({ path: 'search/flights', version: '1' })
export class SearchController {
  constructor(private readonly aggregatorService: FlightAggregatorService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 req/phút cho endpoint tra cứu[cite: 1]
  @ApiOperation({ summary: 'Tìm kiếm chuyến bay đa hãng với cơ chế Scatter-Gather' })
  @ApiResponse({ status: 200, type: [UnifiedFlightSegmentDto] })
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(@Query() query: SearchFlightQueryDto): Promise<UnifiedFlightSegmentDto[]> {
    return this.aggregatorService.aggregate(query);
  }
}