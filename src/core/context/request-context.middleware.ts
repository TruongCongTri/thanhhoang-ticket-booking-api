import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';
import { RequestContextData } from './request-context.model';
import { resolveTraceId } from './trace-id.util';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // 1. Nhận (đã kiểm tra định dạng) hoặc sinh mới traceId, đồng bộ vào response header
    const traceId = resolveTraceId(req, res);

    // 2. Client IP: req.ip đã tôn trọng cấu hình Express 'trust proxy' (TRUST_PROXY).
    //    KHÔNG đọc trực tiếp X-Forwarded-For vì client có thể giả mạo header này.
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    const initialContext: RequestContextData = {
      traceId,
      clientIp,
      userAgent: req.headers['user-agent'],
      startTime: Date.now(),
      isBackgroundJob: false,
      metadata: new Map<string, unknown>(),
    };

    // 3. Kích hoạt AsyncLocalStorage cho toàn bộ chu kỳ sống của request
    this.contextService.run(initialContext, () => next());
  }
}
