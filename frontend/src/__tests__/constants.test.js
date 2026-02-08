/**
 * Frontend Unit Tests — constants/index.ts
 *
 * Ensures frontend constants are defined and consistent.
 */

import { describe, it, expect } from 'vitest';
import {
  USER_ROLES,
  USER_STATUSES,
  SUBSCRIPTION_STATUSES,
  DEFAULT_MONTHLY_FEE,
  TRIAL_PERIOD_DAYS,
} from '../constants';

describe('Frontend Constants', () => {
  it('USER_ROLES has client, admin, staff', () => {
    expect(Object.keys(USER_ROLES)).toEqual(expect.arrayContaining(['client', 'admin', 'staff']));
    expect(USER_ROLES.client.label).toBeTruthy();
    expect(USER_ROLES.admin.label).toBeTruthy();
    expect(USER_ROLES.staff.label).toBeTruthy();
  });

  it('USER_STATUSES has active, inactive, suspended', () => {
    expect(Object.keys(USER_STATUSES)).toEqual(
      expect.arrayContaining(['active', 'inactive', 'suspended'])
    );
    expect(USER_STATUSES.active.color).toBe('green');
  });

  it('SUBSCRIPTION_STATUSES includes trial, active, paused, cancelled', () => {
    const keys = Object.keys(SUBSCRIPTION_STATUSES);
    expect(keys).toContain('trial');
    expect(keys).toContain('active');
    expect(keys).toContain('cancelled');
  });

  it('DEFAULT_MONTHLY_FEE is a positive number', () => {
    expect(DEFAULT_MONTHLY_FEE).toBeGreaterThan(0);
  });

  it('TRIAL_PERIOD_DAYS is reasonable', () => {
    expect(TRIAL_PERIOD_DAYS).toBeGreaterThanOrEqual(7);
    expect(TRIAL_PERIOD_DAYS).toBeLessThanOrEqual(90);
  });
});
