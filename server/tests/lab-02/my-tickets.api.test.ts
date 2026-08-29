import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

async function createTestTicket(requesterId: number, summary: string, requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM') {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);
  const token = randomUUID();
  return prisma.ticket.create({
    data: {
      ticketNumber: `TKT-TEST-${token.slice(0, 8)}`,
      idempotencyKey: token,
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary,
      description: 'A complete description used to verify requester ticket ownership.',
      requestedPriority
    }
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 My Tickets APIs', () => {
  it('returns only the selected requester tickets with pagination metadata', async () => {
    const requesters = await prisma.developmentRequester.findMany({ where: { isActive: true }, take: 2 });
    const marker = `Owned ticket ${Date.now()}`;
    const ownTicket = await createTestTicket(requesters[0].id, marker);
    await createTestTicket(requesters[1].id, `${marker} other requester`);

    const response = await request(app)
      .get(`/api/tickets?q=${encodeURIComponent(marker)}&sort=ticketNumber&page=1&pageSize=10`)
      .set('X-Development-Requester-Id', String(requesters[0].id));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ ticketNumber: ownTicket.ticketNumber, summary: marker, status: 'New', requestedPriority: 'Medium' })]);
    expect(response.body.pagination).toEqual(expect.objectContaining({ page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }));
  });

  it('returns details for an owner and blocks another requester', async () => {
    const requesters = await prisma.developmentRequester.findMany({ where: { isActive: true }, take: 2 });
    const ticket = await createTestTicket(requesters[0].id, `Detail ticket ${Date.now()}`);

    const ownerResponse = await request(app).get(`/api/tickets/${ticket.ticketNumber}`).set('X-Development-Requester-Id', String(requesters[0].id));
    const otherResponse = await request(app).get(`/api/tickets/${ticket.ticketNumber}`).set('X-Development-Requester-Id', String(requesters[1].id));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toEqual(expect.objectContaining({ ticketNumber: ticket.ticketNumber, description: ticket.description, attachments: [] }));
    expect(otherResponse.status).toBe(403);
    expect(otherResponse.body.error).toMatch(/do not have access/i);
  });

  it('accepts the title-case priority value sent by the dropdown', async () => {
    const requester = await prisma.developmentRequester.findFirstOrThrow({ where: { isActive: true } });
    const highTicket = await createTestTicket(requester.id, `High priority ${Date.now()}`, 'HIGH');
    await createTestTicket(requester.id, `Low priority ${Date.now()}`, 'LOW');

    const response = await request(app)
      .get('/api/tickets?priority=High&sort=ticketNumber')
      .set('X-Development-Requester-Id', String(requester.id));

    expect(response.status).toBe(200);
    expect(response.body.items).toContainEqual(expect.objectContaining({
      ticketNumber: highTicket.ticketNumber,
      requestedPriority: 'High'
    }));
    expect(response.body.items.every((ticket: { requestedPriority: string }) => ticket.requestedPriority === 'High')).toBe(true);
  });

  it('rejects invalid list parameters safely', async () => {
    const requester = await prisma.developmentRequester.findFirstOrThrow({ where: { isActive: true } });
    const response = await request(app).get('/api/tickets?page=0').set('X-Development-Requester-Id', String(requester.id));

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/parameters are invalid/i);
  });
});
