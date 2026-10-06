/**
 * Biên dịch nội dung mẫu an toàn, hỗ trợ truy xuất biến lồng nhau ({{booking.code}}) và tự động escape HTML:   
 * 
 * */ 

import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateRendererService {
  private readonly templateRegistry = new Map<string, { subject?: string; template: string }>();

  constructor() {
    // Đăng ký sẵn một số mẫu hệ thống mặc định
    this.registerTemplate('OTP_VERIFICATION', {
      subject: 'Mã xác thực OTP của bạn',
      template: 'Mã OTP của bạn là: {{otp}}. Mã có hiệu lực trong {{expiresInMinutes}} phút.',
    });

    this.registerTemplate('BOOKING_SUCCESS', {
      subject: 'Xác nhận đặt vé thành công: {{booking.reference}}',
      template: 'Chào {{user.name}}, đơn đặt vé {{booking.reference}} trị giá {{booking.totalAmount}} VND đã hoàn tất.',
    });
  }

  registerTemplate(name: string, config: { subject?: string; template: string }): void {
    this.templateRegistry.set(name, config);
  }

  /**
   * Biên dịch template với dữ liệu context (hỗ trợ nested properties)
   */
  render(templateStr: string, context: Record<string, any> = {}): string {
    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
      const val = this.resolvePath(context, path);
      if (val === undefined || val === null) {
        return '';
      }
      return this.escapeHtml(String(val));
    });
  }

  renderByTemplateName(
    templateName: string,
    context: Record<string, any> = {},
  ): { subject?: string; content: string } {
    const record = this.templateRegistry.get(templateName);
    if (!record) {
      throw new Error(`Notification template '${templateName}' not found in registry.`);
    }

    const subject = record.subject ? this.render(record.subject, context) : undefined;
    const content = this.render(record.template, context);

    return { subject, content };
  }

  private resolvePath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}