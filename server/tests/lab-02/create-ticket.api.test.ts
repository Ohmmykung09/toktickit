import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

async function ticketContext() {
  const [requester, category, relatedSystem] = await Promise.all([
    prisma.developmentRequester.findFirstOrThrow({ where: { isActive: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  ]);

  return { requester, category, relatedSystem };
}

function validTicket(categoryId: number, relatedSystemId: number, summary = 'Unable to connect to campus Wi-Fi') {
  return {
    categoryId,
    relatedSystemId,
    summary,
    requestedPriority: 'HIGH',
    description: 'The campus Wi-Fi connection fails repeatedly on my assigned laptop.'
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 create ticket API', () => {
  it('creates a New ticket for the selected active requester', async () => {
    const { requester, category, relatedSystem } = await ticketContext();
    const response = await request(app)
      .post('/api/tickets')
      .set('X-Development-Requester-Id', String(requester.id))
      .set('Idempotency-Key', randomUUID())
      .send(validTicket(category.id, relatedSystem.id));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ticketNumber: expect.stringMatching(/^TKT-\d{8}-\d{4}$/),
      status: 'New',
      createdAt: expect.any(String)
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: response.body.ticketNumber }
    });
    expect(ticket).toMatchObject({
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      status: 'NEW',
      requestedPriority: 'HIGH'
    });
  });

  it('returns the original ticket for a retry and rejects different ticket details for the same key', async () => {
    const { requester, category, relatedSystem } = await ticketContext();
    const otherRequester = await prisma.developmentRequester.findFirstOrThrow({
      where: { isActive: true, id: { not: requester.id } }
    });
    const key = randomUUID();
    const ticket = validTicket(category.id, relatedSystem.id, `Printer request ${Date.now()}`);

    const first = await request(app).post('/api/tickets').set('X-Development-Requester-Id', String(requester.id)).set('Idempotency-Key', key).send(ticket);
    const retry = await request(app).post('/api/tickets').set('X-Development-Requester-Id', String(requester.id)).set('Idempotency-Key', key).send(ticket);
    const conflict = await request(app).post('/api/tickets').set('X-Development-Requester-Id', String(requester.id)).set('Idempotency-Key', key).send({ ...ticket, summary: 'Different printer request' });
    const otherRequesterTicket = await request(app).post('/api/tickets').set('X-Development-Requester-Id', String(otherRequester.id)).set('Idempotency-Key', key).send(ticket);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toMatch(/idempotency key/i);
    expect(otherRequesterTicket.status).toBe(201);
    expect(otherRequesterTicket.body.ticketNumber).not.toBe(first.body.ticketNumber);
    expect(await prisma.ticket.count({ where: { requesterId: requester.id, idempotencyKey: key } })).toBe(1);
    expect(await prisma.ticket.count({ where: { idempotencyKey: key } })).toBe(2);
  });

  it('rejects missing requester context, inactive requesters, and invalid lookup values safely', async () => {
    const { requester, category, relatedSystem } = await ticketContext();
    const inactiveRequester = await prisma.developmentRequester.findFirstOrThrow({
      where: { isActive: false }
    });
    const response = await request(app).post('/api/tickets').send({ summary: 'Bad' });
    const inactiveRequesterResponse = await request(app)
      .post('/api/tickets')
      .set('X-Development-Requester-Id', String(inactiveRequester.id))
      .set('Idempotency-Key', randomUUID())
      .send(validTicket(category.id, relatedSystem.id));
    const invalidLookupResponse = await request(app)
      .post('/api/tickets')
      .set('X-Development-Requester-Id', String(requester.id))
      .set('Idempotency-Key', randomUUID())
      .send(validTicket(999999, relatedSystem.id));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Ticket details are invalid.' });
    expect(inactiveRequesterResponse.status).toBe(400);
    expect(invalidLookupResponse.status).toBe(400);
    expect(invalidLookupResponse.body.error).toMatch(/lookup values are invalid/i);
  });
});
