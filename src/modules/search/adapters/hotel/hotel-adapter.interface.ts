/**
 * Chuẩn hóa các phương thức kết nối tới các nhà cung cấp phòng khách sạn:
 *
 * */

export interface SearchHotelCriteria {
  destinationCode: string;
  checkInDate: string;
  checkOutDate: string;
  roomsCount: number;
  adultsCount: number;
}

export interface UnifiedHotelRoomDto {
  hotelId: string;
  partnerCode: string;
  hotelName: string;
  roomType: string;
  rateKey: string;
  pricePerNight: number;
  totalAmount: number;
  currency: string;
  isFreeCancellation: boolean;
  cancellationDeadline?: string;
}

export interface HotelAdapterInterface {
  readonly partnerCode: string; // 'HOTELBEDS' | 'AGODA'[cite: 2]

  searchHotels(
    criteria: SearchHotelCriteria,
    signal?: AbortSignal,
  ): Promise<UnifiedHotelRoomDto[]>;

  checkRoomAvailability(
    rateKey: string,
    signal?: AbortSignal,
  ): Promise<boolean>;
  
  createHoldReservation(
    reservationPayload: any,
  ): Promise<{ reservationId: string; holdExpiresAt: Date }>;
}
