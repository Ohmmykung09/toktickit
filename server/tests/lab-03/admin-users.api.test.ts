import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { setAdminMutationTestHooksForTesting } from '../../src/admin-router.js';
import { app } from '../../src/app.js';
import { hashPassword } from '../../src/auth-policy.js';
import { prisma } from '../../src/db.js';
import { env } from '../../src/env.js';
import { authenticatedRequest } from '../authenticated-request.js';

const ticketPrefix = 'TKT-ADMIN-TEST-';

afterEach(async () => {
  setAdminMutationTestHooksForTesting({});
  await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: ticketPrefix } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@admin-test.example' } } });
});

afterAll(async () => { await prisma.$disconnect(); });

async function administratorApi() {
  const administrator = await prisma.user.findFirstOrThrow({ where: { role: 'ADMINISTRATOR', isActive: true } });
  return authenticatedRequest(app, administrator.id);
}

async function createManagedUser(role: UserRole = UserRole.REQUESTER, localPart = randomUUID()) {
  return prisma.user.create({
    data: {
      name: `Managed ${role}`,
      email: `${localPart}@admin-test.example`,
      role,
      isActive: true,
      passwordHash: await hashPassword('InitialPass123!'),
      passwordProvisionedAt: new Date(),
      mustChangePassword: false
    }
  });
}

async function createOwnedTicket(ownerId: number) {
  const [requesterUser, category, relatedSystem] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: UserRole.REQUESTER, isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  const suffix = randomUUID().slice(0, 8);
  return prisma.ticket.create({
    data: {
      ticketNumber: `${ticketPrefix}${suffix}`,
      idempotencyKey: randomUUID(),
      requesterId: requesterUser.id,
      ownerId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Administrator ownership ${suffix}`,
      description: 'This ticket verifies atomic owner reconciliation.',
      requestedPriority: 'MEDIUM',
      itPriority: 'HIGH',
      status: 'IN_PROGRESS',
      publicComments: { create: { authorId: requesterUser.id, content: 'Preserve public history.' } },
      internalNotes: { create: { authorId: ownerId, content: 'Preserve internal history.' } }
    },
    include: { _count: { select: { publicComments: true, internalNotes: true } } }
  });
}

describe('Lab 3 Administrator user management', () => {
  it('lists allowlisted fields and creates a canonical user with one role', async () => {
    const api = await administratorApi();
    const created = await api.post('/api/admin/users').send({ name: 'New Support User', email: '  NEW.USER@ADMIN-TEST.EXAMPLE ', role: 'IT_STAFF', isActive: true, initialPassword: 'InitialPass123!' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ email: 'new.user@admin-test.example', role: 'IT_STAFF', isActive: true, mustChangePassword: true }));
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.body).not.toHaveProperty('sessionVersion');
    const listed = await api.get('/api/admin/users?search=new.user&role=IT_STAFF');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);
  });

  it('normalizes edited email, rejects canonical collisions and invalid roles, and revokes the edited user session', async () => {
    const api = await administratorApi();
    const first = await createManagedUser(UserRole.REQUESTER, 'canonical.first');
    const target = await createManagedUser(UserRole.REQUESTER, 'canonical.target');
    const targetApi = await authenticatedRequest(app, target.id);

    const normalized = await api.patch(`/api/admin/users/${target.id}`).send({ email: '  EDITED.USER@ADMIN-TEST.EXAMPLE ' });
    expect(normalized.status).toBe(200);
    expect(normalized.body.email).toBe('edited.user@admin-test.example');
    expect((await targetApi.get('/api/categories')).status).toBe(401);

    const collision = await api.patch(`/api/admin/users/${target.id}`).send({ email: first.email.toUpperCase() });
    const invalidRole = await api.patch(`/api/admin/users/${target.id}`).send({ role: 'OWNER' });
    expect(collision.status).toBe(409);
    expect(collision.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(invalidRole.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).email).toBe('edited.user@admin-test.example');
  });

  it('rejects Requester access to administrator operations', async () => {
    const requesterUser = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } });
    const requesterApi = await authenticatedRequest(app, requesterUser.id);
    const forbidden = await requesterApi.get('/api/admin/users');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('atomically allows one concurrent Administrator removal and rejects the deactivated actor', async () => {
    const primary = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMINISTRATOR, isActive: true } });
    const extraActiveAdministrators = await prisma.user.findMany({
      where: { role: UserRole.ADMINISTRATOR, isActive: true, id: { not: primary.id } },
      select: { id: true, isActive: true }
    });
    await prisma.user.updateMany({
      where: { id: { in: extraActiveAdministrators.map(({ id }) => id) } },
      data: { isActive: false }
    });
    const secondary = await createManagedUser(UserRole.ADMINISTRATOR, 'concurrent.admin');
    const [primaryApi, secondaryApi] = await Promise.all([
      authenticatedRequest(app, primary.id),
      authenticatedRequest(app, secondary.id)
    ]);

    let arrivals = 0;
    let release!: () => void;
    const bothReady = new Promise<void>((resolve) => { release = resolve; });
    setAdminMutationTestHooksForTesting({
      beforeTransaction: async () => {
        arrivals += 1;
        if (arrivals === 2) release();
        await bothReady;
      }
    });

    try {
      const results = await Promise.all([
        primaryApi.patch(`/api/admin/users/${secondary.id}`).send({ isActive: false }),
        secondaryApi.patch(`/api/admin/users/${primary.id}`).send({ isActive: false })
      ]);
      expect(results.map(({ status }) => status).sort()).toEqual([200, 403]);
      expect(results.find(({ status }) => status === 403)?.body.error.code).toBe('FORBIDDEN');
      expect(await prisma.user.count({ where: { role: UserRole.ADMINISTRATOR, isActive: true } })).toBe(1);
    } finally {
      setAdminMutationTestHooksForTesting({});
      await prisma.user.update({ where: { id: primary.id }, data: { role: UserRole.ADMINISTRATOR, isActive: true } });
      await Promise.all(extraActiveAdministrators.map(({ id, isActive }) =>
        prisma.user.update({ where: { id }, data: { isActive } })
      ));
    }
  });

  it('unassigns tickets, advances the concurrency token, preserves history, and revokes a deactivated owner session', async () => {
    const api = await administratorApi();
    const owner = await createManagedUser(UserRole.IT_STAFF, 'deactivated.owner');
    const ownerApi = await authenticatedRequest(app, owner.id);
    const ticket = await createOwnedTicket(owner.id);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await api.patch(`/api/admin/users/${owner.id}`).send({ isActive: false });
    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: { _count: { select: { publicComments: true, internalNotes: true } } }
    });
    expect(result.status).toBe(200);
    expect(stored.ownerId).toBeNull();
    expect(stored.status).toBe(ticket.status);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(ticket.updatedAt.getTime());
    expect(stored._count).toEqual(ticket._count);
    expect((await ownerApi.get('/api/staff/tickets')).status).toBe(401);
  });

  it('unassigns tickets and revokes sessions when an owner is changed to Requester', async () => {
    const api = await administratorApi();
    const owner = await createManagedUser(UserRole.IT_STAFF, 'demoted.owner');
    const ownerApi = await authenticatedRequest(app, owner.id);
    const ticket = await createOwnedTicket(owner.id);

    const result = await api.patch(`/api/admin/users/${owner.id}`).send({ role: UserRole.REQUESTER });
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(result.status).toBe(200);
    expect(result.body.role).toBe('REQUESTER');
    expect(stored.ownerId).toBeNull();
    expect(stored.status).toBe(ticket.status);
    expect((await ownerApi.get('/api/categories')).status).toBe(401);
  });

  it('validates password boundaries and CSRF before resetting the initial password and revoking sessions', async () => {
    const api = await administratorApi();
    const target = await createManagedUser(UserRole.REQUESTER, 'password.target');
    const targetApi = await authenticatedRequest(app, target.id);

    const missingCsrf = await request(app)
      .post(`/api/admin/users/${target.id}/initial-password`)
      .set('Cookie', api.cookie)
      .set('Origin', env.clientOrigin)
      .send({ initialPassword: 'ValidBoundary1!' });
    const tooShort = await api.post(`/api/admin/users/${target.id}/initial-password`).send({ initialPassword: 'Aa1!aaaaaaa' });
    const tooLong = await api.post(`/api/admin/users/${target.id}/initial-password`).send({ initialPassword: `Aa1!${'a'.repeat(125)}` });
    const validBoundary = await api.post(`/api/admin/users/${target.id}/initial-password`).send({ initialPassword: 'Aa1!aaaaaaaa' });

    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe('CSRF_REJECTED');
    expect(tooShort.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(validBoundary.status).toBe(204);
    expect((await targetApi.get('/api/categories')).status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword).toBe(true);
  });

  it.each(['create', 'update', 'reset'] as const)(
    'rejects a paused %s mutation when the acting Administrator is deactivated before the transaction',
    async (operation) => {
      const actor = await createManagedUser(UserRole.ADMINISTRATOR, `paused.${operation}.actor`);
      const api = await authenticatedRequest(app, actor.id);
      const target = operation === 'create'
        ? null
        : await createManagedUser(UserRole.REQUESTER, `paused.${operation}.target`);
      const createdEmail = `paused.${operation}.created@admin-test.example`;
      const originalTarget = target
        ? await prisma.user.findUniqueOrThrow({ where: { id: target.id } })
        : null;
      let release!: () => void;
      let entered!: () => void;
      const transactionEntered = new Promise<void>((resolve) => { entered = resolve; });
      const continueRequest = new Promise<void>((resolve) => { release = resolve; });
      setAdminMutationTestHooksForTesting({
        beforeTransaction: async (currentOperation) => {
          if (currentOperation !== operation) return;
          entered();
          await continueRequest;
        }
      });

      const pendingRequest = operation === 'create'
        ? api.post('/api/admin/users').send({
            name: 'Blocked Create User',
            email: createdEmail,
            role: UserRole.REQUESTER,
            isActive: true,
            initialPassword: 'InitialPass123!'
          }).then((response) => response)
        : operation === 'update'
          ? api.patch(`/api/admin/users/${target!.id}`).send({ name: 'Blocked Update' }).then((response) => response)
          : api.post(`/api/admin/users/${target!.id}/initial-password`).send({ initialPassword: 'ReplacementPass123!' }).then((response) => response);

      await transactionEntered;
      await prisma.user.update({ where: { id: actor.id }, data: { isActive: false } });
      release();
      const result = await pendingRequest;

      expect(result.status).toBe(403);
      expect(result.body.error.code).toBe('FORBIDDEN');
      if (operation === 'create') {
        expect(await prisma.user.findUnique({ where: { email: createdEmail } })).toBeNull();
      } else {
        const storedTarget = await prisma.user.findUniqueOrThrow({ where: { id: target!.id } });
        if (operation === 'update') expect(storedTarget.name).toBe(originalTarget!.name);
        if (operation === 'reset') {
          expect(storedTarget.passwordHash).toBe(originalTarget!.passwordHash);
          expect(storedTarget.sessionVersion).toBe(originalTarget!.sessionVersion);
        }
      }
    }
  );
});
