/**
 * 1. Định nghĩa Chuẩn Adapter (AviationAdapterInterface)
 * Chuẩn hóa giao diện kết nối để hệ thống không phụ thuộc vào định dạng XML, SOAP hay REST riêng biệt của từng hãng:   
 * 
 * */ 

import { SearchFlightQueryDto } from '../../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../../dto/unified-flight-result.dto';

export interface AviationAdapterInterface {
  readonly partnerCode: string; // 'SABRE' | 'AMADEUS' | 'VIETJET'

  /**
   * @param criteria Tiêu chí tìm kiếm
   * @param signal Tín hiệu Abort để ngắt TCP connection ngay khi chạm timeout
   */
  searchFlights(
    criteria: SearchFlightQueryDto, 
    signal?: AbortSignal,
  ): Promise<UnifiedFlightSegmentDto[]>;
  
  checkFareRule(fareBasisCode: string): Promise<string>;
  createHoldBooking(bookingPayload: any): Promise<{ partnerPnr: string; holdExpiresAt: Date }>;
}