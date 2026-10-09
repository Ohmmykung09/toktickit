import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Prisma } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

const ticketPrefix = 'TKT-PERF-';
const ticketCount = 10_000;
const actionCount = 50_000;

async function removePerformanceFixtures() {
  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: ticketPrefix } },
    select: { id: true }
  });
  const ticketIds = tickets.map(({ id }) => id);
  if (!ticketIds.length) return;
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
}

afterEach(removePerformanceFixtures);
afterAll(async () => { await prisma.$disconnect(); });

describe('Lab 4 dashboard and Action Taken performance smoke', () => {
  it('keeps dashboard and indexed action-list reads under 500 ms at 10k Tickets and 50k Actions', async () => {
    const [requester, staff, category, relatedSystem] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } }),
      prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: true } }),
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
    ]);
    const now = new Date();
    const ticketRows: Prisma.TicketCreateManyInput[] = Array.from({ length: ticketCount }, (_, index) => ({
      ticketNumber: `${ticketPrefix}${String(index).padStart(5, '0')}`,
      idempotencyKey: randomUUID(),
      requesterId: requester.id,
      ownerId: staff.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: `Performance smoke ticket ${index}`,
      description: 'Synthetic fixture used only in the isolated Lab 4 performance smoke.',
      requestedPriority: 'MEDIUM',
      itPriority: index % 100 === 0 ? 'CRITICAL' : 'MEDIUM',
      status: 'OPEN',
      createdAt: now,
      updatedAt: now
    }));
    for (let offset = 0; offset < ticketRows.length; offset += 2_000) {
      await prisma.ticket.createMany({ data: ticketRows.slice(offset, offset + 2_000) });
    }

    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: ticketPrefix } },
      orderBy: { ticketNumber: 'asc' },
      select: { id: true }
    });
    expect(tickets).toHaveLength(ticketCount);

    for (let offset = 0; offset < actionCount; offset += 2_000) {
      const rows: Prisma.ActionTakenCreateManyInput[] = Array.from({ length: Math.min(2_000, actionCount - offset) }, (_, index) => {
        const sequence = offset + index;
        return {
          ticketId: tickets[Math.floor(sequence / 5)].id,
          actionDateTime: sequence < 100 ? now : new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
          description: `Performance smoke action ${sequence}`,
          result: 'Synthetic action result for indexed-list and dashboard measurements.',
          status: 'OPEN',
          assigneeId: staff.id,
          createdById: staff.id,
          performedById: staff.id
        };
      });
      await prisma.actionTaken.createMany({ data: rows });
    }

    await prisma.$executeRawUnsafe('ANALYZE "Ticket"');
    await prisma.$executeRawUnsafe('ANALYZE "ActionTaken"');

    const staffApi = await authenticatedRequest(app, staff.id);
    const dashboardPath = '/api/dashboard/staff';
    const actionPath = `/api/tickets/${ticketPrefix}00000/actions-taken`;
    const dashboardWarmup = await staffApi.get(dashboardPath);
    const actionsWarmup = await staffApi.get(actionPath);
    expect(dashboardWarmup.status).toBe(200);
    expect(dashboardWarmup.body.urgentTickets).toHaveLength(5);
    expect(actionsWarmup.status).toBe(200);
    expect(actionsWarmup.body).toHaveLength(5);

    async function measure(path: string) {
      const samples: number[] = [];
      for (let sample = 0; sample < 5; sample += 1) {
        const startedAt = performance.now();
        const response = await staffApi.get(path);
        samples.push(performance.now() - startedAt);
        expect(response.status).toBe(200);
      }
      samples.sort((left, right) => left - right);
      const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
      expect(p95, `${path} p95: ${p95.toFixed(1)} ms; samples: ${samples.map((value) => value.toFixed(1)).join(', ')}`).toBeLessThanOrEqual(500);
      return p95;
    }

    const dashboardP95 = await measure(dashboardPath);
    const actionListP95 = await measure(actionPath);
    const actionQueryPlan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>(Prisma.sql`
      EXPLAIN (FORMAT JSON)
      SELECT "id", "actionDateTime"
      FROM "ActionTaken"
      WHERE "ticketId" = ${tickets[0].id}
      ORDER BY "actionDateTime" ASC, "id" ASC
    `);
    const performerQueryPlan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>(Prisma.sql`
      EXPLAIN (FORMAT JSON)
      SELECT COUNT(*)
      FROM "ActionTaken"
      WHERE "performedById" = ${staff.id}
        AND "actionDateTime" >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
        AND "actionDateTime" <= ${now}
    `);
    const actionPlan = JSON.stringify(actionQueryPlan);
    const performerPlan = JSON.stringify(performerQueryPlan);
    expect(actionPlan).toContain('ActionTaken_ticketId_actionDateTime_id_idx');
    expect(performerPlan).toContain('ActionTaken_performedById_actionDateTime_idx');
    console.info(`Lab 4 performance p95: staff dashboard ${dashboardP95.toFixed(1)} ms; Action Taken list ${actionListP95.toFixed(1)} ms; 10,000 Tickets / 50,000 Actions.`);
  }, 240_000);
});
