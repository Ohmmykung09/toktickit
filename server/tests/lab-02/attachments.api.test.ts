import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

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
      requestedPriority: 'LOW'
    }
  });
}

function upload(ticketNumber: string, requesterId: number, filename = 'evidence.pdf', contentType = 'application/pdf') {
  return request(app)
    .post(`/api/tickets/${ticketNumber}/attachments`)
    .set('X-Development-Requester-Id', String(requesterId))
    .attach('file', Buffer.from('attachment evidence'), { filename, contentType });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 attachment APIs', () => {
  it('uploads, lists, downloads, and soft-removes an owned permitted attachment', async () => {
    const requester = await prisma.developmentRequester.findFirstOrThrow({ where: { isActive: true } });
    const ticket = await ticketFor(requester.id);
    const uploaded = await upload(ticket.ticketNumber, requester.id);

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

    const listed = await request(app).get(`/api/tickets/${ticket.ticketNumber}/attachments`).set('X-Development-Requester-Id', String(requester.id));
    const downloaded = await request(app).get(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}/download`).set('X-Development-Requester-Id', String(requester.id));
    const removed = await request(app).delete(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}`).set('X-Development-Requester-Id', String(requester.id));
    const listedAfterRemoval = await request(app).get(`/api/tickets/${ticket.ticketNumber}/attachments`).set('X-Development-Requester-Id', String(requester.id));

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

    const removedWithReason = await request(app)
      .delete(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}`)
      .set('X-Development-Requester-Id', String(requester.id))
      .send({ reason: 'Uploaded the wrong evidence file.' });
    const listedAfterReasonedRemoval = await request(app).get(`/api/tickets/${ticket.ticketNumber}/attachments`).set('X-Development-Requester-Id', String(requester.id));
    const blockedDownload = await request(app).get(`/api/tickets/${ticket.ticketNumber}/attachments/${uploaded.body.id}/download`).set('X-Development-Requester-Id', String(requester.id));

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
      removedByRequesterId: requester.id
    });
  });

  it('rejects disallowed files and attachment access by another requester', async () => {
    const requesters = await prisma.developmentRequester.findMany({ where: { isActive: true }, take: 2 });
    const ticket = await ticketFor(requesters[0].id);
    const invalid = await upload(ticket.ticketNumber, requesters[0].id, 'notes.txt', 'text/plain');
    const otherRequester = await upload(ticket.ticketNumber, requesters[1].id);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/only jpg/i);
    expect(otherRequester.status).toBe(403);
  });

  it('rejects a sixth active attachment', async () => {
    const requester = await prisma.developmentRequester.findFirstOrThrow({ where: { isActive: true } });
    const ticket = await ticketFor(requester.id);

    for (let index = 0; index < 5; index += 1) {
      expect((await upload(ticket.ticketNumber, requester.id, `evidence-${index}.pdf`)).status).toBe(201);
    }
    const sixth = await upload(ticket.ticketNumber, requester.id, 'evidence-six.pdf');

    expect(sixth.status).toBe(400);
    expect(sixth.body.error).toMatch(/at most five/i);
  });
});
