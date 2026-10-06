export const ko: Record<string, string> = {
  // 인증 및 권한
  AUTH_UNAUTHORIZED: '인증 정보가 유효하지 않거나 만료되었습니다.',
  AUTH_TOKEN_EXPIRED: '세션이 만료되었습니다. 다시 로그인해 주세요.',
  AUTH_TOKEN_INVALID: '액세스 토큰이 유효하지 않습니다.',
  AUTH_FORBIDDEN_RESOURCE: '이 작업을 수행할 권한이 없습니다.',
  AUTH_TENANT_MISMATCH: '계정이 요청한 조직에 속하지 않습니다.',
  AUTH_CREDENTIALS_INVALID: '로그인 정보가 올바르지 않습니다.',
  AUTH_SESSION_REVOKED: '이 세션은 철회되었습니다.',

  // 입력 데이터
  REQ_VALIDATION_ERROR: '전송된 데이터가 유효하지 않습니다.',
  REQ_MALFORMED_PAYLOAD: '요청 데이터 형식이 올바르지 않습니다.',
  REQ_MISSING_IDEMPOTENCY_KEY: '이 작업에는 Idempotency-Key 헤더가 필요합니다.',
  REQ_IDEMPOTENCY_PAYLOAD_MISMATCH: '이 Idempotency-Key는 다른 요청에서 이미 사용되었습니다.',
  REQ_INVALID_UUID: '식별자가 유효한 UUID가 아닙니다.',
  REQ_INVALID_DATE_RANGE: '날짜가 유효하지 않습니다.',
  REQ_TIMEOUT: '요청 처리 시간이 초과되었습니다. 다시 시도해 주세요.',
  REQ_PAYLOAD_TOO_LARGE: '전송된 데이터가 허용 크기를 초과합니다.',

  // 리소스 및 동시성
  RES_NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  RES_ALREADY_EXISTS: '이미 존재하는 데이터입니다.',
  RES_CONFLICT: '요청이 리소스의 현재 상태와 충돌합니다.',
  RES_CONCURRENCY_CONFLICT: '다른 사용자가 데이터를 방금 수정했습니다. 새로 고침해 주세요.',
  RES_LOCKED: '리소스가 다른 트랜잭션에서 처리 중입니다.',
  RES_FEATURE_DISABLED: '이 기능은 아직 활성화되지 않았습니다.',

  // 예약 및 결제
  BIZ_FLIGHT_SEAT_UNAVAILABLE: '이미 다른 고객이 예약한 좌석입니다.',
  BIZ_PRICE_MISMATCH: '운임이 변경되었습니다. 가격을 다시 확인해 주세요.',
  BIZ_BOOKING_EXPIRED: '예약 보류 기간이 만료되었습니다.',
  BIZ_PAYMENT_FAILED: '결제에 실패했습니다.',
  BIZ_PAYMENT_ALREADY_SETTLED: '이미 결제가 완료된 주문입니다.',
  BOOKING_PAYMENT_PENDING: '은행의 결제 승인을 기다리고 있습니다.',

  // 보안 및 트래픽
  SEC_RATE_LIMIT_EXCEEDED: '요청이 너무 많습니다. {{retryAfter}}초 후에 다시 시도해 주세요.',
  SEC_CORS_VIOLATION: '허용되지 않은 접근 출처입니다.',
  SEC_DECRYPTION_FAILED: '데이터를 복호화할 수 없습니다.',

  // 파트너 및 시스템
  EXT_PARTNER_TIMEOUT: '파트너 서비스의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  EXT_CIRCUIT_OPEN: '파트너 서비스를 일시적으로 사용할 수 없습니다.',
  EXT_BULKHEAD_LIMIT_REACHED: '시스템 부하가 높습니다. 잠시 후 다시 시도해 주세요.',
  SYS_INTERNAL_ERROR: '예기치 않은 내부 시스템 오류가 발생했습니다.',
  SYS_DATABASE_ERROR: '데이터 접근 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  SYS_SERVICE_UNAVAILABLE: '서비스를 일시적으로 사용할 수 없습니다.',
};
