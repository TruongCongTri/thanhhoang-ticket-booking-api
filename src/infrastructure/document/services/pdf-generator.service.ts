/**
 * Kết xuất vé điện tử / chứng từ PDF bằng pdfkit:
 *  - Font Unicode nhúng (PDF_FONT_PATH, vd NotoSans-Regular.ttf) để hiển thị đúng tiếng Việt có dấu;
 *    14 font chuẩn của PDF (Helvetica) chỉ hỗ trợ bảng mã WinAnsi → mất dấu.
 *  - generateTicketPdfAndUpload(): đẩy thẳng lên Object Storage (private) và trả Presigned URL,
 *    không ghi file rác vào filesystem của Pod.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { existsSync } from 'fs';
import PDFDocument from 'pdfkit';
import { TicketPdfPayload } from '../interfaces/document.interface';
import { AppConfigService } from '../../../core/config/app-config.service';
import { S3StorageService } from '../../storage/services/s3-storage.service';
import { FileVisibility } from '../../storage/interfaces/storage.interface';

const REGULAR_FONT = 'AppRegular';
const BOLD_FONT = 'AppBold';

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly fontPath?: string;
  private readonly boldFontPath?: string;

  constructor(
    @Optional() config?: AppConfigService,
    @Optional() private readonly storage?: S3StorageService,
  ) {
    const pdf = config?.pdf;
    this.fontPath = pdf?.fontPath && existsSync(pdf.fontPath) ? pdf.fontPath : undefined;
    this.boldFontPath = pdf?.boldFontPath && existsSync(pdf.boldFontPath) ? pdf.boldFontPath : this.fontPath;

    if (pdf?.fontPath && !this.fontPath) {
      this.logger.warn(`PDF_FONT_PATH '${pdf.fontPath}' does not exist; falling back to Helvetica (no Vietnamese diacritics).`);
    }
  }

  /**
   * Tạo tệp PDF vé điện tử dạng Buffer phục vụ lưu trữ S3 hoặc gửi email đính kèm
   */
  async generateTicketPdfBuffer(data: TicketPdfPayload): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `E-Ticket ${data.bookingReference}` } });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        this.logger.debug(`[PdfGenerator] Rendered PDF ticket for ${data.bookingReference} (${pdfData.length} bytes)`);
        resolve(pdfData);
      });
      doc.on('error', reject);

      const unicode = !!this.fontPath;
      if (unicode) {
        doc.registerFont(REGULAR_FONT, this.fontPath!);
        doc.registerFont(BOLD_FONT, this.boldFontPath!);
      }
      const regular = unicode ? REGULAR_FONT : 'Helvetica';
      const bold = unicode ? BOLD_FONT : 'Helvetica-Bold';
      // Không có font Unicode → bỏ dấu tiếng Việt thay vì in ký tự lỗi
      const t = (text: string) => (unicode ? text : stripDiacritics(text));

      // Tiêu đề
      doc.font(bold).fontSize(20).text(t('ELECTRONIC FLIGHT TICKET / VÉ MÁY BAY ĐIỆN TỬ'), { align: 'center' });
      doc.moveDown();

      // Thông tin chi tiết vé
      doc.font(regular).fontSize(12).text(t(`Booking Reference (Mã đặt chỗ): ${data.bookingReference}`));
      doc.text(t(`Passenger (Hành khách): ${data.passengerName}`));
      doc.text(t(`Flight (Chuyến bay): ${data.flightCode}`));
      doc.text(t(`Route (Hành trình): ${data.departureAirport} -> ${data.arrivalAirport}`));
      doc.text(t(`Departure Time (Giờ khởi hành): ${data.departureTime}`));
      doc.text(t(`Seat (Ghế): ${data.seatNumber} (${data.ticketClass})`));
      doc.moveDown();

      // Giá vé
      doc
        .font(bold)
        .fontSize(14)
        .text(t(`Total Paid (Tổng thanh toán): ${data.totalAmountVnd.toLocaleString('vi-VN')} VND`));
      doc.moveDown();

      doc
        .font(regular)
        .fontSize(10)
        .fillColor('gray')
        .text('This is an automated valid digital ticket. Please present at check-in counter.');

      doc.end();
    });
  }

  /**
   * Kết xuất và lưu vé vào Object Storage (private), trả về key + URL tải có thời hạn
   */
  async generateTicketPdfAndUpload(data: TicketPdfPayload): Promise<{ fileKey: string; downloadUrl: string }> {
    if (!this.storage) {
      throw new Error('Object storage is not available for PDF upload.');
    }
    const buffer = await this.generateTicketPdfBuffer(data);
    const { fileKey } = await this.storage.uploadBuffer(buffer, `e-ticket-${data.bookingReference}.pdf`, {
      contentType: 'application/pdf',
      category: 'tickets',
      visibility: FileVisibility.PRIVATE,
    });
    const downloadUrl = await this.storage.generatePresignedDownloadUrl(fileKey, {
      responseContentDisposition: `attachment; filename="e-ticket-${data.bookingReference}.pdf"`,
    });
    return { fileKey, downloadUrl };
  }
}

/** "Vé máy bay điện tử" → "Ve may bay dien tu" (fallback khi không có font Unicode) */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
