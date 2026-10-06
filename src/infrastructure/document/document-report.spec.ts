import { PdfGeneratorService, stripDiacritics } from './services/pdf-generator.service';

describe('DocumentReportModule (Enterprise PDF & Excel Suite)', () => {
  let pdfService: PdfGeneratorService;

  beforeEach(() => {
    pdfService = new PdfGeneratorService();
  });

  it('should render valid PDF buffer for flight ticket containing booking data', async () => {
    const pdfBuffer = await pdfService.generateTicketPdfBuffer({
      bookingReference: 'BK-12345',
      passengerName: 'Nguyen Van A',
      flightCode: 'VN123',
      departureAirport: 'SGN',
      arrivalAirport: 'HAN',
      departureTime: '2026-11-20 08:00',
      seatNumber: '12A',
      ticketClass: 'ECONOMY',
      totalAmountVnd: 2500000,
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(500); // File PDF chuẩn
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-'); // PDF magic header
  });

  it('should strip Vietnamese diacritics when no Unicode font is configured', () => {
    expect(stripDiacritics('Vé máy bay điện tử - Đà Nẵng')).toBe('Ve may bay dien tu - Da Nang');
  });

  it('should upload the rendered ticket privately and return a presigned download URL', async () => {
    const storage = {
      uploadBuffer: jest.fn().mockResolvedValue({ fileKey: 'tenants/t1/private/tickets/2026/10/x_e-ticket-BK-1.pdf' }),
      generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3/presigned'),
    } as any;
    const service = new PdfGeneratorService(undefined, storage);

    const result = await service.generateTicketPdfAndUpload({
      bookingReference: 'BK-1',
      passengerName: 'Tran Thi B',
      flightCode: 'VJ456',
      departureAirport: 'HAN',
      arrivalAirport: 'DAD',
      departureTime: '2026-12-01 09:00',
      seatNumber: '3C',
      ticketClass: 'BUSINESS',
      totalAmountVnd: 4200000,
    });

    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      'e-ticket-BK-1.pdf',
      expect.objectContaining({ contentType: 'application/pdf', visibility: 'private' }),
    );
    expect(result.downloadUrl).toBe('https://s3/presigned');
  });
});

// npx jest src/infrastructure/document/document-report.spec.ts 