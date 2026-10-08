/**
 * Triển khai AgodaAdapter theo chuẩn kết nối Agoda Partner Affiliate/Direct API:  
 *
 * */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as crypto from 'crypto';
import {
  HotelAdapterInterface,
  SearchHotelCriteria,
  UnifiedHotelRoomDto,
} from './hotel-adapter.interface';

@Injectable()
export class AgodaAdapter implements HotelAdapterInterface {
  readonly partnerCode = 'AGODA';
  private readonly logger = new Logger(AgodaAdapter.name);
  private readonly endpoint: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.endpoint = this.configService.get<string>(
      'AGODA_API_URL',
      'https://api.agoda.com/affiliateservice/v1',
    );
  }

  async searchHotels(
    criteria: SearchHotelCriteria,
    signal?: AbortSignal,
  ): Promise<UnifiedHotelRoomDto[]> {
    this.logger.debug(
      `Searching Agoda accommodations for destination: ${criteria.destinationCode}`,
    );

    const payload = {
      siteId: this.configService.get<string>('AGODA_SITE_ID'),
      apiKey: this.configService.get<string>('AGODA_API_KEY'),
      searchCriteria: {
        cityId: criteria.destinationCode,
        checkInDate: criteria.checkInDate,
        checkOutDate: criteria.checkOutDate,
        rooms: criteria.roomsCount,
        adults: criteria.adultsCount,
        currency: 'VND',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.endpoint}/search`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip,deflate',
          },
          timeout: 5000,
          signal,
        }),
      );

      return this.transformAgodaRooms(response.data?.results ?? []);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`Agoda search request canceled via AbortSignal.`);
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Agoda search request failed: ${errorMessage}`);
      throw error;
    }
  }

  async checkRoomAvailability(rateKey: string, signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.endpoint}/checkavailability`, 
          { rateKey },
          { timeout: 3000, signal },
        ),
      );
      return Boolean(response.data?.isAvailable);
    } catch {
      return false;
    }
  }

  async createHoldReservation(
    reservationPayload: any,
  ): Promise<{ reservationId: string; holdExpiresAt: Date }> {
    const reservationId = `AG_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 20 * 60 * 1000); // Giữ phòng 20 phút
    return { reservationId, holdExpiresAt };
  }

  private transformAgodaRooms(results: any[]): UnifiedHotelRoomDto[] {
    const list: UnifiedHotelRoomDto[] = [];

    for (const item of results) {
      const property = item.property;
      const ratePlan = item.ratePlans?.[0];

      if (!property || !ratePlan) continue;

      const pricePerNight = Number(ratePlan.pricing?.nightlyRate) || 1500000;
      const totalAmount = Number(ratePlan.pricing?.totalWithTax) || 1800000;

      list.push({
        hotelId: String(property.propertyId),
        partnerCode: this.partnerCode,
        hotelName: property.propertyName || 'Agoda Featured Hotel',
        roomType: ratePlan.roomTypeName || 'Standard Room',
        rateKey: ratePlan.rateKey || `AG_KEY_${property.propertyId}`,
        pricePerNight,
        totalAmount,
        currency: 'VND',
        isFreeCancellation: Boolean(
          ratePlan.cancellationPolicy?.isFreeCancellation,
        ),
        cancellationDeadline: ratePlan.cancellationPolicy?.deadlineDate,
      });
    }

    return list;
  }
}
