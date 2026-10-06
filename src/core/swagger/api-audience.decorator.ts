import { applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export type ApiAudienceType = 'client' | 'partner' | 'internal';

export const API_AUDIENCE_EXTENSION = 'x-audience';

/**
 * Phân loại đối tượng sử dụng API để sinh tài liệu riêng:
 *   /docs/client  (Mobile/Web), /docs/partner (đối tác B2B), /docs/internal (toàn bộ).
 * Endpoint KHÔNG gắn decorator chỉ xuất hiện trong tài liệu internal (mặc định an toàn).
 *
 * @example
 * @ApiAudience('client', 'partner')
 * @Controller('bookings')
 */
export const ApiAudience = (...audiences: ApiAudienceType[]) =>
  applyDecorators(ApiExtension(API_AUDIENCE_EXTENSION, audiences));
