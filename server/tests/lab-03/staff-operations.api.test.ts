import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

async function createTicket(ownerId: number | null = null) {
  const [requester, category, system] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  const key = randomUUID();
  return prisma.ticket.create({ data: { ticketNumber: `TKT-OPS-${key.slice(0, 8)}`, idempotencyKey: key, requesterId: requester.id, ownerId, categoryId: category.id, relatedSystemId: system.id, summary: 'Staff operation test ticket', description: 'This fixture verifies safe staff ticket operations.', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', status: 'NEW' } });
}

afterEach(async () => { await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: 'TKT-OPS-' } } }); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 3 IT Staff ticket operations', () => {
  it('loads detail and safely assigns, prioritizes, and advances a ticket', async () => {
    const staff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } });
    const ticket = await createTicket();
    const api = await authenticatedRequest(app, staff.id);
    const detail = await api.get(`/api/staff/tickets/${ticket.ticketNumber}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(expect.objectContaining({ ticketNumber: ticket.ticketNumber, owner: null, publicComments: expect.any(Array), internalNotes: expect.any(Array) }));

    const assigned = await api.patch(`/api/staff/tickets/${ticket.ticketNumber}/assignment`).send({ ownerId: staff.id, expectedUpdatedAt: detail.body.updatedAt });
    expect(assigned.status).toBe(200);
    expect(assigned.body.owner.id).toBe(staff.id);
    const prioritized = await api.patch(`/api/staff/tickets/${ticket.ticketNumber}/it-priority`).send({ itPriority: 'CRITICAL', expectedUpdatedAt: assigned.body.updatedAt });
    expect(prioritized.status).toBe(200);
    expect(prioritized.body.itPriority).toBe('CRITICAL');
    expect(prioritized.body.requestedPriority).toBe('MEDIUM');
    const advanced = await api.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: 'IN_PROGRESS', expectedUpdatedAt: prioritized.body.updatedAt });
    expect(advanced.status).toBe(200);
    expect(advanced.body.status).toBe('IN_PROGRESS');
  });

  it('rejects invalid transitions, ownerless operational states, stale writes, and Requester access', async () => {
    const [staff, requester] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
      prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } })
    ]);
    const ticket = await createTicket();
    const staffApi = await authenticatedRequest(app, staff.id);
    const requesterApi = await authenticatedRequest(app, requester.id);
    const invalid = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: 'CLOSED', expectedUpdatedAt: ticket.updatedAt.toISOString() });
    const ownerRequired = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: 'IN_PROGRESS', expectedUpdatedAt: ticket.updatedAt.toISOString() });
    const stale = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/it-priority`).send({ itPriority: 'HIGH', expectedUpdatedAt: '2020-01-01T00:00:00.000Z' });
    const forbidden = await requesterApi.get(`/api/staff/tickets/${ticket.ticketNumber}`);
    expect(invalid.status).toBe(409); expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(ownerRequired.status).toBe(409); expect(ownerRequired.body.error.code).toBe('OWNER_REQUIRED');
    expect(stale.status).toBe(409); expect(stale.body.error.code).toBe('STALE_WRITE');
    expect(forbidden.status).toBe(403);
  });
});
