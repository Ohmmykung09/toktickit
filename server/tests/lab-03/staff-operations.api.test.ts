import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-OPS-';
const attachmentDirectory = path.resolve(process.cwd(), 'uploads');
const files: string[] = [];
const transitions: Record<string, string[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED'], OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'], REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], CLOSED: ['REOPENED'], CANCELLED: []
};
const statuses = Object.keys(transitions);

async function context() {
  const [requester, staff] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } }),
    prisma.user.findMany({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'asc' }, take: 2 })
  ]);
  const [category, system] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  if (staff.length < 2) throw new Error('Staff operation tests require two active staff users.');
  return { requester, firstStaff: staff[0], secondStaff: staff[1], category, system };
}

async function createTicket(ownerId: number | null = null) {
  const { requester, category, system } = await context();
  const key = randomUUID();
  return prisma.ticket.create({ data: { ticketNumber: `${prefix}${key.slice(0, 8)}`, idempotencyKey: key, requesterId: requester.id, ownerId, categoryId: category.id, relatedSystemId: system.id, summary: 'Staff operation test ticket', description: 'This fixture verifies safe staff ticket operations.', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', status: 'NEW', updatedAt: new Date('2025-01-01T00:00:00.000Z') } });
}

afterEach(async () => {
  await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: prefix } } });
  await Promise.all(files.splice(0).map((file) => unlink(file).catch(() => undefined)));
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 3 IT Staff ticket operations', () => {
  it('loads literal public/internal history and never leaks internal notes to Requesters', async () => {
    const { requester, firstStaff } = await context();
    const ticket = await createTicket(firstStaff.id);
    const publicText = '<script>public literal</script>';
    const privateText = '<script>private literal</script>';
    await prisma.publicComment.create({ data: { ticketId: ticket.id, authorId: requester.id, content: publicText } });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: firstStaff.id, content: privateText } });
    const staffApi = await authenticatedRequest(app, firstStaff.id);
    const requesterApi = await authenticatedRequest(app, requester.id);
    const staffDetail = await staffApi.get(`/api/staff/tickets/${ticket.ticketNumber}`);
    const requesterDetail = await requesterApi.get(`/api/tickets/${ticket.ticketNumber}`);
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body.publicComments[0].content).toBe(publicText);
    expect(staffDetail.body.internalNotes[0].content).toBe(privateText);
    expect(requesterDetail.status).toBe(200);
    expect(requesterDetail.body).not.toHaveProperty('internalNotes');
  });

  it('returns attachment metadata, downloads active files, and safely hides removed/cross-ticket attachments', async () => {
    const { firstStaff } = await context();
    const [ticket, otherTicket] = await Promise.all([createTicket(firstStaff.id), createTicket(firstStaff.id)]);
    const storedFileName = `${randomUUID()}.txt`;
    const filePath = path.join(attachmentDirectory, storedFileName);
    files.push(filePath); await mkdir(attachmentDirectory, { recursive: true }); await writeFile(filePath, 'staff download evidence');
    const active = await prisma.attachment.create({ data: { ticketId: ticket.id, originalFileName: 'evidence.txt', storedFileName, mimeType: 'text/plain', sizeBytes: 23 } });
    const removed = await prisma.attachment.create({ data: { ticketId: ticket.id, originalFileName: 'removed.pdf', storedFileName: `${randomUUID()}.pdf`, mimeType: 'application/pdf', sizeBytes: 10, removedAt: new Date(), removalReason: 'Superseded evidence', removedByUserId: firstStaff.id } });
    const other = await prisma.attachment.create({ data: { ticketId: otherTicket.id, originalFileName: 'other.pdf', storedFileName: `${randomUUID()}.pdf`, mimeType: 'application/pdf', sizeBytes: 10 } });
    const api = await authenticatedRequest(app, firstStaff.id);
    const detail = await api.get(`/api/staff/tickets/${ticket.ticketNumber}`);
    expect(detail.body.attachments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: active.id, originalFileName: 'evidence.txt', removedAt: null }),
      expect.objectContaining({ id: removed.id, removedAt: expect.any(String), removalReason: 'Superseded evidence' })
    ]));
    expect(detail.body.attachments[0]).not.toHaveProperty('storedFileName');
    const download = await api.get(`/api/staff/tickets/${ticket.ticketNumber}/attachments/${active.id}/download`);
    const removedDownload = await api.get(`/api/staff/tickets/${ticket.ticketNumber}/attachments/${removed.id}/download`);
    const crossTicket = await api.get(`/api/staff/tickets/${ticket.ticketNumber}/attachments/${other.id}/download`);
    const missing = await api.get(`/api/staff/tickets/${ticket.ticketNumber}/attachments/99999999/download`);
    expect(download.status).toBe(200); expect(download.text).toBe('staff download evidence');
    for (const response of [removedDownload, crossTicket, missing]) { expect(response.status).toBe(404); expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND'); }
  });

  it.each([
    ['assignment', (first: number, second: number) => [{ ownerId: first }, { ownerId: second }]],
    ['it-priority', () => [{ itPriority: 'HIGH' }, { itPriority: 'CRITICAL' }]],
    ['status', () => [{ status: 'OPEN' }, { status: 'CANCELLED' }]]
  ])('allows exactly one concurrent %s mutation and rejects the stale writer', async (operation, bodies) => {
    const { firstStaff, secondStaff } = await context();
    const ticket = await createTicket(firstStaff.id);
    const [firstApi, secondApi] = await Promise.all([authenticatedRequest(app, firstStaff.id), authenticatedRequest(app, secondStaff.id)]);
    const expectedUpdatedAt = ticket.updatedAt.toISOString();
    const [first, second] = await Promise.all([
      firstApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/${operation}`).send({ ...bodies(firstStaff.id, secondStaff.id)[0], expectedUpdatedAt }),
      secondApi.patch(`/api/staff/tickets/${ticket.ticketNumber}/${operation}`).send({ ...bodies(firstStaff.id, secondStaff.id)[1], expectedUpdatedAt })
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const conflict = [first, second].find((response) => response.status === 409)!;
    expect(conflict.body.error.code).toBe('STALE_WRITE');
  });

  it('enforces the complete status transition matrix through the API', async () => {
    const { firstStaff } = await context();
    const ticket = await createTicket(firstStaff.id);
    const api = await authenticatedRequest(app, firstStaff.id);
    let clock = 0;
    for (const source of statuses) {
      for (const target of statuses) {
        const updatedAt = new Date(1_700_000_000_000 + clock++ * 1000);
        await prisma.ticket.update({ where: { id: ticket.id }, data: { status: source as never, ownerId: firstStaff.id, updatedAt } });
        const response = await api.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: target, expectedUpdatedAt: updatedAt.toISOString() });
        if (source === target) { expect(response.status, `${source} -> ${target}`).toBe(400); }
        else if (transitions[source].includes(target)) { expect(response.status, `${source} -> ${target}`).toBe(200); }
        else { expect(response.status, `${source} -> ${target}`).toBe(409); expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION'); }
      }
    }
  });

  it('requires an owner for every allowed operational transition', async () => {
    const { firstStaff } = await context();
    const ticket = await createTicket(null);
    const api = await authenticatedRequest(app, firstStaff.id);
    const cases = [['NEW', 'IN_PROGRESS'], ['OPEN', 'WAITING_FOR_REQUESTER'], ['OPEN', 'RESOLVED'], ['RESOLVED', 'CLOSED'], ['RESOLVED', 'REOPENED']];
    let clock = 0;
    for (const [source, target] of cases) {
      const updatedAt = new Date(1_710_000_000_000 + clock++ * 1000);
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: source as never, ownerId: null, updatedAt } });
      const response = await api.patch(`/api/staff/tickets/${ticket.ticketNumber}/status`).send({ status: target, expectedUpdatedAt: updatedAt.toISOString() });
      expect(response.status, `${source} -> ${target}`).toBe(409); expect(response.body.error.code).toBe('OWNER_REQUIRED');
    }
  });
});
