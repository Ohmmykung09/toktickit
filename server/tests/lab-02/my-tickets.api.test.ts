import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

async function createTestTicket(
  requesterId: number,
  summary: string,
  options: { categoryId?: number; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } = {}
) {
  const [category, relatedSystem] = await Promise.all([
    options.categoryId
      ? prisma.category.findUniqueOrThrow({ where: { id: options.categoryId } })
      : prisma.category.findFirstOrThrow({ where: { isActive: true } }),
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
      requestedPriority: options.priority ?? 'MEDIUM',
      itPriority: options.priority ?? 'MEDIUM'
    }
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 My Tickets APIs', () => {
  it('returns only the selected requester tickets with pagination metadata', async () => {
    const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 });
    const marker = `Owned ticket ${Date.now()}`;
    const ownTicket = await createTestTicket(requesters[0].id, marker);
    await createTestTicket(requesters[1].id, `${marker} other requester`);
    const api = await authenticatedRequest(app, requesters[0].id);

    const response = await api
      .get(`/api/tickets?q=${encodeURIComponent(marker)}&sort=ticketNumber&page=1&pageSize=10`)
      .set('X-Development-Requester-Id', String(requesters[0].id));

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ ticketNumber: ownTicket.ticketNumber, summary: marker, status: 'New', requestedPriority: 'Medium' })]);
    expect(response.body.pagination).toEqual(expect.objectContaining({ page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }));
  });

  it('returns details for an owner and blocks another requester', async () => {
    const requesters = await prisma.user.findMany({ where: { isActive: true, role: 'REQUESTER' }, take: 2 });
    const ticket = await createTestTicket(requesters[0].id, `Detail ticket ${Date.now()}`);
    const api = await authenticatedRequest(app, requesters[0].id);

    const ownerResponse = await api.get(`/api/tickets/${ticket.ticketNumber}`).set('X-Development-Requester-Id', String(requesters[0].id));
    const otherResponse = await api.get(`/api/tickets/${ticket.ticketNumber}`).set('X-Development-Requester-Id', String(requesters[1].id));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body).toEqual(expect.objectContaining({ ticketNumber: ticket.ticketNumber, description: ticket.description, attachments: [] }));
    expect(otherResponse.status).toBe(403);
    expect(otherResponse.body.error).toMatch(/do not have access/i);
  });

  it('applies category, status, priority, and sort-direction filters together', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } });
    const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, take: 2 });
    expect(categories.length).toBe(2);
    const marker = `Complete filters ${Date.now()}`;
    const matching = await Promise.all([
      createTestTicket(requester.id, `${marker} B`, { categoryId: categories[1].id, priority: 'HIGH' }),
      createTestTicket(requester.id, `${marker} A`, { categoryId: categories[1].id, priority: 'HIGH' })
    ]);
    await createTestTicket(requester.id, `${marker} other category`, { categoryId: categories[0].id, priority: 'HIGH' });
    await createTestTicket(requester.id, `${marker} other priority`, { categoryId: categories[1].id, priority: 'LOW' });
    const api = await authenticatedRequest(app, requester.id);

    const response = await api
      .get(`/api/tickets?q=${encodeURIComponent(marker)}&categoryId=${categories[1].id}&status=New&priority=High&sort=ticketNumber&direction=asc&page=1&pageSize=10`)
      .set('X-Development-Requester-Id', String(requester.id));

    const expectedTicketNumbers = matching.map((ticket) => ticket.ticketNumber).sort();
    expect(response.status).toBe(200);
    expect(response.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual(expectedTicketNumbers);
    expect(response.body.items.every((ticket: { category: { id: number }; status: string; requestedPriority: string }) => (
      ticket.category.id === categories[1].id && ticket.status === 'New' && ticket.requestedPriority === 'High'
    ))).toBe(true);
  });

  it('returns predictable page boundaries and a no-result state', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } });
    const marker = `Pagination boundary ${Date.now()}`;
    const created = await Promise.all(Array.from({ length: 6 }, (_, index) => (
      createTestTicket(requester.id, `${marker} ${index + 1}`)
    )));
    const orderedNumbers = created.map((ticket) => ticket.ticketNumber).sort();
    const api = await authenticatedRequest(app, requester.id);

    const secondPage = await api
      .get(`/api/tickets?q=${encodeURIComponent(marker)}&sort=ticketNumber&direction=asc&page=2&pageSize=5`)
      .set('X-Development-Requester-Id', String(requester.id));
    const beyondLastPage = await api
      .get(`/api/tickets?q=${encodeURIComponent(marker)}&sort=ticketNumber&direction=asc&page=3&pageSize=5`)
      .set('X-Development-Requester-Id', String(requester.id));
    const noResults = await api
      .get(`/api/tickets?q=${encodeURIComponent(`${marker} missing`)}&page=1&pageSize=5`)
      .set('X-Development-Requester-Id', String(requester.id));

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual([orderedNumbers[5]]);
    expect(secondPage.body.pagination).toEqual({ page: 2, pageSize: 5, totalItems: 6, totalPages: 2 });
    expect(beyondLastPage.body.items).toEqual([]);
    expect(beyondLastPage.body.pagination).toEqual({ page: 3, pageSize: 5, totalItems: 6, totalPages: 2 });
    expect(noResults.body.items).toEqual([]);
    expect(noResults.body.pagination.totalItems).toBe(0);
  });

  it('rejects invalid list parameters safely', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } });
    const api = await authenticatedRequest(app, requester.id);
    const response = await api.get('/api/tickets?page=0').set('X-Development-Requester-Id', String(requester.id));

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/parameters are invalid/i);

    const smallPage = await api.get('/api/tickets?pageSize=4').set('X-Development-Requester-Id', String(requester.id));
    expect(smallPage.status).toBe(400);
  });
});
