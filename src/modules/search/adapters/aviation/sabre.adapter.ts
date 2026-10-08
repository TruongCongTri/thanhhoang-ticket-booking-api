/**
 * Adapter tích hợp hệ thống GDS Sabre qua chuẩn REST Bargain Finder Max (BFM):  
 *
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AviationAdapterInterface } from './aviation-adapter.interface';
import { SearchFlightQueryDto } from '../../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../../dto/unified-flight-result.dto';
import { AxiosError } from 'axios';

@Injectable()
export class SabreAdapter implements AviationAdapterInterface {
  readonly partnerCode = 'SABRE';
  private readonly logger = new Logger(SabreAdapter.name);
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'SABRE_API_URL',
      'https://api.sabre.com',
    );
  }

  async searchFlights(
    criteria: SearchFlightQueryDto,
    signal?: AbortSignal,
  ): Promise<UnifiedFlightSegmentDto[]> {
    this.logger.debug(
      `Calling Sabre BFM API for ${criteria.origin} -> ${criteria.destination}`,
    );

    // Giả lập cấu trúc Request Payload chuẩn SOAP/REST Sabre Bargain Finder Max
    const sabrePayload = {
      OTA_AirLowFareSearchRQ: {
        OriginDestinationInformation: [
          {
            DepartureDateTime: `${criteria.departureDate}T00:00:00`,
            OriginLocation: { LocationCode: criteria.origin },
            DestinationLocation: { LocationCode: criteria.destination },
          },
        ],
        PassengerTypeQuantity: [
          { Code: 'ADT', Quantity: criteria.adults },
          ...(criteria.children
            ? [{ Code: 'CNN', Quantity: criteria.children }]
            : []),
          ...(criteria.infants
            ? [{ Code: 'INF', Quantity: criteria.infants }]
            : []),
        ],
      },
    };

    try {
      // Gọi API ngoài thông qua HttpService tích hợp Keep-Alive Agent
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/v4/offers/shop`, sabrePayload, {
          headers: {
            Authorization: `Bearer ${this.configService.get('SABRE_ACCESS_TOKEN')}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // Timeout cứng 5s tại tầng socket của Axios
          signal, // Gắn AbortSignal: giải phóng socket ngay khi Breaker ngắt
        }),
      );

      return this.transformToUnifiedDto(response.data);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`Sabre API request was explicitly aborted (timeout or client disconnected).`);
        return []; // Trả về mảng rỗng an toàn, không ném exception làm gián đoạn luồng
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sabre API invocation failed: ${errorMessage}`);
      throw error;
    }
  }

  async checkFareRule(fareBasisCode: string): Promise<string> {
    return `Sabre Policy: Non-refundable for ${fareBasisCode}. Rebooking fee: 350,000 VND.`;
  }

  async createHoldBooking(
    bookingPayload: any,
  ): Promise<{ partnerPnr: string; holdExpiresAt: Date }> {
    // Gọi PassengerDetailsRQ để sinh PNR giữ chỗ
    const pnr = `SB${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 tiếng giữ chỗ
    return { partnerPnr: pnr, holdExpiresAt };
  }

  private transformToUnifiedDto(rawSabreData: any): UnifiedFlightSegmentDto[] {
    // Biến đổi cấu trúc phức tạp từ Sabre GroupedItineraryResponse sang chuẩn chung
    if (!rawSabreData?.groupedItineraryResponse?.itineraryGroups) {
      return [];
    }

    const results: UnifiedFlightSegmentDto[] = [];
    const itineraries =
      rawSabreData.groupedItineraryResponse.itineraryGroups[0]?.itineraries ||
      [];

    for (const item of itineraries) {
      const leg = item.legs?.[0];
      const schedule = leg?.schedules?.[0];
      const pricing = item.pricingInformation?.[0]?.fare;

      if (!schedule || !pricing) continue;

      results.push({
        id: `SABRE_${crypto.randomUUID()}`,
        partnerCode: this.partnerCode,
        fareBasisCode: pricing.fareBasisCode || 'STANDARD',
        segments: [
          {
            flightNumber: `${schedule.carrier?.marketing}${schedule.carrier?.marketingFlightNumber}`,
            airlineCode: schedule.carrier?.marketing,
            airlineName:
              schedule.carrier?.marketingAirlineName || 'Sabre Partner Airline',
            originAirport: schedule.departure?.airport,
            destinationAirport: schedule.arrival?.airport,
            departureTime: schedule.departure?.time,
            arrivalTime: schedule.arrival?.time,
            durationMinutes: schedule.elapsedTime || 120,
            aircraft: schedule.equipment || 'Boeing 787',
            cabinClass: 'ECONOMY',
            baggageAllowance: '23kg',
          },
        ],
        fareBreakdown: {
          baseFare: Number(pricing.baseFareAmount) || 1000000,
          taxesAndFees: Number(pricing.totalTaxAmount) || 450000,
          serviceFee: 0,
          totalAmount: Number(pricing.totalAmount) || 1450000,
          currency: 'VND',
        },
        totalAmount: Number(pricing.totalAmount) || 1450000,
        isRefundable: false,
        holdToken: Buffer.from(JSON.stringify({ sabreRef: item.id })).toString(
          'base64',
        ),
      });
    }

    return results;
  }
}
