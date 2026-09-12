import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

async function ticketContext() {
  const [requesters, staff, category, relatedSystem] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: 'REQUESTER', passwordHash: { not: null } },
      orderBy: { id: 'asc' },
      take: 2
    }),
    prisma.user.findFirstOrThrow({
      where: { isActive: true, role: 'IT_STAFF', passwordHash: { not: null } }
    }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  if (requesters.length < 2) throw new Error('Authorization tests require two active Requesters.');
  return { owner: requesters[0], otherRequester: requesters[1], staff, category, relatedSystem };
}

async function createOwnedTicket(requesterId: number) {
  const { category, relatedSystem } = await ticketContext();
  const key = randomUUID();
  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-AUTH-${key.slice(0, 8)}`,
      idempotencyKey: key,
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Authorization test ${key.slice(0, 8)}`,
      description: 'This ticket verifies authenticated role and ownership authorization.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM'
    }
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 3 authorization and Requester regression', () => {
  it('rejects anonymous and non-Requester direct API access safely', async () => {
    const { staff } = await ticketContext();
    const staffApi = await authenticatedRequest(app, staff.id);

    const anonymous = await request(app).get('/api/tickets');
    const forbidden = await staffApi.get('/api/tickets');

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('derives ticket ownership from the session and rejects the legacy identity header', async () => {
    const { owner, otherRequester, category, relatedSystem } = await ticketContext();
    const ownerApi = await authenticatedRequest(app, owner.id);
    const key = randomUUID();

    const created = await ownerApi
      .post('/api/tickets')
      .set('Idempotency-Key', key)
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: 'Authenticated requester identity',
        requestedPriority: 'HIGH',
        description: 'The backend must derive requester ownership from this authenticated session.'
      });
    const legacyAttempt = await ownerApi
      .get('/api/tickets')
      .set('X-Development-Requester-Id', String(otherRequester.id));
    const removedSelectorEndpoint = await ownerApi.get('/api/development-requesters');

    expect(created.status).toBe(201);
    expect((await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: created.body.ticketNumber }
    })).requesterId).toBe(owner.id);
    expect(legacyAttempt.status).toBe(400);
    expect(legacyAttempt.body.error.code).toBe('LEGACY_IDENTITY_REJECTED');
    expect(removedSelectorEndpoint.status).toBe(404);
    expect(removedSelectorEndpoint.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns the same not-found response for missing and cross-Requester resources', async () => {
    const { owner, otherRequester } = await ticketContext();
    const ticket = await createOwnedTicket(owner.id);
    const ownerApi = await authenticatedRequest(app, owner.id);
    const otherApi = await authenticatedRequest(app, otherRequester.id);
    const uploaded = await ownerApi
      .post(`/api/tickets/${ticket.ticketNumber}/attachments`)
      .attach('file', Buffer.from('owner-only attachment evidence'), {
        filename: 'owner-evidence.pdf',
        contentType: 'application/pdf'
      });
    expect(uploaded.status).toBe(201);

    try {
      const crossOwner = await otherApi.get(`/api/tickets/${ticket.ticketNumber}`);
      const missing = await otherApi.get('/api/tickets/TKT-MISSING-0000');
      const crossOwnerAttachments = await otherApi.get(`/api/tickets/${ticket.ticketNumber}/attachments`);
      const missingAttachments = await otherApi.get('/api/tickets/TKT-MISSING-0000/attachments');
      const crossOwnerUpload = await otherApi
        .post(`/api/tickets/${ticket.ticketNumber}/attachments`)
        .attach('file', Buffer.from('unauthorized upload'), {
          filename: 'unauthorized.pdf',
          contentType: 'application/pdf'
        });
      const missingUpload = await otherApi
        .post('/api/tickets/TKT-MISSING-0000/attachments')
        .attach('file', Buffer.from('missing ticket upload'), {
          filename: 'missing.pdf',
          contentType: 'application/pdf'
        });
      const crossOwnerDownload = await otherApi.get(
        `/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}/download`
      );
      const missingDownload = await otherApi.get(
        `/api/tickets/TKT-MISSING-0000/attachments/${uploaded.body.id}/download`
      );
      const crossOwnerDelete = await otherApi
        .delete(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}`)
        .send({ reason: 'Unauthorized removal attempt.' });
      const missingDelete = await otherApi
        .delete(`/api/tickets/TKT-MISSING-0000/attachments/${uploaded.body.id}`)
        .send({ reason: 'Missing ticket removal attempt.' });

      expect(crossOwner.status).toBe(404);
      expect(crossOwner.body).toEqual(missing.body);
      expect(crossOwner.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(crossOwnerAttachments.status).toBe(404);
      expect(crossOwnerAttachments.body).toEqual(missingAttachments.body);
      expect(crossOwnerAttachments.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(crossOwnerUpload.status).toBe(404);
      expect(crossOwnerUpload.body).toEqual(missingUpload.body);
      expect(crossOwnerUpload.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(crossOwnerDownload.status).toBe(404);
      expect(crossOwnerDownload.body).toEqual(missingDownload.body);
      expect(crossOwnerDownload.body.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(crossOwnerDelete.status).toBe(404);
      expect(crossOwnerDelete.body).toEqual(missingDelete.body);
      expect(crossOwnerDelete.body.error.code).toBe('RESOURCE_NOT_FOUND');

      const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } });
      expect(attachment.removedAt).toBeNull();
    } finally {
      const attachment = await prisma.attachment.findUnique({ where: { id: uploaded.body.id } });
      if (attachment) {
        await unlink(path.resolve(process.cwd(), 'uploads', attachment.storedFileName)).catch(() => undefined);
      }
      await prisma.ticket.deleteMany({ where: { id: ticket.id } });
    }
  });

  it('re-evaluates active state and role for every request made with an existing session', async () => {
    const suffix = randomUUID().slice(0, 8);
    const credentialSource = await prisma.user.findFirstOrThrow({
      where: { passwordHash: { not: null }, passwordProvisionedAt: { not: null } },
      select: { passwordHash: true }
    });
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Session Deactivation Test',
          email: `session-deactivation-${suffix}@example.test`,
          role: 'REQUESTER',
          isActive: true,
          passwordHash: credentialSource.passwordHash,
          passwordProvisionedAt: new Date(),
          mustChangePassword: false
        }
      }),
      prisma.user.create({
        data: {
          name: 'Session Role Test',
          email: `session-role-${suffix}@example.test`,
          role: 'REQUESTER',
          isActive: true,
          passwordHash: credentialSource.passwordHash,
          passwordProvisionedAt: new Date(),
          mustChangePassword: false
        }
      })
    ]);

    try {
      const deactivatedApi = await authenticatedRequest(app, users[0].id);
      const changedRoleApi = await authenticatedRequest(app, users[1].id);
      expect((await deactivatedApi.get('/api/tickets')).status).toBe(200);
      expect((await changedRoleApi.get('/api/tickets')).status).toBe(200);

      await prisma.user.update({ where: { id: users[0].id }, data: { isActive: false } });
      await prisma.user.update({ where: { id: users[1].id }, data: { role: 'IT_STAFF' } });

      const deactivatedResponse = await deactivatedApi.get('/api/tickets');
      const changedRoleResponse = await changedRoleApi.get('/api/tickets');

      expect(deactivatedResponse.status).toBe(401);
      expect(deactivatedResponse.body.error.code).toBe('UNAUTHENTICATED');
      expect(changedRoleResponse.status).toBe(403);
      expect(changedRoleResponse.body.error.code).toBe('FORBIDDEN');
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
    }
  });

  it('requires the approved Origin and session CSRF token for mutations', async () => {
    const { owner, category, relatedSystem } = await ticketContext();
    const ownerApi = await authenticatedRequest(app, owner.id);
    const body = {
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: 'CSRF authorization test',
      requestedPriority: 'LOW',
      description: 'Mutation requests must include the session-bound CSRF token and approved Origin.'
    };

    const missingCsrf = await request(app)
      .post('/api/tickets')
      .set('Cookie', ownerApi.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('Idempotency-Key', randomUUID())
      .send(body);
    const wrongOrigin = await request(app)
      .post('/api/tickets')
      .set('Cookie', ownerApi.cookie)
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Token', ownerApi.csrfToken)
      .set('Idempotency-Key', randomUUID())
      .send(body);

    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe('CSRF_REJECTED');
    expect(wrongOrigin.status).toBe(403);
    expect(wrongOrigin.body.error.code).toBe('CSRF_REJECTED');
  });
});
