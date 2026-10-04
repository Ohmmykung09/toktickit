import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const prefix = 'TKT-QTEST-';
let staffId: number;
let otherStaffId: number;
let requesterId: number;
let categoryId: number;
let otherCategoryId: number;
let systemId: number;
let otherSystemId: number;

beforeEach(async () => {
  const [staff, otherStaff, requester, categories, systems] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'asc' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true }, orderBy: { id: 'desc' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true }, orderBy: { id: 'asc' } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, take: 2 }),
    prisma.relatedSystem.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, take: 2 })
  ]);
  if (categories.length < 2 || systems.length < 2 || staff.id === otherStaff.id) throw new Error('Queue tests require two active staff, categories, and systems.');
  staffId = staff.id; otherStaffId = otherStaff.id; requesterId = requester.id;
  categoryId = categories[0].id; otherCategoryId = categories[1].id;
  systemId = systems[0].id; otherSystemId = systems[1].id;
});

afterEach(async () => { await prisma.ticket.deleteMany({ where: { ticketNumber: { startsWith: prefix } } }); });
afterAll(async () => { await prisma.$disconnect(); });

async function ticket(suffix: string, overrides: Record<string, unknown> = {}) {
  return prisma.ticket.create({ data: {
    ticketNumber: `${prefix}${suffix}`, idempotencyKey: randomUUID(), requesterId, categoryId, relatedSystemId: systemId,
    summary: `Queue marker ${suffix}`, description: `Unique queue description marker ${suffix}`,
    requestedPriority: 'HIGH', itPriority: 'CRITICAL', status: 'OPEN', ownerId: staffId, ...overrides
  } });
}

describe('Lab 3 IT Staff Ticket Queue', () => {
  it('searches ticket number, summary, description, requester name, and requester email', async () => {
    const created = await ticket('SEARCH');
    const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterId } });
    const api = await authenticatedRequest(app, staffId);
    for (const search of [created.ticketNumber, 'Queue marker SEARCH', 'description marker SEARCH', requester.name, requester.email]) {
      const response = await api.get(`/api/staff/tickets?search=${encodeURIComponent(search)}&pageSize=50`);
      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toContain(created.ticketNumber);
    }
  });

  it('applies every filter with AND semantics', async () => {
    const match = await ticket('MATCH');
    await ticket('CATEGORY-MISS', { categoryId: otherCategoryId });
    await ticket('SYSTEM-MISS', { relatedSystemId: otherSystemId });
    await ticket('STATUS-MISS', { status: 'NEW' });
    await ticket('REQUESTED-MISS', { requestedPriority: 'LOW' });
    await ticket('IT-MISS', { itPriority: 'LOW' });
    const api = await authenticatedRequest(app, staffId);
    const response = await api.get(`/api/staff/tickets?search=${prefix}&categoryId=${categoryId}&relatedSystemId=${systemId}&status=OPEN&requestedPriority=HIGH&itPriority=CRITICAL&owner=${staffId}&pageSize=50`);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([match.ticketNumber]);
  });

  it('supports mine, unassigned, and a validated specific active owner', async () => {
    const mine = await ticket('MINE');
    const unassigned = await ticket('UNASSIGNED', { ownerId: null });
    const specific = await ticket('SPECIFIC', { ownerId: otherStaffId });
    const api = await authenticatedRequest(app, staffId);
    const [mineResult, unassignedResult, specificResult, invalidOwner] = await Promise.all([
      api.get(`/api/staff/tickets?search=${prefix}&owner=me&pageSize=50`),
      api.get(`/api/staff/tickets?search=${prefix}&owner=unassigned&pageSize=50`),
      api.get(`/api/staff/tickets?search=${prefix}&owner=${otherStaffId}&pageSize=50`),
      api.get('/api/staff/tickets?owner=99999999')
    ]);
    expect(mineResult.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([mine.ticketNumber]);
    expect(unassignedResult.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([unassigned.ticketNumber]);
    expect(specificResult.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([specific.ticketNumber]);
    expect(invalidOwner.status).toBe(400); expect(invalidOwner.body.error.code).toBe('INVALID_QUERY');
  });

  it('sorts both directions with an id tie-break and paginates beyond the last page', async () => {
    const sameTime = new Date('2026-09-12T04:00:00.000Z');
    const first = await ticket('SORT-A', { updatedAt: sameTime });
    const second = await ticket('SORT-B', { updatedAt: sameTime });
    await prisma.ticket.createMany({ data: Array.from({ length: 10 }, (_, index) => ({
      ticketNumber: `${prefix}PAGE-${String(index).padStart(2, '0')}`, idempotencyKey: randomUUID(), requesterId,
      categoryId, relatedSystemId: systemId, summary: `Queue page ${index}`, description: `Queue pagination fixture ${index}`,
      requestedPriority: 'MEDIUM' as const, itPriority: 'MEDIUM' as const, status: 'NEW' as const
    })) });
    const api = await authenticatedRequest(app, staffId);
    const ascending = await api.get(`/api/staff/tickets?search=${prefix}SORT-&sortBy=updatedAt&sortOrder=asc&pageSize=10`);
    const descending = await api.get(`/api/staff/tickets?search=${prefix}SORT-&sortBy=ticketNumber&sortOrder=desc&pageSize=10`);
    const pageOne = await api.get(`/api/staff/tickets?search=${prefix}&sortBy=ticketNumber&sortOrder=asc&page=1&pageSize=10`);
    const pageTwo = await api.get(`/api/staff/tickets?search=${prefix}&sortBy=ticketNumber&sortOrder=asc&page=2&pageSize=10`);
    const beyond = await api.get(`/api/staff/tickets?search=${prefix}&page=999&pageSize=10`);
    expect(ascending.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([first.ticketNumber, second.ticketNumber]);
    expect(descending.body.items.map((item: { ticketNumber: string }) => item.ticketNumber)).toEqual([second.ticketNumber, first.ticketNumber]);
    expect(pageOne.body.items).toHaveLength(10); expect(pageTwo.body.items).toHaveLength(2);
    expect(pageOne.body.pagination).toEqual(expect.objectContaining({ page: 1, pageSize: 10, totalItems: 12, totalPages: 2 }));
    expect(beyond.body.items).toEqual([]); expect(beyond.body.pagination.page).toBe(999);
  });

  it('rejects empty, invalid, repeated, and forbidden requests', async () => {
    const requesterApi = await authenticatedRequest(app, requesterId);
    const staffApi = await authenticatedRequest(app, staffId);
    for (const query of ['search=', 'search=' + 'x'.repeat(101), 'page=0', 'pageSize=12', 'sortBy=owner', 'sortOrder=sideways', 'status=NEW&status=OPEN', 'categoryId=1&categoryId=2']) {
      const response = await staffApi.get(`/api/staff/tickets?${query}`);
      expect(response.status).toBe(400); expect(response.body.error.code).toBe('INVALID_QUERY');
    }
    const forbidden = await requesterApi.get('/api/staff/tickets');
    expect(forbidden.status).toBe(403); expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
});
