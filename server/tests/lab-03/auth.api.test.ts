import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase } from '../../src/seed-data.js';

const origin = 'http://localhost:5173';
const initialPassword = 'Lab3Initial!2026';
const migrationFiles = [
  new URL('../../prisma/migrations/20260814144249_create_category/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260822000000_lab2_ticket_foundation/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260901000000_lab2_review_fixes/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911000000_lab3_user_migration/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911100000_bind_session_version/migration.sql', import.meta.url)
];

let app: Express;
let database: PrismaClient;
let adminDatabase: PrismaClient;
let schema: string;
let originalDatabaseUrl: string | undefined;
let appDatabase: PrismaClient;
let setAuthenticationTestHooksForTesting: typeof import('../../src/auth-service.js').setAuthenticationTestHooksForTesting;

function schemaUrl(databaseUrl: string, schemaName: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schemaName);
  return url.toString();
}

async function applyMigrations(client: PrismaClient) {
  for (const file of migrationFiles) {
    const sql = await readFile(file, 'utf8');
    const statements = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await client.$executeRawUnsafe(statement);
  }
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  if (!originalDatabaseUrl) throw new Error('DATABASE_URL is required for authentication API tests.');
  schema = `lab3_auth_${randomUUID().replaceAll('-', '')}`;
  adminDatabase = new PrismaClient({ datasources: { db: { url: originalDatabaseUrl } } });
  await adminDatabase.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  process.env.DATABASE_URL = schemaUrl(originalDatabaseUrl, schema);
  process.env.CLIENT_ORIGIN = origin;
  process.env.NODE_ENV = 'test';
  database = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  await applyMigrations(database);
  await seedDatabase(database, initialPassword);

  const appModule = await import('../../src/app.js');
  const databaseModule = await import('../../src/db.js');
  const authServiceModule = await import('../../src/auth-service.js');
  app = appModule.app;
  appDatabase = databaseModule.prisma;
  setAuthenticationTestHooksForTesting = authServiceModule.setAuthenticationTestHooksForTesting;
});

afterAll(async () => {
  await appDatabase?.$disconnect();
  await database?.$disconnect();
  if (adminDatabase && schema) await adminDatabase.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await adminDatabase?.$disconnect();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

async function signIn(agent: ReturnType<typeof request.agent>, email: string, password = initialPassword) {
  return agent.post('/api/auth/login').set('Origin', origin).send({ email, password });
}

describe('Lab 3 authentication API', () => {
  it('rejects anonymous access before a protected handler is reached', async () => {
    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' }
    });
  });

  it('creates an opaque session and returns only allowlisted user data', async () => {
    const agent = request.agent(app);
    const response = await signIn(agent, '  AOM@EXAMPLE.TEST  ');

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']?.[0]).toMatch(/toktickit_session=.*HttpOnly.*SameSite=Lax/i);
    expect(response.body).toEqual({
      user: { id: expect.any(Number), name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER' },
      mustChangePassword: true,
      csrfToken: expect.any(String)
    });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|lockedUntil|tokenHash|sessionVersion/);

    const currentUser = await agent.get('/api/auth/me');
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe('aom@example.test');
  });

  it('uses the same safe response for wrong, inactive, unknown, locked, and unprovisioned accounts', async () => {
    await database.user.create({
      data: { name: 'Pending User', email: 'pending@example.test', role: 'REQUESTER', isActive: true }
    });
    const attempts = [
      ['beam@example.test', 'WrongPassword!2026'],
      ['inactive@example.test', initialPassword],
      ['unknown@example.test', initialPassword],
      ['pending@example.test', initialPassword]
    ];
    const bodies = [];
    for (const [email, password] of attempts) {
      const response = await signIn(request.agent(app), email, password);
      expect(response.status).toBe(401);
      bodies.push(response.body);
    }
    expect(bodies.every((body) => JSON.stringify(body) === JSON.stringify(bodies[0]))).toBe(true);

    expect((await signIn(request.agent(app), 'beam@example.test')).status).toBe(200);
    const resetUser = await database.user.findUniqueOrThrow({ where: { email: 'beam@example.test' } });
    expect(resetUser.failedLoginAttempts).toBe(0);
    expect(resetUser.failedLoginWindowStartedAt).toBeNull();
    expect(resetUser.lockedUntil).toBeNull();

    const concurrentFailures = await Promise.all(
      Array.from({ length: 5 }, () => signIn(request.agent(app), 'mew@example.test', 'WrongPassword!2026'))
    );
    expect(concurrentFailures.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
    const lockedUser = await database.user.findUniqueOrThrow({ where: { email: 'mew@example.test' } });
    expect(lockedUser.failedLoginAttempts).toBe(5);
    expect(lockedUser.lockedUntil).toBeInstanceOf(Date);
    const lockedResponse = await signIn(request.agent(app), 'mew@example.test');
    expect(lockedResponse.status).toBe(401);
    expect(lockedResponse.body).toEqual(bodies[0]);
  });

  it('blocks normal APIs until the initial password is changed and replaces all prior sessions', async () => {
    const agent = request.agent(app);
    const loginResponse = await signIn(agent, 'nok@example.test');
    const csrfToken = loginResponse.body.csrfToken as string;

    const blockedResponse = await agent.get('/api/categories');
    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await agent.post('/api/auth/change-password').set('Origin', origin).send({ currentPassword: initialPassword, newPassword: 'PrivatePass!2026' })).status).toBe(403);
    expect((await agent.post('/api/auth/change-password').set('Origin', origin).set('X-CSRF-Token', csrfToken).send({ currentPassword: 'WrongPassword!2026', newPassword: 'PrivatePass!2026' })).status).toBe(401);
    expect((await agent.post('/api/auth/change-password').set('Origin', origin).set('X-CSRF-Token', csrfToken).send({ currentPassword: initialPassword, newPassword: initialPassword })).status).toBe(400);

    const changedResponse = await agent
      .post('/api/auth/change-password')
      .set('Origin', origin)
      .set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: initialPassword, newPassword: 'PrivatePass!2026' });
    expect(changedResponse.status).toBe(200);
    expect(changedResponse.body.mustChangePassword).toBe(false);
    expect(await database.session.count({ where: { userId: changedResponse.body.user.id, revokedAt: null } })).toBe(1);
    expect((await agent.get('/api/categories')).status).toBe(200);
  });

  it('rejects expired and malformed sessions and makes logout safely repeatable', async () => {
    const expiredAgent = request.agent(app);
    const loginResponse = await signIn(expiredAgent, 'ton.it@example.test');
    const userId = loginResponse.body.user.id as number;
    await database.session.updateMany({ where: { userId, revokedAt: null }, data: { expiresAt: new Date(0) } });
    expect((await expiredAgent.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', 'toktickit_session=malformed')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', 'toktickit_session=%ZZ')).status).toBe(401);

    const staleVersionAgent = request.agent(app);
    const staleVersionLogin = await signIn(staleVersionAgent, 'mint.it@example.test');
    await database.user.update({
      where: { id: staleVersionLogin.body.user.id },
      data: { sessionVersion: { increment: 1 } }
    });
    expect((await staleVersionAgent.get('/api/auth/me')).status).toBe(401);

    const agent = request.agent(app);
    const activeLogin = await signIn(agent, 'ploy.it@example.test');
    const logoutResponse = await agent
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Token', activeLogin.body.csrfToken);
    expect(logoutResponse.status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
  });

  it('does not publish a stale session when the password changes during login', async () => {
    const email = 'admin@example.test';
    const changer = request.agent(app);
    const initialLogin = await signIn(changer, email);
    const userId = initialLogin.body.user.id as number;
    let signalVerified!: () => void;
    let releaseLogin!: () => void;
    const verified = new Promise<void>((resolve) => { signalVerified = resolve; });
    const release = new Promise<void>((resolve) => { releaseLogin = resolve; });

    setAuthenticationTestHooksForTesting({
      afterPasswordVerified: async (verifiedUserId) => {
        if (verifiedUserId !== userId) return;
        signalVerified();
        await release;
      }
    });

    try {
      const racingAgent = request.agent(app);
      const racingLogin = signIn(racingAgent, email);
      await verified;

      const changed = await changer
        .post('/api/auth/change-password')
        .set('Origin', origin)
        .set('X-CSRF-Token', initialLogin.body.csrfToken)
        .send({ currentPassword: initialPassword, newPassword: 'AdminPrivate!2026' });
      expect(changed.status).toBe(200);

      releaseLogin();
      const staleLogin = await racingLogin;
      expect(staleLogin.status).toBe(401);
      expect(staleLogin.body.error.code).toBe('INVALID_CREDENTIALS');

      const user = await database.user.findUniqueOrThrow({ where: { id: userId } });
      const activeSessions = await database.session.findMany({ where: { userId, revokedAt: null } });
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionVersion).toBe(user.sessionVersion);
      expect((await racingAgent.get('/api/auth/me')).status).toBe(401);
    } finally {
      releaseLogin();
      setAuthenticationTestHooksForTesting({});
    }
  });
});
