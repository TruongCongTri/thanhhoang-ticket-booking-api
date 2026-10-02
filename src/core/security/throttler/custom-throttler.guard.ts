/**
 * Custom Guard định danh tracker:
 * Nếu user đã đăng nhập (Auth Guard chạy trước), tính giới hạn theo user:<userId>.
 * Nếu là khách vãng lai, tính giới hạn theo ip:<clientIp> lấy từ req.ip
 * (đã tôn trọng TRUST_PROXY; KHÔNG đọc thẳng X-Forwarded-For vì có thể bị giả mạo).
 */
import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerLimitDetail,
  normalizeIp,
} from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Nếu request đã được xác thực, định danh theo User ID
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // 2. Fallback về địa chỉ IP thực (IPv6 được gom theo subnet để chống xoay địa chỉ)
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `ip:${normalizeIp(ip, this.ipv6SubnetPrefix)}`;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ThrottlerException(
      `Too many requests. Rate limit exceeded. Retry after ${detail.timeToBlockExpire}s.`,
    );
  }
}
