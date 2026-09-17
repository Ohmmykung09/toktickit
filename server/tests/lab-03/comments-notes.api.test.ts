import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { setCommunicationTestHooksForTesting } from '../../src/communication-router.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-MESSAGE-';

async function context() {
  const [requesters, staff, administrator, category, relatedSystem] = await Promise.all([
    prisma.user.findMany({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' }, take: 2 }),
    prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
    prisma.user.findFirstOrThrow({ where: { role: 'ADMINISTRATOR', isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  if (requesters.length < 2) throw new Error('Message tests require two active Requesters.');
  return { owner: requesters[0], otherRequester: requesters[1], staff, administrator, category, relatedSystem };
}

async function createTicket(requesterId: number) {
  const { category, relatedSystem } = await context();
  const suffix = randomUUID().slice(0, 8);
  return prisma.ticket.create({
    data: {
      ticketNumber: `${prefix}${suffix}`,
      idempotencyKey: randomUUID(),
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Communication test ${suffix}`,
      description: 'This ticket verifies Public Comments, Internal Notes, and resolution indication.',
      requestedPriority: 'MEDIUM',
      itPriority: 'MEDIUM',
      status: 'OPEN'
    }
  });
}

afterEach(async () => {
  setCommunicationTestHooksForTesting({});
  await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: prefix } } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 3 Public Comments, Internal Notes, and resolution indication', () => {
  it('creates and returns Public Comments oldest-first with backend author and time', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id);
    const [ownerApi, staffApi] = await Promise.all([
      authenticatedRequest(app, owner.id),
      authenticatedRequest(app, staff.id)
    ]);
    const literal = '<script>alert("literal")</script>\nRequester update';

    const requesterComment = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`).send({ content: `  ${literal}  ` });
    const staffComment = await staffApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`).send({ content: 'Staff response' });
    const listed = await ownerApi.get(`/api/tickets/${ticket.ticketNumber}/public-comments`);

    expect(requesterComment.status).toBe(201);
    expect(requesterComment.body).toEqual(expect.objectContaining({
      content: literal,
      createdAt: expect.any(String),
      author: { id: owner.id, name: owner.name, role: 'REQUESTER' }
    }));
    expect(staffComment.status).toBe(201);
    expect(staffComment.body.author).toEqual({ id: staff.id, name: staff.name, role: 'IT_STAFF' });
    expect(listed.status).toBe(200);
    expect(listed.body.map((comment: { id: number }) => comment.id)).toEqual([requesterComment.body.id, staffComment.body.id]);
  });

  it('validates Public Comment content and hides owned resources from another Requester', async () => {
    const { owner, otherRequester } = await context();
    const ticket = await createTicket(owner.id);
    const [ownerApi, otherApi] = await Promise.all([
      authenticatedRequest(app, owner.id),
      authenticatedRequest(app, otherRequester.id)
    ]);

    for (const content of ['', '   ', 'x'.repeat(2_001)]) {
      const invalid = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`).send({ content });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    }
    const unexpected = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`).send({ content: 'valid', authorId: owner.id });
    expect(unexpected.status).toBe(400);

    const crossGet = await otherApi.get(`/api/tickets/${ticket.ticketNumber}/public-comments`);
    const crossPost = await otherApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`).send({ content: 'Should remain hidden' });
    const missing = await otherApi.get(`/api/tickets/${prefix}MISSING/public-comments`);
    expect(crossGet.status).toBe(404);
    expect(crossPost.status).toBe(404);
    expect(crossGet.body).toEqual(missing.body);
    expect(crossPost.body).toEqual(missing.body);
  });

  it('accepts 2,000 Unicode code points and rejects 2,001 or malformed input safely', async () => {
    const { owner } = await context();
    const ticket = await createTicket(owner.id);
    const ownerApi = await authenticatedRequest(app, owner.id);
    const emoji = '\u{1f600}';

    const boundary = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`)
      .send({ content: emoji.repeat(2_000) });
    const oversized = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`)
      .send({ content: emoji.repeat(2_001) });
    const malformed = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`)
      .send({ content: '\ud800' });

    expect(boundary.status).toBe(201);
    expect(Array.from(boundary.body.content)).toHaveLength(2_000);
    expect(oversized.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a Public Comment when the Requester is deactivated before the write transaction', async () => {
    const { owner } = await context();
    const ticket = await createTicket(owner.id);
    const ownerApi = await authenticatedRequest(app, owner.id);
    let enterHook!: () => void;
    let releaseHook!: () => void;
    const entered = new Promise<void>((resolve) => { enterHook = resolve; });
    const released = new Promise<void>((resolve) => { releaseHook = resolve; });
    setCommunicationTestHooksForTesting({
      beforeWriteTransaction: async (kind, actorId) => {
        if (kind === 'public' && actorId === owner.id) {
          enterHook();
          await released;
        }
      }
    });

    try {
      const pending = ownerApi.post(`/api/tickets/${ticket.ticketNumber}/public-comments`)
        .send({ content: 'Must not survive deactivation.' })
        .then((response) => response);
      await entered;
      await prisma.user.update({ where: { id: owner.id }, data: { isActive: false } });
      releaseHook();
      const response = await pending;

      expect(response.status).toBe(403);
      expect(await prisma.publicComment.count({ where: { ticketId: ticket.id } })).toBe(0);
    } finally {
      releaseHook();
      await prisma.user.update({ where: { id: owner.id }, data: { isActive: true } });
    }
  });

  it('allows only staff roles to create/read append-only Internal Notes', async () => {
    const { owner, staff, administrator } = await context();
    const ticket = await createTicket(owner.id);
    const [requesterApi, staffApi, administratorApi] = await Promise.all([
      authenticatedRequest(app, owner.id),
      authenticatedRequest(app, staff.id),
      authenticatedRequest(app, administrator.id)
    ]);

    const first = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`).send({ content: '  <b>literal private note</b>  ' });
    const second = await administratorApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`).send({ content: 'Administrator follow-up' });
    const listed = await staffApi.get(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`);
    const forbiddenGet = await requesterApi.get(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`);
    const forbiddenPost = await requesterApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`).send({ content: 'Forbidden' });

    expect(first.status).toBe(201);
    expect(first.body.content).toBe('<b>literal private note</b>');
    expect(first.body.author).toEqual({ id: staff.id, name: staff.name, role: 'IT_STAFF' });
    expect(second.status).toBe(201);
    expect(listed.body.map((note: { id: number }) => note.id)).toEqual([first.body.id, second.body.id]);
    expect(forbiddenGet.status).toBe(403);
    expect(forbiddenPost.status).toBe(403);
    expect(JSON.stringify(forbiddenGet.body)).not.toContain('literal private note');

    const edit = await staffApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes/${first.body.id}`).send({ content: 'Edited' });
    const remove = await staffApi.delete(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes/${first.body.id}`);
    expect(edit.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(2);
  });

  it('validates Internal Note boundaries', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    for (const content of ['', ' '.repeat(4), 'x'.repeat(2_001)]) {
      const invalid = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`).send({ content });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.fieldErrors.content).toBeTruthy();
    }
    const boundary = await staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`).send({ content: 'x'.repeat(2_000) });
    expect(boundary.status).toBe(201);
    expect(boundary.body.content).toHaveLength(2_000);
  });

  it('rejects an Internal Note when Staff is demoted before the write transaction', async () => {
    const { owner, staff } = await context();
    const ticket = await createTicket(owner.id);
    const staffApi = await authenticatedRequest(app, staff.id);
    let enterHook!: () => void;
    let releaseHook!: () => void;
    const entered = new Promise<void>((resolve) => { enterHook = resolve; });
    const released = new Promise<void>((resolve) => { releaseHook = resolve; });
    setCommunicationTestHooksForTesting({
      beforeWriteTransaction: async (kind, actorId) => {
        if (kind === 'internal' && actorId === staff.id) {
          enterHook();
          await released;
        }
      }
    });

    try {
      const pending = staffApi.post(`/api/staff/tickets/${ticket.ticketNumber}/internal-notes`)
        .send({ content: 'Must not survive a role change.' })
        .then((response) => response);
      await entered;
      await prisma.user.update({ where: { id: staff.id }, data: { role: 'REQUESTER' } });
      releaseHook();
      const response = await pending;

      expect(response.status).toBe(403);
      expect(await prisma.internalNote.count({ where: { ticketId: ticket.id } })).toBe(0);
    } finally {
      releaseHook();
      await prisma.user.update({ where: { id: staff.id }, data: { role: 'IT_STAFF' } });
    }
  });

  it('records the Requester resolution indication idempotently without changing formal status', async () => {
    const { owner, otherRequester, staff } = await context();
    const ticket = await createTicket(owner.id);
    const [ownerApi, otherApi, staffApi] = await Promise.all([
      authenticatedRequest(app, owner.id),
      authenticatedRequest(app, otherRequester.id),
      authenticatedRequest(app, staff.id)
    ]);

    const first = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/problem-appears-resolved`);
    const repeated = await ownerApi.post(`/api/tickets/${ticket.ticketNumber}/problem-appears-resolved`);
    const crossOwner = await otherApi.post(`/api/tickets/${ticket.ticketNumber}/problem-appears-resolved`);
    const forbiddenStaff = await staffApi.post(`/api/tickets/${ticket.ticketNumber}/problem-appears-resolved`);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toEqual(first.body);
    expect(crossOwner.status).toBe(404);
    expect(forbiddenStaff.status).toBe(403);
    expect(stored.requesterResolutionIndicatedById).toBe(owner.id);
    expect(stored.status).toBe(ticket.status);
  });
});
