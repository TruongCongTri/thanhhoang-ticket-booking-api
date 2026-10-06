export const TRACER_NAME = 'travel-enterprise-tracer';

export const TRACE_HEADERS = {
  W3C_TRACEPARENT: 'traceparent',
  W3C_TRACESTATE: 'tracestate',
} as const;

export const SPAN_ATTRIBUTES = {
  TENANT_ID: 'app.tenant_id',
  USER_ID: 'app.user_id',
  COMPONENT: 'app.component',
  ERROR_TYPE: 'app.error.type',
} as const;