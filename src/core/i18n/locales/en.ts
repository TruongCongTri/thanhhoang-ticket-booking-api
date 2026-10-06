export const en: Record<string, string> = {
  // Authentication & authorization
  AUTH_UNAUTHORIZED: 'Authentication credentials are invalid or expired.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_TOKEN_INVALID: 'The access token is invalid.',
  AUTH_FORBIDDEN_RESOURCE: 'You do not have permission to perform this action.',
  AUTH_TENANT_MISMATCH: 'Your account does not belong to the requested organization.',
  AUTH_CREDENTIALS_INVALID: 'Incorrect sign-in credentials.',
  AUTH_SESSION_REVOKED: 'This session has been revoked.',

  // Request input
  REQ_VALIDATION_ERROR: 'The submitted data is invalid.',
  REQ_MALFORMED_PAYLOAD: 'The request payload is malformed.',
  REQ_MISSING_IDEMPOTENCY_KEY: 'An Idempotency-Key header is required for this operation.',
  REQ_IDEMPOTENCY_PAYLOAD_MISMATCH: 'This Idempotency-Key was already used with a different request.',
  REQ_INVALID_UUID: 'The identifier is not a valid UUID.',
  REQ_INVALID_DATE_RANGE: 'The date is invalid.',
  REQ_TIMEOUT: 'The request took too long to process. Please try again.',
  REQ_PAYLOAD_TOO_LARGE: 'The request payload exceeds the allowed size.',

  // Resources & concurrency
  RES_NOT_FOUND: 'The requested resource was not found.',
  RES_ALREADY_EXISTS: 'The record already exists.',
  RES_CONFLICT: 'The request conflicts with the current state of the resource.',
  RES_CONCURRENCY_CONFLICT: 'The record was just updated by someone else. Please reload.',
  RES_LOCKED: 'The resource is being processed by another transaction.',
  RES_FEATURE_DISABLED: 'This feature is not enabled yet.',

  // Booking & payment
  BIZ_FLIGHT_SEAT_UNAVAILABLE: 'The seat has already been taken.',
  BIZ_PRICE_MISMATCH: 'The fare has changed. Please review the price.',
  BIZ_BOOKING_EXPIRED: 'The booking hold has expired.',
  BIZ_PAYMENT_FAILED: 'The payment was not successful.',
  BIZ_PAYMENT_ALREADY_SETTLED: 'This order has already been paid.',
  BOOKING_PAYMENT_PENDING: 'Booking payment is awaiting confirmation from the bank.',

  // Security & traffic
  SEC_RATE_LIMIT_EXCEEDED: 'Too many requests. Please retry in {{retryAfter}} seconds.',
  SEC_CORS_VIOLATION: 'The request origin is not allowed.',
  SEC_DECRYPTION_FAILED: 'The data could not be decrypted.',

  // Partners & system
  EXT_PARTNER_TIMEOUT: 'A partner service responded too slowly. Please try again later.',
  EXT_CIRCUIT_OPEN: 'A partner service is temporarily unavailable.',
  EXT_BULKHEAD_LIMIT_REACHED: 'The system is under heavy load. Please try again later.',
  SYS_INTERNAL_ERROR: 'An unexpected internal system error occurred.',
  SYS_DATABASE_ERROR: 'A data access error occurred. Please try again later.',
  SYS_SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
};
