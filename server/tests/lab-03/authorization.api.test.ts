import { randomUUID } from 'node:crypto';
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
    const otherApi = await authenticatedRequest(app, otherRequester.id);

    const crossOwner = await otherApi.get(`/api/tickets/${ticket.ticketNumber}`);
    const missing = await otherApi.get('/api/tickets/TKT-MISSING-0000');
    const crossOwnerAttachments = await otherApi.get(`/api/tickets/${ticket.ticketNumber}/attachments`);
    const missingAttachments = await otherApi.get('/api/tickets/TKT-MISSING-0000/attachments');

    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
    expect(crossOwner.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(crossOwnerAttachments.status).toBe(404);
    expect(crossOwnerAttachments.body).toEqual(missingAttachments.body);
    expect(crossOwnerAttachments.body.error.code).toBe('RESOURCE_NOT_FOUND');
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
