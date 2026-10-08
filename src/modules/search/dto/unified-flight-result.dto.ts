/**
 * Chuẩn hóa Schema nội bộ duy nhất đại diện cho một hành trình bay từ mọi đối tác:   
 * 
 * */ 

import { ApiProperty } from '@nestjs/swagger';

export class FlightSegmentDto {
  @ApiProperty({ example: 'VN214' })
  flightNumber: string;

  @ApiProperty({ example: 'VN' })
  airlineCode: string;

  @ApiProperty({ example: 'Vietnam Airlines' })
  airlineName: string;

  @ApiProperty({ example: 'SGN' })
  originAirport: string;

  @ApiProperty({ example: 'HAN' })
  destinationAirport: string;

  @ApiProperty({ example: '2026-11-20T06:00:00.000Z' })
  departureTime: string;

  @ApiProperty({ example: '2026-11-20T08:15:00.000Z' })
  arrivalTime: string;

  @ApiProperty({ example: 135, description: 'Thời lượng bay (phút)' })
  durationMinutes: number;

  @ApiProperty({ example: 'Airbus A350' })
  aircraft: string;

  @ApiProperty({ example: 'ECONOMY' })
  cabinClass: string;

  @ApiProperty({ example: '23kg kiện ký gửi' })
  baggageAllowance: string;
}

export class FareBreakdownDto {
  @ApiProperty({ example: 1200000, description: 'Giá vé cơ sở chưa thuế phí' })
  baseFare: number;

  @ApiProperty({ example: 450000, description: 'Tổng thuế, phí sân bay và phụ thu' })
  taxesAndFees: number;

  @ApiProperty({ example: 50000, description: 'Phí dịch vụ đại lý' })
  serviceFee: number;

  @ApiProperty({ example: 1700000, description: 'Tổng tiền thanh toán cuối cùng' })
  totalAmount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;
}

export class UnifiedFlightSegmentDto {
  @ApiProperty({ description: 'ID duy nhất sinh ra để định danh chặng bay trong phiên làm việc' })
  id: string;

  @ApiProperty({ example: 'SABRE', description: 'Mã đối tác cung cấp dữ liệu' })
  partnerCode: string;

  @ApiProperty({ example: 'ECO_FLEX_VN', description: 'Mã cơ sở giá vé' })
  fareBasisCode: string;

  @ApiProperty({ type: [FlightSegmentDto], description: 'Danh sách các chặng bay (nếu nối chuyến)' })
  segments: FlightSegmentDto[];

  @ApiProperty({ type: FareBreakdownDto })
  fareBreakdown: FareBreakdownDto;

  @ApiProperty({ example: 1700000 })
  totalAmount: number;

  @ApiProperty({ example: true, description: 'Vé có được phép hoàn hủy hay không' })
  isRefundable: boolean;

  @ApiProperty({ description: 'Dữ liệu thô dùng cho bước giữ chỗ tiếp theo' })
  holdToken: string;
}