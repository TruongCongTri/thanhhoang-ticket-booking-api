/**
 * Triển khai AirAsiaAdapter kết nối trực tiếp đến hệ thống API của AirAsia
 * (dựa trên nền tảng Navitaire NewSkies dành cho hãng giá rẻ):
 *
 * */

// src/modules/search/adapters/aviation/airasia.adapter.ts
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
export class AirAsiaAdapter implements AviationAdapterInterface {
  readonly partnerCode = 'AIRASIA';
  private readonly logger = new Logger(AirAsiaAdapter.name);
  private readonly apiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'AIRASIA_API_URL',
      'https://api.airasia.com/v2',
    );
  }

  async searchFlights(
    criteria: SearchFlightQueryDto,
    signal?: AbortSignal,
  ): Promise<UnifiedFlightSegmentDto[]> {
    this.logger.debug(
      `Searching AirAsia flights: ${criteria.origin} -> ${criteria.destination}`,
    );

    const payload = {
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate,
      passengers: {
        adults: criteria.adults,
        children: criteria.children ?? 0,
        infants: criteria.infants ?? 0,
      },
      currency: 'VND',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/flights/search`, payload, {
          headers: {
            Authorization: `Bearer ${this.configService.get('AIRASIA_API_TOKEN')}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
          signal,
        }),
      );

      return this.transformAirAsiaFares(response.data?.data?.journeys ?? []);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`AirAsia API search canceled via AbortSignal.`);
        return [];
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`AirAsia API search failed: ${errorMessage}`);
      throw error;
    }
  }

  async checkFareRule(fareBasisCode: string): Promise<string> {
    return `AirAsia Policy: Non-refundable for [${fareBasisCode}]. Change fee applies.`;
  }

  async createHoldBooking(
    bookingPayload: any,
  ): Promise<{ partnerPnr: string; holdExpiresAt: Date }> {
    // AirAsia LCC giữ chỗ ngắn hạn (khoảng 30 phút)
    const pnr = `AK${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return { partnerPnr: pnr, holdExpiresAt };
  }

  private transformAirAsiaFares(journeys: any[]): UnifiedFlightSegmentDto[] {
    const results: UnifiedFlightSegmentDto[] = [];

    for (const journey of journeys) {
      const flight = journey.flights?.[0];
      const fare = journey.fares?.[0];

      if (!flight || !fare) continue;

      const baseFare = Number(fare.baseAmount) || 850000;
      const taxesAndFees = Number(fare.taxAmount) || 480000;
      const totalAmount = baseFare + taxesAndFees;

      results.push({
        id: `AK_${flight.flightNumber}_${flight.departureTime}`,
        partnerCode: this.partnerCode,
        fareBasisCode: fare.fareClass || 'LOWFARE',
        segments: [
          {
            flightNumber: `${flight.carrierCode}${flight.flightNumber}`,
            airlineCode: flight.carrierCode || 'AK',
            airlineName: 'AirAsia',
            originAirport: flight.departureAirport,
            destinationAirport: flight.arrivalAirport,
            departureTime: flight.departureTime,
            arrivalTime: flight.arrivalTime,
            durationMinutes: flight.durationMinutes || 120,
            aircraft: flight.aircraftType || 'Airbus A320',
            cabinClass: 'ECONOMY',
            baggageAllowance: '7kg cabin baggage included',
          },
        ],
        fareBreakdown: {
          baseFare,
          taxesAndFees,
          serviceFee: 0,
          totalAmount,
          currency: 'VND',
        },
        totalAmount,
        isRefundable: false,
        holdToken: Buffer.from(
          JSON.stringify({ journeyId: journey.id, fareKey: fare.fareKey }),
        ).toString('base64'),
      });
    }

    return results;
  }
}
