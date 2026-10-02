import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const INCOMING_TRACE_HEADERS = [
  CORRELATION_ID_HEADER,
  'x-request-id',
  'x-trace-id',
] as const;

/** Chỉ chấp nhận trace id ngắn, an toàn: chống log injection / header injection */
const SAFE_TRACE_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const TRACE_ID_SYMBOL = Symbol.for('app.traceId');

/**
 * Nguồn duy nhất xác định traceId cho một request.
 * Được memo trên request object để RequestContextMiddleware và pino-http (genReqId)
 * luôn dùng cùng một giá trị bất kể middleware nào chạy trước.
 */
export function resolveTraceId(
  req: IncomingMessage,
  res?: ServerResponse,
): string {
  const memo = (req as any)[TRACE_ID_SYMBOL] as string | undefined;
  if (memo) return memo;

  let traceId: string | undefined;
  for (const header of INCOMING_TRACE_HEADERS) {
    const raw = req.headers[header];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && SAFE_TRACE_ID.test(value)) {
      traceId = value;
      break;
    }
  }
  traceId ??= randomUUID();

  (req as any)[TRACE_ID_SYMBOL] = traceId;
  if (res && !res.headersSent) {
    res.setHeader(CORRELATION_ID_HEADER, traceId);
  }
  return traceId;
}
