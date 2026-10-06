export const vi: Record<string, string> = {
  // Xác thực & phân quyền
  AUTH_UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.',
  AUTH_TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
  AUTH_TOKEN_INVALID: 'Mã xác thực không hợp lệ.',
  AUTH_FORBIDDEN_RESOURCE: 'Bạn không có quyền thực hiện thao tác này.',
  AUTH_TENANT_MISMATCH: 'Tài khoản không thuộc tổ chức được yêu cầu.',
  AUTH_CREDENTIALS_INVALID: 'Thông tin đăng nhập không chính xác.',
  AUTH_SESSION_REVOKED: 'Phiên đăng nhập đã bị thu hồi.',

  // Dữ liệu đầu vào
  REQ_VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ.',
  REQ_MALFORMED_PAYLOAD: 'Định dạng dữ liệu gửi lên không đúng.',
  REQ_MISSING_IDEMPOTENCY_KEY: 'Thiếu header Idempotency-Key cho thao tác nhạy cảm.',
  REQ_IDEMPOTENCY_PAYLOAD_MISMATCH: 'Idempotency-Key đã được dùng cho một yêu cầu khác.',
  REQ_INVALID_UUID: 'Mã định danh không đúng định dạng UUID.',
  REQ_INVALID_DATE_RANGE: 'Ngày tháng không hợp lệ.',
  REQ_TIMEOUT: 'Yêu cầu xử lý quá thời gian cho phép, vui lòng thử lại.',
  REQ_PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên vượt quá kích thước cho phép.',

  // Tài nguyên & đồng thời
  RES_NOT_FOUND: 'Tài nguyên được yêu cầu không tồn tại trên hệ thống.',
  RES_ALREADY_EXISTS: 'Dữ liệu đã tồn tại.',
  RES_CONFLICT: 'Yêu cầu xung đột với trạng thái hiện tại của tài nguyên.',
  RES_CONCURRENCY_CONFLICT: 'Dữ liệu vừa được cập nhật bởi người khác, vui lòng tải lại.',
  RES_LOCKED: 'Tài nguyên đang được xử lý bởi một giao dịch khác.',
  RES_FEATURE_DISABLED: 'Tính năng này hiện chưa được kích hoạt.',

  // Nghiệp vụ đặt vé & thanh toán
  BIZ_FLIGHT_SEAT_UNAVAILABLE: 'Ghế đã được người khác đặt.',
  BIZ_PRICE_MISMATCH: 'Giá vé đã thay đổi, vui lòng kiểm tra lại.',
  BIZ_BOOKING_EXPIRED: 'Đơn giữ chỗ đã hết hạn.',
  BIZ_PAYMENT_FAILED: 'Thanh toán không thành công.',
  BIZ_PAYMENT_ALREADY_SETTLED: 'Đơn hàng đã được thanh toán.',
  BOOKING_PAYMENT_PENDING: 'Đơn hàng đang chờ thanh toán xác nhận từ cổng ngân hàng.',

  // Bảo mật & lưu lượng
  SEC_RATE_LIMIT_EXCEEDED: 'Bạn thao tác quá nhanh, vui lòng thử lại sau {{retryAfter}} giây.',
  SEC_CORS_VIOLATION: 'Nguồn truy cập không được phép.',
  SEC_DECRYPTION_FAILED: 'Không thể giải mã dữ liệu.',

  // Đối tác & hệ thống
  EXT_PARTNER_TIMEOUT: 'Đối tác phản hồi quá chậm, vui lòng thử lại sau.',
  EXT_CIRCUIT_OPEN: 'Dịch vụ đối tác đang tạm gián đoạn.',
  EXT_BULKHEAD_LIMIT_REACHED: 'Hệ thống đang quá tải, vui lòng thử lại sau.',
  SYS_INTERNAL_ERROR: 'Đã có lỗi hệ thống không mong muốn xảy ra.',
  SYS_DATABASE_ERROR: 'Lỗi truy xuất dữ liệu, vui lòng thử lại sau.',
  SYS_SERVICE_UNAVAILABLE: 'Dịch vụ tạm thời không khả dụng.',
};
