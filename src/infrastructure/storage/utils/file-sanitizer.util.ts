/**
 * Chống tấn công Path Traversal, file thực thi trá hình và kiến tạo đường dẫn cô lập theo từng Tenant:
 *
 */

import { randomUUID } from 'crypto';
import { extname, basename } from 'path';
import { FileVisibility } from '../interfaces/storage.interface';

/** Whitelist Content-Type → phần mở rộng hợp lệ tương ứng */
const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], // .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], // .docx
};

export class FileSanitizerUtil {
  /**
   * Làm sạch tên file, loại bỏ ký tự lạ và đường dẫn tương đối (Path Traversal defense)
   */
  static sanitizeFileName(rawName: string): string {
    // Chuẩn hóa cả dấu "\" (đường dẫn Windows) trước khi lấy basename
    const base = basename(rawName.replace(/\\/g, '/'));
    // Chỉ giữ lại chữ cái, số, dấu gạch ngang, gạch dưới và dấu chấm; không cho tên bắt đầu bằng '.'
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
    return cleaned.slice(-150) || 'file';
  }

  /**
   * Kiểm tra Content-Type có nằm trong danh mục an toàn
   */
  static validateContentType(contentType: string): void {
    if (!ALLOWED_TYPES[contentType.toLowerCase()]) {
      throw new Error(`Content-Type '${contentType}' is not permitted for storage upload.`);
    }
  }

  /**
   * Ép phần mở rộng khớp Content-Type (chặn "invoice.pdf.exe", "avatar.php" khai báo image/png)
   */
  static assertExtensionMatchesContentType(fileName: string, contentType: string): void {
    FileSanitizerUtil.validateContentType(contentType);
    const extension = extname(FileSanitizerUtil.sanitizeFileName(fileName)).toLowerCase();
    if (!ALLOWED_TYPES[contentType.toLowerCase()].includes(extension)) {
      throw new Error(`File extension '${extension || '(none)'}' does not match Content-Type '${contentType}'.`);
    }
  }

  /**
   * Tạo Object Key có cấu trúc phân tầng thời gian và cô lập theo Tenant
   * Cấu trúc: tenants/{tenantId}/{visibility}/{category}/{YYYY}/{MM}/{uniqueId}_{sanitizedName}
   */
  static buildObjectKey(
    tenantId: string,
    visibility: FileVisibility,
    category: string,
    rawFileName: string,
  ): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '_') || 'general';
    const cleanName = this.sanitizeFileName(rawFileName);
    const uniquePrefix = randomUUID().slice(0, 8);

    return `tenants/${safeTenant}/${visibility}/${safeCategory}/${year}/${month}/${uniquePrefix}_${cleanName}`;
  }
}
