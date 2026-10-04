import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 ticket detail API', () => {
  it('returns an owned ticket detail and rejects a different requester', async () => {
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2, orderBy: { id: 'asc' } }),
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
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM'
      }
    });
    const api = await authenticatedRequest(app, owner.id);
    const otherApi = await authenticatedRequest(app, otherRequester.id);

    const ownerResponse = await api.get(`/api/tickets/${ticket.ticketNumber}`);
    const otherResponse = await otherApi.get(`/api/tickets/${ticket.ticketNumber}`);

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toEqual(expect.objectContaining({
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: 'Medium',
      attachments: []
    }));
    expect(otherResponse.status).toBe(404);
    expect(otherResponse.body).toEqual({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found.' }
    });
  });
});
