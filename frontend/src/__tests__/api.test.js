/**
 * Frontend Unit Tests — services/api.js
 *
 * Tests for utility functions exported from the API service.
 * Runs with Vitest + jsdom.
 */

import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  isUnauthorizedError,
  isForbiddenError,
  isNotFoundError,
  isValidationError,
} from '../services/api';

// ═══════════════════════════════════════════════════════════════
// getErrorMessage
// ═══════════════════════════════════════════════════════════════
describe('getErrorMessage', () => {
  it('extracts message from response.data.error', () => {
    const error = { response: { data: { error: 'Bad request' } } };
    expect(getErrorMessage(error)).toBe('Bad request');
  });

  it('extracts message from error.message (axios native)', () => {
    const error = { message: 'Network Error' };
    expect(getErrorMessage(error)).toBe('Network Error');
  });

  it('returns default string for network errors', () => {
    const error = {}; // no response at all
    const msg = getErrorMessage(error);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns custom default when provided', () => {
    const error = {};
    const msg = getErrorMessage(error, 'Custom fallback');
    expect(msg).toBe('Custom fallback');
  });
});

// ═══════════════════════════════════════════════════════════════
// Error type checkers
// ═══════════════════════════════════════════════════════════════
describe('isUnauthorizedError', () => {
  it('returns true for 401', () => {
    expect(isUnauthorizedError({ response: { status: 401 } })).toBe(true);
  });
  it('returns false for 403', () => {
    expect(isUnauthorizedError({ response: { status: 403 } })).toBe(false);
  });
  it('returns false when no response', () => {
    expect(isUnauthorizedError({})).toBe(false);
  });
});

describe('isForbiddenError', () => {
  it('returns true for 403', () => {
    expect(isForbiddenError({ response: { status: 403 } })).toBe(true);
  });
  it('returns false for 401', () => {
    expect(isForbiddenError({ response: { status: 401 } })).toBe(false);
  });
});

describe('isNotFoundError', () => {
  it('returns true for 404', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
  });
  it('returns false for 500', () => {
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false);
  });
});

describe('isValidationError', () => {
  it('returns true for 400', () => {
    expect(isValidationError({ response: { status: 400 } })).toBe(true);
  });
  it('returns false for 422', () => {
    expect(isValidationError({ response: { status: 422 } })).toBe(false);
  });
});
