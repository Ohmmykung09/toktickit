import { describe, expect, it } from 'vitest';
import {
  accountLockMilliseconds,
  maximumPasswordLength,
  nextFailedLoginState,
  normalizeEmail,
  passwordValidationError
} from '../../src/auth-policy.js';

describe('Lab 3 authentication policy', () => {
  it('normalizes email and enforces exact password boundaries', () => {
    expect(normalizeEmail('  AOM@Example.TEST ')).toBe('aom@example.test');
    expect(passwordValidationError('Aa1!'.padEnd(11, 'x'))).toMatch(/12 to 128/);
    expect(passwordValidationError('Aa1!'.padEnd(12, 'x'))).toBeNull();
    expect(passwordValidationError('Aa1!'.padEnd(maximumPasswordLength, 'x'))).toBeNull();
    expect(passwordValidationError('Aa1!'.padEnd(maximumPasswordLength + 1, 'x'))).toMatch(/12 to 128/);
    expect(passwordValidationError('onlylowercasepassword')).toMatch(/three/);
    expect(passwordValidationError('aom1@example.test', 'AOM1@example.test')).toMatch(/email address/);
  });

  it('starts a fresh failure window and locks on the fifth failure', () => {
    const now = new Date('2026-09-11T08:00:00.000Z');
    const first = nextFailedLoginState(4, new Date('2026-09-11T07:44:59.000Z'), now);
    expect(first.failedLoginAttempts).toBe(1);
    expect(first.lockedUntil).toBeNull();

    const fifth = nextFailedLoginState(4, new Date('2026-09-11T07:50:00.000Z'), now);
    expect(fifth.failedLoginAttempts).toBe(5);
    expect(fifth.lockedUntil).toEqual(new Date(now.getTime() + accountLockMilliseconds));
  });
});
