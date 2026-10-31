import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-REQ-DASH-';

async function context() {
  const [requester, otherRequester, category, relatedSystem] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true, id: { not: (await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' } })).id } } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  return { requester, otherRequester, category, relatedSystem };
}

async function createTicket(requesterId: number, status: 'OPEN' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED', data: { updatedAt?: Date; resolvedAt?: Date } = {}) {
  const { category, relatedSystem } = await context();
  const suffix = randomUUID().slice(0, 8);
  return prisma.ticket.create({ data: {
    ticketNumber: `${prefix}${suffix}`, idempotencyKey: randomUUID(), requesterId, categoryId: category.id, relatedSystemId: relatedSystem.id,
    summary: `Requester dashboard ${suffix}`, description: 'Dashboard API fixture with enough detail for validation.', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', status,
    ...data
  } });
}

afterEach(async () => {
  await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: prefix } } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 4 Requester Dashboard API', () => {
  it('returns owned authoritative metrics, bounded lists, and drill-down data', async () => {
    const { requester, otherRequester } = await context();
    const api = await authenticatedRequest(app, requester.id);
    const baseline = await api.get('/api/dashboard/requester');
    const now = Date.now();
    const [open, waiting, resolved, other] = await Promise.all([
      createTicket(requester.id, 'OPEN', { updatedAt: new Date(now - 60 * 60 * 1000) }),
      createTicket(requester.id, 'WAITING_FOR_REQUESTER', { updatedAt: new Date(now - 2 * 60 * 60 * 1000) }),
      createTicket(requester.id, 'RESOLVED', { updatedAt: new Date(now - 3 * 60 * 60 * 1000), resolvedAt: new Date(now - 4 * 60 * 60 * 1000) }),
      createTicket(otherRequester.id, 'WAITING_FOR_REQUESTER', { updatedAt: new Date(now - 60 * 60 * 1000) })
    ]);
    const response = await api.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    expect(response.body.metrics.openTickets).toBe(baseline.body.metrics.openTickets + 2);
    expect(response.body.metrics.waitingForRequester).toBe(baseline.body.metrics.waitingForRequester + 1);
    expect(response.body.metrics.recentlyUpdatedCount).toBe(baseline.body.metrics.recentlyUpdatedCount + 3);
    expect(response.body.metrics.recentlyResolvedCount).toBe(baseline.body.metrics.recentlyResolvedCount + 1);
    expect(response.body.attentionTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toContain(waiting.ticketNumber);
    expect(response.body.recentTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).not.toContain(other.ticketNumber);
    expect(response.body.recentTickets[0].drillDown).toEqual({ type: 'ticket', ticketNumber: response.body.recentTickets[0].ticketNumber });
    expect(response.body.recentTickets.length).toBeLessThanOrEqual(5);
    expect(response.body.attentionTickets.length).toBeLessThanOrEqual(20);
    expect(open.ticketNumber).toContain(prefix);
    expect(resolved.ticketNumber).toContain(prefix);
  });

  it('returns zero-shaped lists for no fixture data and forbids staff access', async () => {
    const { requester } = await context();
    const staff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } });
    const requesterApi = await authenticatedRequest(app, requester.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const forbidden = await staffApi.get('/api/dashboard/requester');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    const response = await requesterApi.get('/api/dashboard/requester');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('attentionTickets');
    expect(response.body).toHaveProperty('recentTickets');
  });
});
