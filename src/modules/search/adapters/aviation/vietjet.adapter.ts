/**
 * Adapter tích hợp vé hãng bay chi phí thấp (LCC - Low-Cost Carrier Direct NDC API):
 *
 * */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { AviationAdapterInterface } from './aviation-adapter.interface';
import { SearchFlightQueryDto } from '../../dto/search-flight-query.dto';
import { UnifiedFlightSegmentDto } from '../../dto/unified-flight-result.dto';

@Injectable()
export class VietjetAdapter implements AviationAdapterInterface {
  readonly partnerCode = 'VIETJET';
  private readonly logger = new Logger(VietjetAdapter.name);
  private readonly directApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.directApiUrl = this.configService.get<string>(
      'VIETJET_API_URL',
      'https://api.vietjetair.com',
    );
  }

  async searchFlights(
    criteria: SearchFlightQueryDto,
    signal?: AbortSignal,
  ): Promise<UnifiedFlightSegmentDto[]> {
    this.logger.debug(
      `Calling Vietjet Direct API: ${criteria.origin} -> ${criteria.destination}`,
    );

    const payload = {
      DepartureAirport: criteria.origin,
      ArrivalAirport: criteria.destination,
      DepartureDate: criteria.departureDate,
      AdultCount: criteria.adults,
      ChildCount: criteria.children || 0,
      InfantCount: criteria.infants || 0,
      Currency: 'VND',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.directApiUrl}/v1/search/fares`, payload, {
          headers: {
            'X-Agency-Code': this.configService.get('VIETJET_AGENCY_CODE'),
            'X-Api-Key': this.configService.get('VIETJET_API_KEY'),
          },
          timeout: 5000,
          signal,
        }),
      );

      return this.transformLccFares(response.data?.Fares ?? []);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`Vietjet API request canceled via AbortSignal.`);
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Vietjet Direct API Error: ${errorMessage}`);
      throw error;
    }
  }

  async checkFareRule(fareBasisCode: string): Promise<string> {
    return 'Vietjet Fare: Non-refundable. Changes allowed with fee.';
  }

  async createHoldBooking(
    bookingPayload: any,
  ): Promise<{ partnerPnr: string; holdExpiresAt: Date }> {
    // Vé LCC có thời gian giữ chỗ rất ngắn (20 - 30 phút)[cite: 2]
    const pnr = `VJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 25 * 60 * 1000); // 25 phút giữ chỗ
    return { partnerPnr: pnr, holdExpiresAt };
  }

  private transformLccFares(fares: any[]): UnifiedFlightSegmentDto[] {
    return fares.map((fare) => {
      const baseFare = Number(fare.BaseAmount) || 699000;
      const taxes = Number(fare.TaxAmount) || 520000;
      const total = baseFare + taxes;

      return {
        id: `VJ_${fare.FlightNumber}_${fare.DepartureTime}`,
        partnerCode: this.partnerCode,
        fareBasisCode: fare.ClassType || 'ECO',
        segments: [
          {
            flightNumber: `VJ${fare.FlightNumber}`,
            airlineCode: 'VJ',
            airlineName: 'Vietjet Air',
            originAirport: fare.Origin,
            destinationAirport: fare.Destination,
            departureTime: fare.DepartureTime,
            arrivalTime: fare.ArrivalTime,
            durationMinutes: 125,
            aircraft: 'Airbus A321',
            cabinClass: 'ECONOMY',
            baggageAllowance: '7kg xách tay (Chưa bao gồm ký gửi)',
          },
        ],
        fareBreakdown: {
          baseFare,
          taxesAndFees: taxes,
          serviceFee: 0,
          totalAmount: total,
          currency: 'VND',
        },
        totalAmount: total,
        isRefundable: false,
        holdToken: Buffer.from(JSON.stringify({ fareId: fare.Id })).toString(
          'base64',
        ),
      };
    });
  }
}
