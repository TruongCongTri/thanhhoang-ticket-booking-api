/**
 * Adapter tích hợp hệ thống GDS Amadeus qua Flight Offers Search API:  
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
export class AmadeusAdapter implements AviationAdapterInterface {
  readonly partnerCode = 'AMADEUS';
  private readonly logger = new Logger(AmadeusAdapter.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'AMADEUS_API_URL',
      'https://api.amadeus.com',
    );
  }

  async searchFlights(
    criteria: SearchFlightQueryDto,
    signal?: AbortSignal,
  ): Promise<UnifiedFlightSegmentDto[]> {
    this.logger.debug(
      `Calling Amadeus Flight Offers API for ${criteria.origin} -> ${criteria.destination}`,
    );

    const params = {
      originLocationCode: criteria.origin,
      destinationLocationCode: criteria.destination,
      departureDate: criteria.departureDate,
      adults: criteria.adults,
      children: criteria.children,
      infants: criteria.infants,
      travelClass: criteria.cabinClass,
      currencyCode: 'VND',
      max: 50,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v2/shopping/flight-offers`, {
          params,
          headers: {
            Authorization: `Bearer ${this.configService.get('AMADEUS_ACCESS_TOKEN')}`,
          },
          timeout: 5000,
          signal,
        }),
      );

      return this.transformOffers(response.data?.data ?? []);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`Amadeus API call canceled via AbortSignal.`);
        return [];
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Amadeus API call failed: ${errorMessage}`);
      throw error;
    }
  }

  async checkFareRule(fareBasisCode: string): Promise<string> {
    return `Amadeus Rule: Carrier conditions applied for basis ${fareBasisCode}`;
  }

  async createHoldBooking(
    bookingPayload: any,
  ): Promise<{ partnerPnr: string; holdExpiresAt: Date }> {
    const pnr = `1A${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return { partnerPnr: pnr, holdExpiresAt };
  }

  private transformOffers(offers: any[]): UnifiedFlightSegmentDto[] {
    return offers.map((offer) => {
      const itinerary = offer.itineraries?.[0];
      const segment = itinerary?.segments?.[0];
      const price = offer.price;

      return {
        id: `AMADEUS_${offer.id}`,
        partnerCode: this.partnerCode,
        fareBasisCode: offer.pricingOptions?.fareType?.[0] || 'PUBLISHED',
        segments: [
          {
            flightNumber: `${segment?.carrierCode}${segment?.number}`,
            airlineCode: segment?.carrierCode || 'VN',
            airlineName: 'Partner Airline',
            originAirport: segment?.departure?.iataCode,
            destinationAirport: segment?.arrival?.iataCode,
            departureTime: segment?.departure?.at,
            arrivalTime: segment?.arrival?.at,
            durationMinutes: 130,
            aircraft: segment?.aircraft?.code || 'A321',
            cabinClass: 'ECONOMY',
            baggageAllowance: '1 kiện 23kg',
          },
        ],
        fareBreakdown: {
          baseFare: Number(price?.base) || 1100000,
          taxesAndFees: Number(price?.total) - Number(price?.base) || 400000,
          serviceFee: 0,
          totalAmount: Number(price?.total) || 1500000,
          currency: price?.currency || 'VND',
        },
        totalAmount: Number(price?.total) || 1500000,
        isRefundable: offer.pricingOptions?.refundableFare || false,
        holdToken: Buffer.from(JSON.stringify({ offerId: offer.id })).toString(
          'base64',
        ),
      };
    });
  }
}
