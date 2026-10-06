export const WEBHOOK_CONSTANTS = {
  DEFAULT_SIGNATURE_HEADER: 'x-webhook-signature',
  DEFAULT_TIMESTAMP_HEADER: 'x-webhook-timestamp',
  /** Mã định danh duy nhất của lần gửi: bên nhận dùng để loại bỏ trùng lặp khi dispatcher retry */
  DEFAULT_ID_HEADER: 'x-webhook-id',
  DEFAULT_TOLERANCE_SECONDS: 300, // Cho phép sai lệch tối đa 5 phút
  HMAC_ALGORITHM: 'sha256',
  SIGNATURE_PREFIX: 'sha256=',
} as const;

export const WEBHOOK_VERIFY_METADATA_KEY = 'webhook:verify_metadata_key';
