import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 3 IT Staff Ticket Queue', () => {
  it('returns the complete requester-independent queue with filters and pagination', async () => {
    const staff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } });
    const api = await authenticatedRequest(app, staff.id);
    const response = await api.get('/api/staff/tickets?page=1&pageSize=10&sortBy=ticketNumber&sortOrder=asc');

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items[0]).toEqual(expect.objectContaining({
      ticketNumber: expect.any(String), requester: expect.objectContaining({ email: expect.any(String) }),
      category: expect.objectContaining({ name: expect.any(String) }), requestedPriority: expect.any(String),
      itPriority: expect.any(String), status: expect.any(String)
    }));
    expect(response.body.filters.owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: staff.id, name: staff.name, role: 'IT_STAFF' })
    ]));
    expect(response.body.pagination).toEqual(expect.objectContaining({ page: 1, pageSize: 10 }));
  });

  it('applies queue search, owner, status, and pagination inputs', async () => {
    const staff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } });
    const api = await authenticatedRequest(app, staff.id);
    const response = await api.get('/api/staff/tickets?search=TKT-20260911-9003&owner=me&status=IN_PROGRESS&page=1&pageSize=20');
    expect(response.status).toBe(200);
    expect(response.body.items.every((item: { owner: { id: number } | null; status: string }) => item.owner?.id === staff.id && item.status === 'IN_PROGRESS')).toBe(true);
  });

  it('rejects invalid or repeated queries and Requester access', async () => {
    const [staff, requester] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
      prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } })
    ]);
    const staffApi = await authenticatedRequest(app, staff.id);
    const requesterApi = await authenticatedRequest(app, requester.id);
    const [invalid, invalidSort, invalidPage, repeated, forbidden] = await Promise.all([
      staffApi.get('/api/staff/tickets?pageSize=12'),
      staffApi.get('/api/staff/tickets?sortBy=owner'),
      staffApi.get('/api/staff/tickets?page=first'),
      staffApi.get('/api/staff/tickets?status=NEW&status=OPEN'),
      requesterApi.get('/api/staff/tickets')
    ]);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_QUERY');
    expect(invalidSort.status).toBe(400);
    expect(invalidPage.status).toBe(400);
    expect(repeated.status).toBe(400);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
});
