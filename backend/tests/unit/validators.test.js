/**
 * Unit Tests — validators.js
 *
 * Tests for validation constants, enums, and regex patterns.
 */

const {
  USER_ROLES,
  USER_STATUSES,
  SUBSCRIPTION_STATUSES,
  CREDIT_BUREAUS,
  CREDIT_BUREAUS_WITH_ALL,
  CREDIT_ITEM_TYPES,
  CREDIT_ITEM_STATUSES,
  DISPUTE_TYPES,
  DISPUTE_STATUSES,
  DOCUMENT_CATEGORIES,
  PAYMENT_STATUSES,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  CREDIT_SCORE_RANGE,
  PATTERNS,
} = require('../../utils/validators');

// ═══════════════════════════════════════════════════════════════
// Enum Constants
// ═══════════════════════════════════════════════════════════════
describe('Enum Constants', () => {
  it('USER_ROLES contains expected roles', () => {
    expect(USER_ROLES).toContain('client');
    expect(USER_ROLES).toContain('admin');
    expect(USER_ROLES).toContain('staff');
    expect(USER_ROLES).toHaveLength(3);
  });

  it('USER_STATUSES contains expected values', () => {
    expect(USER_STATUSES).toEqual(expect.arrayContaining(['active', 'inactive', 'suspended']));
  });

  it('SUBSCRIPTION_STATUSES contains expected values', () => {
    expect(SUBSCRIPTION_STATUSES).toEqual(
      expect.arrayContaining(['trial', 'active', 'paused', 'cancelled'])
    );
  });

  it('CREDIT_BUREAUS are the three major bureaus', () => {
    expect(CREDIT_BUREAUS).toEqual(['experian', 'equifax', 'transunion']);
  });

  it('CREDIT_BUREAUS_WITH_ALL includes "all"', () => {
    expect(CREDIT_BUREAUS_WITH_ALL).toContain('all');
    expect(CREDIT_BUREAUS_WITH_ALL).toHaveLength(4);
  });

  it('CREDIT_ITEM_TYPES has 8 types', () => {
    expect(CREDIT_ITEM_TYPES).toHaveLength(8);
    expect(CREDIT_ITEM_TYPES).toContain('late_payment');
    expect(CREDIT_ITEM_TYPES).toContain('collection');
    expect(CREDIT_ITEM_TYPES).toContain('bankruptcy');
    expect(CREDIT_ITEM_TYPES).toContain('other');
  });

  it('CREDIT_ITEM_STATUSES has 5 statuses', () => {
    expect(CREDIT_ITEM_STATUSES).toHaveLength(5);
    expect(CREDIT_ITEM_STATUSES).toContain('identified');
    expect(CREDIT_ITEM_STATUSES).toContain('deleted');
  });

  it('DISPUTE_TYPES has 6 types', () => {
    expect(DISPUTE_TYPES).toHaveLength(6);
    expect(DISPUTE_TYPES).toContain('not_mine');
    expect(DISPUTE_TYPES).toContain('inaccurate_info');
  });

  it('DISPUTE_STATUSES has 6 statuses', () => {
    expect(DISPUTE_STATUSES).toHaveLength(6);
    expect(DISPUTE_STATUSES).toContain('draft');
    expect(DISPUTE_STATUSES).toContain('resolved');
  });

  it('DOCUMENT_CATEGORIES has expected categories', () => {
    expect(DOCUMENT_CATEGORIES).toContain('id');
    expect(DOCUMENT_CATEGORIES).toContain('credit_report');
    expect(DOCUMENT_CATEGORIES).toContain('dispute_letter');
  });

  it('PAYMENT_STATUSES has expected values', () => {
    expect(PAYMENT_STATUSES).toEqual(['pending', 'completed', 'failed', 'refunded']);
  });

  it('ALLOWED_FILE_TYPES includes PDF and images', () => {
    expect(ALLOWED_FILE_TYPES).toContain('application/pdf');
    expect(ALLOWED_FILE_TYPES).toContain('image/jpeg');
    expect(ALLOWED_FILE_TYPES).toContain('image/png');
  });

  it('ALLOWED_FILE_EXTENSIONS matches types', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.pdf');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.jpg');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.docx');
  });

  it('MAX_FILE_SIZE is 10MB', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it('CREDIT_SCORE_RANGE is 300-850', () => {
    expect(CREDIT_SCORE_RANGE).toEqual({ min: 300, max: 850 });
  });
});

// ═══════════════════════════════════════════════════════════════
// Regex PATTERNS
// ═══════════════════════════════════════════════════════════════
describe('PATTERNS', () => {
  describe('email', () => {
    const { email } = PATTERNS;
    it.each([
      'user@example.com',
      'name@sub.domain.org',
      'a+b@test.co',
    ])('matches valid email: %s', (val) => {
      expect(email.test(val)).toBe(true);
    });

    it.each([
      '',
      'not-an-email',
      '@no-user.com',
      'no-at-sign',
      'spaces in@email.com',
    ])('rejects invalid email: "%s"', (val) => {
      expect(email.test(val)).toBe(false);
    });
  });

  describe('phone', () => {
    const { phone } = PATTERNS;
    it.each([
      '8133693340',
      '813-369-3340',
      '+1 (813) 369-3340',
      '1234567890',
    ])('matches valid phone: %s', (val) => {
      expect(phone.test(val)).toBe(true);
    });

    it.each([
      '123',          // too short
      '',
    ])('rejects invalid phone: "%s"', (val) => {
      expect(phone.test(val)).toBe(false);
    });
  });

  describe('ssn4', () => {
    const { ssn4 } = PATTERNS;
    it.each(['0000', '1234', '9999'])('matches valid SSN last 4: %s', (val) => {
      expect(ssn4.test(val)).toBe(true);
    });

    it.each(['123', '12345', 'abcd', ''])('rejects invalid SSN4: "%s"', (val) => {
      expect(ssn4.test(val)).toBe(false);
    });
  });

  describe('zipCode', () => {
    const { zipCode } = PATTERNS;
    it.each(['33617', '10001', '90210-1234'])('matches valid zip: %s', (val) => {
      expect(zipCode.test(val)).toBe(true);
    });

    it.each(['1234', '123456', 'ABCDE', ''])('rejects invalid zip: "%s"', (val) => {
      expect(zipCode.test(val)).toBe(false);
    });
  });

  describe('state', () => {
    const { state } = PATTERNS;
    it.each(['FL', 'CA', 'NY', 'TX'])('matches valid state: %s', (val) => {
      expect(state.test(val)).toBe(true);
    });

    it.each(['fl', 'Florida', 'X', '12', ''])('rejects invalid state: "%s"', (val) => {
      expect(state.test(val)).toBe(false);
    });
  });

  describe('uuid', () => {
    const { uuid } = PATTERNS;
    it('matches valid UUID v4', () => {
      expect(uuid.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(uuid.test('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it.each([
      'not-a-uuid',
      '550e8400e29b41d4a716446655440000', // no hyphens
      '',
    ])('rejects invalid UUID: "%s"', (val) => {
      expect(uuid.test(val)).toBe(false);
    });
  });
});
