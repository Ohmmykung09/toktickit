import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from './auth-router.js';
import { prisma } from './db.js';

export const dashboardRouter = Router();

const operationalStatuses: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_REQUESTER,
  TicketStatus.REOPENED
] as const;

const ticketSummarySelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  status: true,
  updatedAt: true,
  itPriority: true
} satisfies Prisma.TicketSelect;

function windowStart(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function requesterTicketSummary(ticket: Prisma.TicketGetPayload<{ select: typeof ticketSummarySelect }>) {
  return {
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    status: ticket.status,
    updatedAt: ticket.updatedAt,
    drillDown: { type: 'ticket', ticketNumber: ticket.ticketNumber }
  };
}

function staffTicketSummary(ticket: Prisma.TicketGetPayload<{ select: typeof ticketSummarySelect }>) {
  return {
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    status: ticket.status,
    itPriority: ticket.itPriority,
    updatedAt: ticket.updatedAt,
    drillDown: { type: 'staff-ticket', ticketNumber: ticket.ticketNumber }
  };
}

dashboardRouter.get('/dashboard/requester', requireRole(UserRole.REQUESTER), async (request, response, next) => {
  try {
    const requesterId = request.auth!.user.id;
    const now = new Date();
    const recentStart = windowStart(now, 7);
    const owned = { requesterId };
    const operational = { ...owned, status: { in: operationalStatuses } };

    const [openTickets, waitingForRequester, recentlyUpdatedCount, recentlyResolvedCount, attentionTickets, recentTickets] = await Promise.all([
      prisma.ticket.count({ where: operational }),
      prisma.ticket.count({ where: { ...owned, status: TicketStatus.WAITING_FOR_REQUESTER } }),
      prisma.ticket.count({ where: { ...owned, updatedAt: { gte: recentStart, lte: now } } }),
      prisma.ticket.count({ where: { ...owned, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, resolvedAt: { gte: recentStart, lte: now } } }),
      prisma.ticket.findMany({
        where: { ...owned, status: TicketStatus.WAITING_FOR_REQUESTER },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: ticketSummarySelect
      }),
      prisma.ticket.findMany({
        where: { ...owned, updatedAt: { gte: recentStart, lte: now } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: ticketSummarySelect
      })
    ]);

    response.status(200).json({
      metrics: { openTickets, waitingForRequester, recentlyUpdatedCount, recentlyResolvedCount },
      attentionTickets: attentionTickets.map(requesterTicketSummary),
      recentTickets: recentTickets.map(requesterTicketSummary)
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/dashboard/staff', requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR), async (request, response, next) => {
  try {
    const currentUserId = request.auth!.user.id;
    const now = new Date();
    const recentStart = windowStart(now, 7);
    const urgentStart = windowStart(now, 2);
    const operationalWhere = { status: { in: operationalStatuses } };

    const [unassignedTickets, myTickets, operationalTickets, myActionsTaken, statusRows, priorityRows, urgentCandidates] = await Promise.all([
      prisma.ticket.count({ where: { ...operationalWhere, ownerId: null } }),
      prisma.ticket.count({ where: { ...operationalWhere, ownerId: currentUserId } }),
      prisma.ticket.count({ where: operationalWhere }),
      prisma.actionTaken.count({ where: { performedById: currentUserId, actionDateTime: { gte: recentStart, lte: now } } }),
      prisma.ticket.groupBy({ by: ['status'], where: operationalWhere, _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['itPriority'], where: operationalWhere, _count: { _all: true } }),
      prisma.ticket.findMany({
        where: { ...operationalWhere, OR: [{ itPriority: 'CRITICAL' }, { updatedAt: { gte: urgentStart, lte: now } }] },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: ticketSummarySelect
      })
    ]);

    const byStatus = Object.fromEntries(operationalStatuses.map((status) => [status, 0])) as Record<string, number>;
    for (const row of statusRows) byStatus[row.status] = (row._count as { _all?: number })._all ?? 0;
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
    const byItPriority = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<string, number>;
    for (const row of priorityRows) byItPriority[row.itPriority] = (row._count as { _all?: number })._all ?? 0;

    urgentCandidates.sort((left, right) => {
      const criticalDifference = Number(right.itPriority === 'CRITICAL') - Number(left.itPriority === 'CRITICAL');
      if (criticalDifference !== 0) return criticalDifference;
      const updatedDifference = right.updatedAt.getTime() - left.updatedAt.getTime();
      return updatedDifference !== 0 ? updatedDifference : right.id - left.id;
    });

    response.status(200).json({
      metrics: { unassignedTickets, myTickets, myActionsTaken, operationalTickets, byStatus, byItPriority },
      urgentTickets: urgentCandidates.slice(0, 5).map(staffTicketSummary)
    });
  } catch (error) {
    next(error);
  }
});
