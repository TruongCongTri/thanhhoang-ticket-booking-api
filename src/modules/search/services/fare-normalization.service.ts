/**
 * Đảm nhận việc cộng phụ phí đại lý, quy đổi tiền tệ và tính toán giá vốn/giá bán:   
 * 
 * */ 

import { Injectable } from '@nestjs/common';
import { UnifiedFlightSegmentDto } from '../dto/unified-flight-result.dto';

@Injectable()
export class FareNormalizationService {
  // Biên lợi nhuận cấu hình tĩnh hoặc lấy từ Database
  private readonly DEFAULT_MARKUP_RATE = 0.03; // 3%
  private readonly FIXED_SERVICE_FEE = 30000; // 30,000 VND

  /**
   * Chuẩn hóa bảng giá: Tách bạch Giá vốn (Cost Price) và Giá bán (Selling Price)
   */
  normalizeFares(rawOffers: UnifiedFlightSegmentDto[]): UnifiedFlightSegmentDto[] {
    return rawOffers.map((offer) => {
      const baseFare = offer.fareBreakdown.baseFare;
      const taxesAndFees = offer.fareBreakdown.taxesAndFees;
      const costPrice = baseFare + taxesAndFees;

      // Tính giá bán sau khi áp Markup và Service Fee
      const markupAmount = Math.round(costPrice * this.DEFAULT_MARKUP_RATE);
      const serviceFee = this.FIXED_SERVICE_FEE + markupAmount;
      const sellingPrice = costPrice + serviceFee;

      return {
        ...offer,
        totalAmount: sellingPrice,
        fareBreakdown: {
          ...offer.fareBreakdown,
          serviceFee,
          totalAmount: sellingPrice,
        },
      };
    });
  }

  /**
   * Sắp xếp kết quả trả về theo giá tăng dần
   */
  sortByCheapest(offers: UnifiedFlightSegmentDto[]): UnifiedFlightSegmentDto[] {
    return offers.sort((a, b) => a.totalAmount - b.totalAmount);
  }
}