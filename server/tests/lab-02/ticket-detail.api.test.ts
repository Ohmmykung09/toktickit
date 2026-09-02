import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 ticket detail API', () => {
  it('returns an owned ticket detail and rejects a different requester', async () => {
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.developmentRequester.findMany({ where: { isActive: true }, take: 2, orderBy: { id: 'asc' } }),
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
    ]);
    const [owner, otherRequester] = requesters;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-DETAIL-${randomUUID().slice(0, 8)}`,
        idempotencyKey: randomUUID(),
        requesterId: owner.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: 'Ticket detail ownership verification',
        description: 'This ticket verifies the requester-owned detail API response.',
        requestedPriority: 'MEDIUM'
      }
    });

    const ownerResponse = await request(app)
      .get(`/api/tickets/${ticket.ticketNumber}`)
      .set('X-Development-Requester-Id', String(owner.id));
    const otherResponse = await request(app)
      .get(`/api/tickets/${ticket.ticketNumber}`)
      .set('X-Development-Requester-Id', String(otherRequester.id));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toEqual(expect.objectContaining({
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: 'Medium',
      attachments: []
    }));
    expect(otherResponse.status).toBe(403);
    expect(otherResponse.body).toEqual({ error: 'You do not have access to this ticket.' });
  });
});
