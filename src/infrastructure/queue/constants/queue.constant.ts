export const QUEUE_NAMES = {
  NOTIFICATION: 'notification-queue',
  EXPORT_REPORT: 'export-report-queue',
  TICKET_ISSUANCE: 'ticket-issuance-queue',
  DATA_SYNC: 'data-sync-queue',
  /** Sự kiện miền được Outbox relay chuyển sang (jobId = outbox event id → không trùng lặp) */
  DOMAIN_EVENTS: 'domain-events-queue',
  /** Webhook egress có retry/backoff */
  WEBHOOK_DISPATCH: 'webhook-dispatch-queue',
} as const;

export const DLQ_SUFFIX = '-dlq';

/** Thời gian giữ job lỗi trên queue chính (bản sao đầy đủ đã nằm trong DLQ) */
export const FAILED_JOB_RETENTION_SECONDS = 24 * 3600;
