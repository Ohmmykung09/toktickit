import { createHash, randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/db.js';

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

  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string) => request(app).post(path).set('Cookie', cookie),
    delete: (path: string) => request(app).delete(path).set('Cookie', cookie),
    patch: (path: string) => request(app).patch(path).set('Cookie', cookie)
  };
}
