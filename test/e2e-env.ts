/**
 * Biến môi trường tối thiểu cho e2e (nạp qua jest setupFiles TRƯỚC khi AppModule được import,
 * vì ConfigModule.forRoot() xác thực env ngay khi module được đánh giá).
 * Biến đã có sẵn trong môi trường CI sẽ không bị ghi đè.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  DB_MASTER_HOST: '127.0.0.1',
  DB_MASTER_USER: 'postgres',
  DB_MASTER_PASSWORD: 'postgres',
  DB_NAME: 'ticket_booking_e2e',
  REDIS_ENABLED: 'false',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  JWT_SECRET: 'e2e-jwt-secret-with-at-least-32-characters!!',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-with-at-least-32-characters',
  SHUTDOWN_DRAIN_DELAY_MS: '0',
  SHUTDOWN_HOOK_TIMEOUT_MS: '1000',
  THROTTLE_LIMIT: '3',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
