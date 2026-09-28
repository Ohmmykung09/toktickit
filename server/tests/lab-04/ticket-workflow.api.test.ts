import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-WORKFLOW-';

async function context() {
  const [requester, staffUsers, category, relatedSystem] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } }),
    prisma.user.findMany({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'asc' }, take: 2 }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  if (staffUsers.length < 2) throw new Error('Ticket workflow tests require two active Staff users.');
  return { requester, staff: staffUsers[0], secondStaff: staffUsers[1], category, relatedSystem };
}

async function createTicket(requesterId: number, ownerId: number | null) {
  const { category, relatedSystem } = await context();
  const suffix = randomUUID().slice(0, 8);
  return prisma.ticket.create({
    data: {
      ticketNumber: `${prefix}${suffix}`,
      idempotencyKey: randomUUID(),
      requesterId,
      ownerId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Workflow test ${suffix}`,
      description: 'This ticket verifies the Lab 4 workflow and resolution gate.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      status: 'OPEN'
    }
  });
}

async function createCompletedAction(ticketId: number, staffId: number, resolutionCycle: number) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionDateTime: new Date('2026-09-29T09:00:00.000Z'),
      description: 'Completed workflow verification.',
      result: 'The requested change was verified successfully.',
      status: 'COMPLETED',
      resolutionCycle,
      assigneeId: staffId,
      createdById: staffId,
      performedById: staffId,
      completedAt: new Date('2026-09-29T09:05:00.000Z')
    }
  });
}

afterEach(async () => {
  const tickets = await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: prefix } }, select: { id: true } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
});

afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 4 Ticket workflow and resolution rules', () => {
  it('blocks resolution without a current-cycle completed Action and keeps Requester indication advisory', async () => {
    const { requester, staff } = await context();
    const ticket = await createTicket(requester.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const requesterApi = await authenticatedRequest(app, requester.id);
    const expectedUpdatedAt = ticket.updatedAt.toISOString();

    const blocked = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'RESOLVED', expectedUpdatedAt
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('RESOLUTION_ACTION_REQUIRED');

    const indication = await requesterApi.post(`/api/tickets/${ticket.ticketNumber}/problem-appears-resolved`).send({});
    expect(indication.status).toBe(200);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('OPEN');

    await createCompletedAction(ticket.id, staff.id, 1);
    const afterIndication = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const resolved = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'RESOLVED', expectedUpdatedAt: afterIndication.updatedAt.toISOString()
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'RESOLVED', resolutionCycle: 1, resolvedAt: expect.any(String) });
  });

  it('starts a new resolution cycle after reopening and preserves earlier Actions', async () => {
    const { requester, staff } = await context();
    const ticket = await createTicket(requester.id, staff.id);
    await createCompletedAction(ticket.id, staff.id, 1);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    const staffApi = await authenticatedRequest(app, staff.id);

    const resolved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const reopened = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'REOPENED', expectedUpdatedAt: resolved.updatedAt.toISOString()
    });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ status: 'REOPENED', resolutionCycle: 2, resolvedAt: null });

    const withoutNewAction = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'RESOLVED', expectedUpdatedAt: reopened.body.updatedAt
    });
    expect(withoutNewAction.status).toBe(409);
    expect(withoutNewAction.body.error.code).toBe('RESOLUTION_ACTION_REQUIRED');

    await createCompletedAction(ticket.id, staff.id, 2);
    const ready = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const resolvedAgain = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'RESOLVED', expectedUpdatedAt: ready.updatedAt.toISOString()
    });
    expect(resolvedAgain.status).toBe(200);
    expect(resolvedAgain.body.resolutionCycle).toBe(2);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(2);
  });

  it('allows only one concurrent status writer and rejects Requester workflow mutation', async () => {
    const { requester, staff, secondStaff } = await context();
    const ticket = await createTicket(requester.id, staff.id);
    const [staffApi, secondApi, requesterApi] = await Promise.all([
      authenticatedRequest(app, staff.id),
      authenticatedRequest(app, secondStaff.id),
      authenticatedRequest(app, requester.id)
    ]);
    const expectedUpdatedAt = ticket.updatedAt.toISOString();
    const requesterAttempt = await requesterApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({
      status: 'CANCELLED', expectedUpdatedAt
    });
    expect(requesterAttempt.status).toBe(403);

    const [first, second] = await Promise.all([
      staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: 'IN_PROGRESS', expectedUpdatedAt }),
      secondApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: 'CANCELLED', expectedUpdatedAt })
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect([first, second].find((response) => response.status === 409)!.body.error.code).toBe('STALE_WRITE');
  });
});
