import { createHash, randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request, { type Test } from 'supertest';
import { prisma } from '../src/db.js';
import { env } from '../src/env.js';

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function authenticatedRequest(app: Express, userId?: number) {
  const user = userId
    ? await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    : await prisma.user.findFirstOrThrow({
        where: { isActive: true, passwordHash: { not: null }, passwordProvisionedAt: { not: null } }
      });
  if (user.mustChangePassword) {
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  }

  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      userId: user.id,
      sessionVersion: user.sessionVersion,
      tokenHash: digest(sessionToken),
      csrfTokenHash: digest(csrfToken),
      expiresAt: new Date(Date.now() + 60_000)
    }
  });
  const cookie = `toktickit_session=${sessionToken}.${csrfToken}`;
  const protectMutation = <T extends Test>(test: T) => test
    .set('Cookie', cookie)
    .set('Origin', env.clientOrigin)
    .set('X-CSRF-Token', csrfToken);

  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string) => protectMutation(request(app).post(path)),
    delete: (path: string) => protectMutation(request(app).delete(path)),
    patch: (path: string) => protectMutation(request(app).patch(path)),
    cookie,
    csrfToken,
    user
  };
}
