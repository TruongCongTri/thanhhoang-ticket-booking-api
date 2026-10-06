/**
 * Tập hợp danh mục Header dùng xuyên suốt tầng Gateway, Middleware, Interceptors và HttpClient
 * 
 * */

export const SYSTEM_HEADERS = {
  // Distributed Tracing[cite: 1]
  TRACE_ID: 'x-trace-id',
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',

  // Multi-Tenancy & Access Context[cite: 1]
  TENANT_ID: 'x-tenant-id',
  DEPARTMENT_ID: 'x-department-id',

  // Security & Idempotency[cite: 1]
  IDEMPOTENCY_KEY: 'idempotency-key',
  API_KEY: 'x-api-key',

  // Performance & Caching
  CACHE_LOOKUP: 'x-cache-lookup',
  RESPONSE_TIME: 'x-response-time-ms',

  // Internationalization[cite: 1]
  ACCEPT_LANGUAGE: 'accept-language',
} as const;