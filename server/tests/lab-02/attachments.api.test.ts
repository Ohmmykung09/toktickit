import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

async function ticketFor(requesterId: number) {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  const key = randomUUID();
  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-ATTACH-${key.slice(0, 8)}`,
      idempotencyKey: key,
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Attachment test ${key.slice(0, 8)}`,
      description: 'A complete description used to validate attachment workflows.',
      requestedPriority: 'LOW',
      itPriority: 'LOW'
    }
  });
}

async function upload(ticketNumber: string, requesterId: number, filename = 'evidence.pdf', contentType = 'application/pdf') {
  const api = await authenticatedRequest(app, requesterId);
  return api
    .post(`/api/tickets/${ticketNumber}/attachments`)
    .attach('file', Buffer.from('attachment evidence'), { filename, contentType });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 attachment APIs', () => {
  it('uploads, lists, downloads, and soft-removes an owned permitted attachment', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } });
    const ticket = await ticketFor(requester.id);
    const uploaded = await upload(ticket.ticketNumber, requester.id);
    const api = await authenticatedRequest(app, requester.id);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toEqual({
      id: expect.any(Number),
      originalFileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: expect.any(Number),
      createdAt: expect.any(String),
      removedAt: null,
      removalReason: null
    });

    const listed = await api.get(`/api/tickets/${ticket.ticketNumber}/attachments`);
    const downloaded = await api.get(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}/download`);
    const removed = await api.delete(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}`);
    const listedAfterRemoval = await api.get(`/api/tickets/${ticket.ticketNumber}/attachments`);

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([{
      id: uploaded.body.id,
      originalFileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: expect.any(Number),
      createdAt: expect.any(String),
      removedAt: null,
      removalReason: null
    }]);
    expect(downloaded.status).toBe(200);
    expect(removed.status).toBe(400);
    expect(listedAfterRemoval.body).toEqual(listed.body);

    const removedWithReason = await api
      .delete(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}`)
      .send({ reason: 'Uploaded the wrong evidence file.' });
    const listedAfterReasonedRemoval = await api.get(`/api/tickets/${ticket.ticketNumber}/attachments`);
    const blockedDownload = await api.get(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}/download`);

    expect(removedWithReason.status).toBe(200);
    expect(removedWithReason.body).toEqual({
      id: uploaded.body.id,
      originalFileName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: expect.any(Number),
      createdAt: expect.any(String),
      removedAt: expect.any(String),
      removalReason: 'Uploaded the wrong evidence file.'
    });
    expect(listedAfterReasonedRemoval.body).toEqual([removedWithReason.body]);
    expect(blockedDownload.status).toBe(404);
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: uploaded.body.id } }))).toMatchObject({
      removedAt: expect.any(Date),
      removalReason: 'Uploaded the wrong evidence file.',
      removedByUserId: requester.id
    });
  });

  it('rejects disallowed files and attachment access by another requester', async () => {
    const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 });
    const ticket = await ticketFor(requesters[0].id);
    const invalid = await upload(ticket.ticketNumber, requesters[0].id, 'notes.txt', 'text/plain');
    const otherRequester = await upload(ticket.ticketNumber, requesters[1].id);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/only jpg/i);
    expect(otherRequester.status).toBe(404);
    expect(otherRequester.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('rejects a sixth active attachment', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } });
    const ticket = await ticketFor(requester.id);

    for (let index = 0; index < 5; index += 1) {
      expect((await upload(ticket.ticketNumber, requester.id, `evidence-${index}.pdf`)).status).toBe(201);
    }
    const sixth = await upload(ticket.ticketNumber, requester.id, 'evidence-six.pdf');

    expect(sixth.status).toBe(400);
    expect(sixth.body.error).toMatch(/at most five/i);
  });
});
