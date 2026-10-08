/**
 * Triển khai Adapter kết nối Hotelbeds BedBank:
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
export class HotelbedsAdapter implements HotelAdapterInterface {
  readonly partnerCode = 'HOTELBEDS';
  private readonly logger = new Logger(HotelbedsAdapter.name);
  private readonly endpoint: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.endpoint = this.configService.get<string>(
      'HOTELBEDS_URL',
      'https://api.hotelbeds.com/hotel-api/1.0',
    );
  }

  private generateSignature(): string {
    const apiKey = this.configService.get<string>('HOTELBEDS_API_KEY', '');
    const secret = this.configService.get<string>('HOTELBEDS_SECRET', '');
    const timestamp = Math.floor(Date.now() / 1000);
    return crypto
      .createHash('sha256')
      .update(apiKey + secret + timestamp)
      .digest('hex');
  }

  async searchHotels(
    criteria: SearchHotelCriteria,
    signal?: AbortSignal,
  ): Promise<UnifiedHotelRoomDto[]> {
    this.logger.debug(`Searching Hotelbeds in ${criteria.destinationCode}`);

    const payload = {
      stay: { checkIn: criteria.checkInDate, checkOut: criteria.checkOutDate },
      occupancies: [
        { rooms: criteria.roomsCount, adults: criteria.adultsCount },
      ],
      destination: { code: criteria.destinationCode },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.endpoint}/hotels`, payload, {
          headers: {
            'Api-key': this.configService.get('HOTELBEDS_API_KEY'),
            'X-Signature': this.generateSignature(),
            Accept: 'application/json',
          },
          timeout: 5000,
          signal,
        }),
      );

      return this.transformHotelRooms(response.data?.hotels?.hotels ?? []);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') {
        this.logger.warn(`Hotelbeds search canceled via AbortSignal.`);
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Hotelbeds search failed: ${errorMessage}`);
      throw error;
    }
  }

  async checkRoomAvailability(rateKey: string, signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.endpoint}/checkrates`, { rateKey }, {
          headers: {
            'Api-key': this.configService.get('HOTELBEDS_API_KEY'),
            'X-Signature': this.generateSignature(),
          },
          timeout: 3000,
          signal,
        }),
      );
      return Boolean(response.data?.hotel?.rooms?.[0]?.rates?.[0]);
    } catch {
      return false;
    }
  }

  async createHoldReservation(
    reservationPayload: any,
  ): Promise<{ reservationId: string; holdExpiresAt: Date }> {
    const reservationId = `HB_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return { reservationId, holdExpiresAt };
  }

  private transformHotelRooms(hotels: any[]): UnifiedHotelRoomDto[] {
    const list: UnifiedHotelRoomDto[] = [];

    for (const h of hotels) {
      const room = h.rooms?.[0];
      const rate = room?.rates?.[0];
      if (!rate) continue;

      list.push({
        hotelId: String(h.code),
        partnerCode: this.partnerCode,
        hotelName: h.name || 'International Luxury Hotel',
        roomType: room.name || 'Deluxe Double Room',
        rateKey: rate.rateKey,
        pricePerNight: Number(rate.net) || 1200000,
        totalAmount: Number(rate.net) || 1200000,
        currency: 'VND',
        isFreeCancellation: rate.cancellationPolicies?.[0]?.amount === 0,
        cancellationDeadline: rate.cancellationPolicies?.[0]?.from,
      });
    }

    return list;
  }
}
