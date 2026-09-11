import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PrismaClient, User, UserRole } from '@prisma/client';
import { prisma } from './db.js';
import {
  isValidEmail,
  maximumPasswordLength,
  minimumPasswordLength,
  nextFailedLoginState,
  normalizeEmail,
  passwordMatches,
  passwordValidationError,
  hashPassword
} from './auth-policy.js';

const sessionDurationMilliseconds = 8 * 60 * 60 * 1000;

export const sessionCookieName = 'toktickit_session';

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type ResolvedSession = {
  sessionId: number;
  csrfToken: string;
  user: PublicUser;
  mustChangePassword: boolean;
};

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>
  ) {
    super(message);
  }
}

function publicUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'>): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeDigestMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function splitCookieValue(cookieValue: string | null) {
  if (!cookieValue) return null;
  const [sessionToken, csrfToken, extra] = cookieValue.split('.');
  if (!sessionToken || !csrfToken || extra || sessionToken.length < 40 || csrfToken.length < 40) return null;
  return { sessionToken, csrfToken };
}

async function createSession(userId: number, database: PrismaClient = prisma) {
  const { sessionToken, csrfToken, data } = newSessionData(userId);
  const session = await database.session.create({
    data
  });
  return { sessionId: session.id, cookieValue: `${sessionToken}.${csrfToken}`, csrfToken };
}

function newSessionData(userId: number) {
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  return {
    sessionToken,
    csrfToken,
    data: {
      userId,
      tokenHash: digest(sessionToken),
      csrfTokenHash: digest(csrfToken),
      expiresAt: new Date(Date.now() + sessionDurationMilliseconds)
    }
  };
}

const invalidCredentials = () =>
  new AuthError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

export async function login(emailInput: unknown, passwordInput: unknown) {
  if (
    typeof emailInput !== 'string' ||
    typeof passwordInput !== 'string' ||
    !isValidEmail(emailInput) ||
    passwordInput.length < minimumPasswordLength ||
    passwordInput.length > maximumPasswordLength
  ) {
    throw new AuthError(400, 'VALIDATION_ERROR', 'Enter a valid email address and password.');
  }

  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  const now = new Date();
  if (
    !user ||
    !user.isActive ||
    !user.passwordHash ||
    !user.passwordProvisionedAt ||
    (user.lockedUntil !== null && user.lockedUntil > now)
  ) {
    throw invalidCredentials();
  }

  if (!(await passwordMatches(user.passwordHash, passwordInput))) {
    await prisma.user.update({
      where: { id: user.id },
      data: nextFailedLoginState(user.failedLoginAttempts, user.failedLoginWindowStartedAt, now)
    });
    throw invalidCredentials();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, failedLoginWindowStartedAt: null, lockedUntil: null }
  });
  const session = await createSession(user.id);
  return {
    ...session,
    user: publicUser(user),
    mustChangePassword: user.mustChangePassword
  };
}

export async function resolveSession(cookieValue: string | null): Promise<ResolvedSession | null> {
  const tokens = splitCookieValue(cookieValue);
  if (!tokens) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: digest(tokens.sessionToken) },
    include: { user: true }
  });
  const now = new Date();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    !session.user.isActive ||
    !session.user.passwordHash ||
    !session.user.passwordProvisionedAt ||
    !safeDigestMatch(session.csrfTokenHash, digest(tokens.csrfToken))
  ) {
    return null;
  }

  await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
  return {
    sessionId: session.id,
    csrfToken: tokens.csrfToken,
    user: publicUser(session.user),
    mustChangePassword: session.user.mustChangePassword
  };
}

export function csrfMatches(session: ResolvedSession, csrfToken: string | undefined) {
  if (!csrfToken) return false;
  return safeDigestMatch(digest(session.csrfToken), digest(csrfToken));
}

export async function changePassword(
  session: ResolvedSession,
  currentPasswordInput: unknown,
  newPasswordInput: unknown
) {
  if (typeof currentPasswordInput !== 'string' || typeof newPasswordInput !== 'string') {
    throw new AuthError(400, 'VALIDATION_ERROR', 'Current and new passwords are required.');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !(await passwordMatches(user.passwordHash, currentPasswordInput))) {
    throw invalidCredentials();
  }
  if (await passwordMatches(user.passwordHash, newPasswordInput)) {
    throw new AuthError(400, 'VALIDATION_ERROR', 'New password must differ from the current password.');
  }
  const validationError = passwordValidationError(newPasswordInput, user.email);
  if (validationError) throw new AuthError(400, 'VALIDATION_ERROR', validationError);

  const newPasswordHash = await hashPassword(newPasswordInput, user.email);
  const now = new Date();
  const replacement = newSessionData(user.id);
  const replacementSession = await prisma.$transaction(async (transaction) => {
    await transaction.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now }
    });
    await transaction.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordProvisionedAt: now,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt: null,
        lockedUntil: null,
        sessionVersion: { increment: 1 }
      }
    });
    return transaction.session.create({ data: replacement.data });
  });
  return {
    sessionId: replacementSession.id,
    cookieValue: `${replacement.sessionToken}.${replacement.csrfToken}`,
    csrfToken: replacement.csrfToken,
    user: publicUser(user),
    mustChangePassword: false
  };
}

export async function logout(session: ResolvedSession) {
  await prisma.session.updateMany({
    where: { id: session.sessionId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
