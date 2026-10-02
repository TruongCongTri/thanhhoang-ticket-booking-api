import { SnakeNamingStrategy } from './snake-naming.strategy';

describe('SnakeNamingStrategy (PostgreSQL Standard)', () => {
  let strategy: SnakeNamingStrategy;

  beforeEach(() => {
    strategy = new SnakeNamingStrategy();
  });

  it('should format Entity class names into snake_case table names', () => {
    expect(strategy.tableName('BookingItem')).toBe('booking_item');
    expect(strategy.tableName('FlightBookingOrder')).toBe('flight_booking_order');
    expect(strategy.tableName('UserPaymentTransaction')).toBe('user_payment_transaction');
  });

  it('should respect custom table name when provided', () => {
    expect(strategy.tableName('BookingItem', 'custom_bookings')).toBe('custom_bookings');
  });

  it('should format camelCase property names into snake_case column names', () => {
    expect(strategy.columnName('holdExpiresAt', undefined, [])).toBe('hold_expires_at');
    expect(strategy.columnName('passengerIdNumber', undefined, [])).toBe('passenger_id_number');
    expect(strategy.columnName('createdAt', undefined, [])).toBe('created_at');
  });

  it('should format embedded entity prefixes correctly', () => {
    expect(strategy.columnName('streetName', undefined, ['passengerAddress'])).toBe(
      'passenger_address_street_name',
    );
  });

  it('should format join table and column names cleanly', () => {
    expect(strategy.joinColumnName('booking', 'id')).toBe('booking_id');
    expect(strategy.joinTableName('roles', 'permissions')).toBe('roles_permissions');
  });
});

// npx jest src/core/database/snake-naming.strategy.spec.ts