import { REGEX_PATTERNS } from './regex.constant';
import { SystemErrorCode } from './error-codes.constant';
import { SYSTEM_HEADERS } from './headers.constant';

describe('Common Constants & Regex Specifications', () => {
  describe('REGEX_PATTERNS', () => {
    it('should validate valid UUID v4 and reject invalid ones', () => {
      const validUuid = 'c30590a2-aa94-49f1-acba-07973099bc5d';
      const invalidUuid = 'not-a-valid-uuid-format';

      expect(REGEX_PATTERNS.UUID.test(validUuid)).toBe(true);
      expect(REGEX_PATTERNS.UUID.test(invalidUuid)).toBe(false);
    });

    it('should validate Vietnam phone numbers', () => {
      expect(REGEX_PATTERNS.VIETNAM_PHONE.test('0987654321')).toBe(true);
      expect(REGEX_PATTERNS.VIETNAM_PHONE.test('+84912345678')).toBe(true);
      expect(REGEX_PATTERNS.VIETNAM_PHONE.test('0123456789')).toBe(false); // Đầu số cũ
      expect(REGEX_PATTERNS.VIETNAM_PHONE.test('12345')).toBe(false);
    });

    it('should validate IATA Airport and Airline codes', () => {
      expect(REGEX_PATTERNS.IATA_AIRPORT_CODE.test('SGN')).toBe(true);
      expect(REGEX_PATTERNS.IATA_AIRPORT_CODE.test('HAN')).toBe(true);
      expect(REGEX_PATTERNS.IATA_AIRPORT_CODE.test('SGNN')).toBe(false); // 4 ký tự là ICAO, không phải IATA

      expect(REGEX_PATTERNS.IATA_AIRLINE_CODE.test('VN')).toBe(true);
      expect(REGEX_PATTERNS.IATA_AIRLINE_CODE.test('VJ')).toBe(true);
      expect(REGEX_PATTERNS.IATA_AIRLINE_CODE.test('VNA')).toBe(false);
    });

    it('should validate Booking PNR codes', () => {
      expect(REGEX_PATTERNS.BOOKING_PNR.test('ABC123')).toBe(true);
      expect(REGEX_PATTERNS.BOOKING_PNR.test('XYZ999')).toBe(true);
      expect(REGEX_PATTERNS.BOOKING_PNR.test('TOOLONG123')).toBe(false);
    });

    it('should validate strong password constraints', () => {
      expect(REGEX_PATTERNS.STRONG_PASSWORD.test('Pass@word123')).toBe(true);
      expect(REGEX_PATTERNS.STRONG_PASSWORD.test('weakpassword')).toBe(false);
      expect(REGEX_PATTERNS.STRONG_PASSWORD.test('NoSpecial123')).toBe(false);
    });
  });

  describe('SystemErrorCode & Headers', () => {
    it('should define distinct error code identifiers', () => {
      expect(SystemErrorCode.AUTH_UNAUTHORIZED).toBe('AUTH_UNAUTHORIZED');
      expect(SystemErrorCode.RES_CONCURRENCY_CONFLICT).toBe('RES_CONCURRENCY_CONFLICT');
      expect(SystemErrorCode.EXT_CIRCUIT_BREAKER_OPEN).toBe('EXT_CIRCUIT_OPEN');
    });

    it('should match standard header names', () => {
      expect(SYSTEM_HEADERS.IDEMPOTENCY_KEY).toBe('idempotency-key');
      expect(SYSTEM_HEADERS.TENANT_ID).toBe('x-tenant-id');
      expect(SYSTEM_HEADERS.TRACE_ID).toBe('x-trace-id');
    });
  });
});

// npx jest src/common/constants/constants.spec.ts