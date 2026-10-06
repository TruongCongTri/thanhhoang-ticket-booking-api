export interface ExcelColumnDefinition {
  header: string;
  key: string;
  width?: number;
}

export interface TicketPdfPayload {
  bookingReference: string;
  passengerName: string;
  flightCode: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  seatNumber: string;
  ticketClass: string;
  totalAmountVnd: number;
}