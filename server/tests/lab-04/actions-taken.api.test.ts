import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { env } from '../../src/env.js';
import { authenticatedRequest } from '../authenticated-request.js';
import request from 'supertest';

const prefix = 'TKT-ACTION-';
const createdUsers: number[] = [];

function recentActionDate() {
  return new Date(Date.now() - 60_000).toISOString();
}

async function context() {
  const [requesters, staff, administrator, category, relatedSystem] = await Promise.all([
    prisma.user.findMany({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' }, take: 2 }),
    prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
    prisma.user.findFirstOrThrow({ where: { role: 'ADMINISTRATOR', isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  if (requesters.length < 2) throw new Error('Actions Taken tests require two active Requesters.');
  return { owner: requesters[0], otherRequester: requesters[1], staff, administrator, category, relatedSystem };
}

async function createTicket(requesterId: number, ownerId: number | null = null) {
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
      summary: `Action Taken test ${suffix}`,
      description: 'This ticket verifies the Actions Taken API and authorization rules.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      status: 'OPEN'
    }
  });
}

async function createAction(ticketId: number, actorId: number, data: Record<string, unknown> = {}) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionDateTime: new Date('2026-09-29T08:00:00.000Z'),
      description: 'Reviewed the service desk evidence.',
      result: 'The next troubleshooting step was identified.',
      createdById: actorId,
      performedById: actorId,
      ...data
    }
  });
}

afterEach(async () => {
  const tickets = await prisma.ticket.findMany({ where: { ticketNumber: { startsWith: prefix } }, select: { id: true } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: tickets.map((ticket) => ticket.id) } } });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((ticket) => ticket.id) } } });
  if (createdUsers.length) await prisma.user.deleteMany({ where: { id: { in: createdUsers.splice(0) } } });
});

afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 4 Actions Taken API and authorization', () => {
  it('lets Staff create and list Actions while deriving audit identities from the session', async () => {
    const { owner, otherRequester, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const ownerApi = await authenticatedRequest(app, owner.id);
    const otherApi = await authenticatedRequest(app, otherRequester.id);
    const idempotencyKey = randomUUID();

    const payload = {
      actionDateTime: recentActionDate(),
      assigneeId: staff.id,
      description: 'Checked the access point logs.',
      result: 'The access point needs a controlled restart.',
      followUpRequired: true,
      followUpNote: 'Confirm stability with the requester.',
      performedById: otherRequester.id,
      createdById: otherRequester.id
    };
    const created = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'OPEN',
      version: 1,
      followUpRequired: true,
      createdBy: { id: staff.id, role: 'IT_STAFF' },
      performedBy: { id: staff.id, role: 'IT_STAFF' },
      assignee: { id: staff.id, role: 'IT_STAFF' }
    });

    const ownerList = await ownerApi.get(`/api/tickets/${ticket.ticketNumber}/actions-taken`);
    const staffList = await staffApi.get(`/api/tickets/${ticket.ticketNumber}/actions-taken`);
    const crossOwnerList = await otherApi.get(`/api/tickets/${ticket.ticketNumber}/actions-taken`);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body).toHaveLength(1);
    expect(staffList.status).toBe(200);
    expect(crossOwnerList.status).toBe(404);
    expect(crossOwnerList.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const replay = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    const conflict = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...payload, result: 'A different retry payload.' });
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(created.body.id);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it('rejects Requester mutations and invalid follow-up data without partial writes', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const ownerApi = await authenticatedRequest(app, owner.id);
    const staffApi = await authenticatedRequest(app, staff.id);

    const invalid = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', randomUUID())
      .send({
      actionDateTime: '2026-09-29T08:30:00.000Z',
      description: 'Invalid follow-up fixture',
      result: 'It must be rejected.',
      followUpRequired: true
      });
    expect(invalid.status).toBe(400);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);

    const requesterCreate = await ownerApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', randomUUID())
      .send({
      description: 'Requester must not create this.',
      result: 'Forbidden.'
      });
    expect(requesterCreate.status).toBe(403);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it('requires an approved Origin and session CSRF token before creating an Action Taken', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const payload = {
      actionDateTime: recentActionDate(),
      description: 'Reject an unverified mutation.',
      result: 'No Action Taken should be committed.',
      assigneeId: staff.id
    };
    const missingOrigin = await request(app)
      .post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Cookie', staffApi.cookie)
      .set('X-CSRF-Token', staffApi.csrfToken)
      .set('Idempotency-Key', randomUUID())
      .send(payload);
    const wrongCsrf = await request(app)
      .post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Cookie', staffApi.cookie)
      .set('Origin', env.clientOrigin)
      .set('X-CSRF-Token', 'not-the-session-token')
      .set('Idempotency-Key', randomUUID())
      .send(payload);
    const workflowPath = `/api/staff/tickets/${ticket.ticketNumber}/status`;
    const missingWorkflowOrigin = await request(app)
      .patch(workflowPath)
      .set('Cookie', staffApi.cookie)
      .set('X-CSRF-Token', staffApi.csrfToken)
      .send({ status: 'IN_PROGRESS', expectedUpdatedAt: ticket.updatedAt.toISOString() });
    const wrongWorkflowCsrf = await request(app)
      .patch(workflowPath)
      .set('Cookie', staffApi.cookie)
      .set('Origin', env.clientOrigin)
      .set('X-CSRF-Token', 'not-the-session-token')
      .send({ status: 'IN_PROGRESS', expectedUpdatedAt: ticket.updatedAt.toISOString() });

    for (const response of [missingOrigin, wrongCsrf, missingWorkflowOrigin, wrongWorkflowCsrf]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_REJECTED');
    }
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('OPEN');
  });

  it('cancels an Action Taken and rejects all later edits to its terminal history', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const action = await createAction(ticket.id, staff.id, { assigneeId: staff.id });
    const staffApi = await authenticatedRequest(app, staff.id);

    const cancelled = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${action.id}`)
      .send({ status: 'CANCELLED', expectedVersion: 1 });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', version: 2, cancelledAt: expect.any(String) });

    const attemptedEdit = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${action.id}`)
      .send({ expectedVersion: 2, description: 'This terminal Action must remain unchanged.' });
    expect(attemptedEdit.status).toBe(409);
    expect(attemptedEdit.body.error.code).toBe('ACTION_TERMINAL');
    const persisted = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(persisted).toMatchObject({
      status: 'CANCELLED',
      version: 2,
      description: action.description,
      result: action.result
    });
  });

  it('validates assignees, completes Actions, and rejects stale updates', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const created = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', randomUUID())
      .send({
      actionDateTime: recentActionDate(),
      description: 'Prepare a completion update.',
      result: 'The action is ready to complete.',
      assigneeId: staff.id
      });
    expect(created.status).toBe(201);

    const [first, second] = await Promise.all([
      staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${created.body.id}`).send({
        status: 'COMPLETED',
        expectedVersion: 1,
        result: 'Connectivity was verified after the change.',
        assigneeId: staff.id
      }),
      staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${created.body.id}`).send({
        expectedVersion: 1,
        description: 'A stale description update.'
      })
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const conflict = [first, second].find((response) => response.status === 409)!;
    expect(conflict.body.error.code).toBe('STALE_WRITE');
    const completed = first.status === 200 ? first : second;
    expect(completed.body).toMatchObject({ status: 'COMPLETED', version: 2, completedAt: expect.any(String) });
  });

  it('allows attachment notes to be cleared and treats expectedVersion-only updates as no-ops', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const created = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', randomUUID())
      .send({
        actionDateTime: recentActionDate(),
        description: 'Prepare a clear operation.',
        result: 'The stored note can be cleared.',
        attachmentNotes: 'Remove this note.',
        assigneeId: staff.id
      });
    expect(created.status).toBe(201);

    const cleared = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${created.body.id}`)
      .send({ expectedVersion: 1, attachmentNotes: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ attachmentNotes: null, version: 2 });
    const unchanged = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken/${created.body.id}`)
      .send({ expectedVersion: 2 });
    expect(unchanged.status).toBe(200);
    expect(unchanged.body).toMatchObject({ attachmentNotes: null, version: 2, performedBy: { id: staff.id } });
    expect(unchanged.body.updatedAt).toBe(cleared.body.updatedAt);
  });

  it('rejects an inactive assignee inside the mutation transaction', async () => {
    const { owner, staff } = await context();
    const inactive = await prisma.user.create({
      data: { name: 'Inactive Action Assignee', email: `${randomUUID()}@action-test.example`, role: 'IT_STAFF', isActive: false }
    });
    createdUsers.push(inactive.id);
    const ticket = await createTicket(owner.id, staff.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    const response = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/actions-taken`)
      .set('Idempotency-Key', randomUUID())
      .send({
      actionDateTime: recentActionDate(),
      description: 'Try inactive assignment.',
      result: 'This must not be assigned.',
      assigneeId: inactive.id
      });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INACTIVE_ASSIGNEE');
  });
});
