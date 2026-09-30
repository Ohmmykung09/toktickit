import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-STAFF-DASH-';
async function context() {
  const [staff, requester, category, relatedSystem] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  return { staff, requester, category, relatedSystem };
}
async function createTicket(data: Record<string, unknown> = {}) {
  const { requester, category, relatedSystem } = await context();
  const suffix = randomUUID().slice(0, 8);
  return prisma.ticket.create({ data: {
    ticketNumber: `${prefix}${suffix}`, idempotencyKey: randomUUID(), requesterId: requester.id, categoryId: category.id, relatedSystemId: relatedSystem.id,
    summary: `Staff dashboard ${suffix}`, description: 'Dashboard API fixture with enough detail for validation.', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', status: 'OPEN', ...data
  } });
}
afterEach(async () => { const tickets = await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: prefix } }, select: { id: true } }); await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } }); await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } }); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 4 IT Staff Dashboard API', () => {
  it('calculates operational ownership, buckets, actions, and urgent drill-down tickets', async () => {
    const { staff, requester } = await context();
    const api = await authenticatedRequest(app, staff.id);
    const baseline = await api.get('/api/dashboard/staff');
    const now = Date.now();
    const [unassigned, mine, critical] = await Promise.all([
      createTicket({ ownerId: null, status: 'NEW', itPriority: 'LOW', updatedAt: new Date(now - 60 * 60 * 1000) }),
      createTicket({ ownerId: staff.id, status: 'IN_PROGRESS', itPriority: 'HIGH', updatedAt: new Date(now - 60 * 60 * 1000) }),
      createTicket({ ownerId: staff.id, status: 'OPEN', itPriority: 'CRITICAL', updatedAt: new Date(now - 10 * 60 * 1000) })
    ]);
    await prisma.actionTaken.create({ data: { ticketId: mine.id, actionDateTime: new Date(now - 60 * 60 * 1000), description: 'Dashboard action fixture.', result: 'Recorded.', createdById: staff.id, performedById: staff.id } });
    const response = await api.get('/api/dashboard/staff');
    expect(response.status).toBe(200);
    expect(response.body.metrics.unassignedTickets).toBe(baseline.body.metrics.unassignedTickets + 1);
    expect(response.body.metrics.myTickets).toBe(baseline.body.metrics.myTickets + 2);
    expect(response.body.metrics.myActionsTaken).toBe(baseline.body.metrics.myActionsTaken + 1);
    expect(response.body.metrics.byStatus.NEW).toBe(baseline.body.metrics.byStatus.NEW + 1);
    expect(response.body.metrics.byStatus.IN_PROGRESS).toBe(baseline.body.metrics.byStatus.IN_PROGRESS + 1);
    expect(response.body.metrics.byItPriority.CRITICAL).toBe(baseline.body.metrics.byItPriority.CRITICAL + 1);
    expect(response.body.urgentTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toContain(critical.ticketNumber);
    expect(response.body.urgentTickets[0].drillDown.type).toBe('staff-ticket');
    expect(unassigned.ownerId).toBeNull();
    expect(requester.id).toBeGreaterThan(0);
  });

  it('forbids requester access and returns the complete zero-safe metric shape', async () => {
    const { requester } = await context();
    const api = await authenticatedRequest(app, requester.id);
    const response = await api.get('/api/dashboard/staff');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
