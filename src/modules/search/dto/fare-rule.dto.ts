/**
 * Chứa thông tin chi tiết điều kiện hoàn, đổi và chính sách vé:
 * 
 * */

import { ApiProperty } from '@nestjs/swagger';

export class FareRuleDto {
  @ApiProperty({ example: 'ECO_STANDARD' })
  fareBasisCode: string;

  @ApiProperty({ example: true })
  isChangeable: boolean;

  @ApiProperty({ example: 350000, description: 'Phí đổi ngày bay trước 24h' })
  changeFee: number;

  @ApiProperty({ example: false })
  isRefundable: boolean;

  @ApiProperty({ example: 500000, description: 'Phí hoàn vé (nếu được phép)' })
  refundFee: number;

  @ApiProperty({ example: 'Hành lý xách tay 12kg, ký gửi 23kg' })
  baggagePolicy: string;

  @ApiProperty({ example: ['Không hỗ trợ đổi tên hành khách', 'Check-in online trước 24h'] })
  conditions: string[];
}