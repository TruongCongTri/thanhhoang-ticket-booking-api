/**
 * Tổng hợp các Regex chuẩn cho xác thực đầu vào (Validation Pipes / DTOs), hỗ trợ tiêu chuẩn du lịch hàng không quốc tế (IATA) và bảo mật dữ liệu PII
 * 
 * */ 

export const REGEX_PATTERNS = {
  // UUID v4 tiêu chuẩn (RFC 4122)
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  // Số điện thoại Việt Nam (+84 hoặc 0...)
  VIETNAM_PHONE: /^(?:\+84|0)(?:3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/,

  // Căn cước công dân (12 chữ số)
  VIETNAM_CITIZEN_ID: /^[0-9]{12}$/,

  // Hộ chiếu Việt Nam và Quốc tế (1 chữ cái theo sau bởi 7-8 chữ số)
  PASSPORT: /^[A-Z][0-9]{7,8}$/i,

  // Mã sân bay quốc tế chuẩn IATA (3 chữ cái in hoa, ví dụ: SGN, HAN, DAD)
  IATA_AIRPORT_CODE: /^[A-Z]{3}$/,

  // Mã hãng hàng không chuẩn IATA (2 ký tự chữ hoặc số, ví dụ: VN, VJ, QH, AA)
  IATA_AIRLINE_CODE: /^[A-Z0-9]{2}$/,

  // PNR Booking Reference (Code vé 6 ký tự gồm chữ cái và số, ví dụ: AB12CD)
  BOOKING_PNR: /^[A-Z0-9]{6}$/,

  // Định dạng ngày ISO 8601 (YYYY-MM-DD)
  DATE_ISO_YMD: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,

  // Mật khẩu mạnh (Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt)
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
} as const;