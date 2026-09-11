import { argon2id, hash, verify } from 'argon2';

export const minimumPasswordLength = 12;
export const maximumPasswordLength = 128;
export const maximumEmailLength = 254;
export const maximumFailedLoginAttempts = 5;
export const failedLoginWindowMilliseconds = 15 * 60 * 1000;
export const accountLockMilliseconds = 15 * 60 * 1000;

export const argon2idOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const email = normalizeEmail(value);
  return email.length > 0 && email.length <= maximumEmailLength && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function passwordValidationError(password: string, email?: string) {
  if (password.length < minimumPasswordLength || password.length > maximumPasswordLength) {
    return `Password must contain ${minimumPasswordLength} to ${maximumPasswordLength} characters.`;
  }

  const characterClasses = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  if (characterClasses < 3) {
    return 'Password must use at least three of uppercase, lowercase, number, and symbol.';
  }

  if (email && password === normalizeEmail(email)) {
    return 'Password must not be the same as the email address.';
  }

  return null;
}

export function nextFailedLoginState(
  currentAttempts: number,
  windowStartedAt: Date | null,
  now: Date
) {
  const insideWindow =
    windowStartedAt !== null && now.getTime() - windowStartedAt.getTime() < failedLoginWindowMilliseconds;
  const failedLoginAttempts = insideWindow ? currentAttempts + 1 : 1;

  return {
    failedLoginAttempts,
    failedLoginWindowStartedAt: insideWindow ? windowStartedAt : now,
    lockedUntil:
      failedLoginAttempts >= maximumFailedLoginAttempts
        ? new Date(now.getTime() + accountLockMilliseconds)
        : null
  };
}

export async function hashPassword(password: string, email?: string) {
  const validationError = passwordValidationError(password, email);
  if (validationError) throw new Error(validationError);
  return hash(password, argon2idOptions);
}

export async function passwordMatches(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
