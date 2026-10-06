export const DOMAIN_EVENTS = {
  BOOKING: {
    CREATED: 'booking.created',
    CONFIRMED: 'booking.confirmed',
    CANCELLED: 'booking.cancelled',
  },
  PAYMENT: {
    COMPLETED: 'payment.completed',
    FAILED: 'payment.failed',
  },
  FLIGHT: {
    SCHEDULE_CHANGED: 'flight.schedule_changed',
  },
} as const;