export const ja: Record<string, string> = {
  // 認証・認可
  AUTH_UNAUTHORIZED: '認証資格情報が無効か、有効期限が切れています。',
  AUTH_TOKEN_EXPIRED: 'セッションの有効期限が切れました。再度ログインしてください。',
  AUTH_TOKEN_INVALID: 'アクセストークンが無効です。',
  AUTH_FORBIDDEN_RESOURCE: 'この操作を実行する権限がありません。',
  AUTH_TENANT_MISMATCH: 'アカウントが要求された組織に属していません。',
  AUTH_CREDENTIALS_INVALID: 'ログイン情報が正しくありません。',
  AUTH_SESSION_REVOKED: 'このセッションは無効化されました。',

  // 入力データ
  REQ_VALIDATION_ERROR: '送信されたデータが不正です。',
  REQ_MALFORMED_PAYLOAD: 'リクエストデータの形式が正しくありません。',
  REQ_MISSING_IDEMPOTENCY_KEY: 'この操作には Idempotency-Key ヘッダーが必要です。',
  REQ_IDEMPOTENCY_PAYLOAD_MISMATCH: 'この Idempotency-Key は別のリクエストで使用済みです。',
  REQ_INVALID_UUID: '識別子が有効な UUID ではありません。',
  REQ_INVALID_DATE_RANGE: '日付が無効です。',
  REQ_TIMEOUT: 'リクエストの処理がタイムアウトしました。もう一度お試しください。',
  REQ_PAYLOAD_TOO_LARGE: '送信データが許容サイズを超えています。',

  // リソース・同時実行
  RES_NOT_FOUND: 'リクエストされたリソースが見つかりませんでした。',
  RES_ALREADY_EXISTS: 'データは既に存在します。',
  RES_CONFLICT: 'リクエストがリソースの現在の状態と競合しています。',
  RES_CONCURRENCY_CONFLICT: 'データが他のユーザーによって更新されました。再読み込みしてください。',
  RES_LOCKED: 'リソースは別のトランザクションで処理中です。',
  RES_FEATURE_DISABLED: 'この機能はまだ有効になっていません。',

  // 予約・決済
  BIZ_FLIGHT_SEAT_UNAVAILABLE: 'この座席は既に予約されています。',
  BIZ_PRICE_MISMATCH: '運賃が変更されました。価格をご確認ください。',
  BIZ_BOOKING_EXPIRED: '予約の保持期限が切れました。',
  BIZ_PAYMENT_FAILED: '決済に失敗しました。',
  BIZ_PAYMENT_ALREADY_SETTLED: 'この注文は既に支払い済みです。',
  BOOKING_PAYMENT_PENDING: '支払いは銀行からの確認待ちです。',

  // セキュリティ・トラフィック
  SEC_RATE_LIMIT_EXCEEDED: 'リクエストが多すぎます。{{retryAfter}} 秒後に再試行してください。',
  SEC_CORS_VIOLATION: 'このアクセス元は許可されていません。',
  SEC_DECRYPTION_FAILED: 'データを復号できませんでした。',

  // パートナー・システム
  EXT_PARTNER_TIMEOUT: 'パートナーサービスの応答が遅れています。しばらくしてから再試行してください。',
  EXT_CIRCUIT_OPEN: 'パートナーサービスが一時的に利用できません。',
  EXT_BULKHEAD_LIMIT_REACHED: 'システムが混雑しています。しばらくしてから再試行してください。',
  SYS_INTERNAL_ERROR: '予期せぬ内部システムエラーが発生しました。',
  SYS_DATABASE_ERROR: 'データアクセスエラーが発生しました。しばらくしてから再試行してください。',
  SYS_SERVICE_UNAVAILABLE: 'サービスは一時的に利用できません。',
};
