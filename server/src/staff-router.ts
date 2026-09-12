import { Prisma, RequestedPriority, TicketStatus, UserRole } from '@prisma/client';
import { Router } from 'express';
import { prisma } from './db.js';
import { requireRole } from './auth-router.js';

export const staffRouter = Router();

const staffOnly = requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR);
const pageSizes = [10, 20, 50] as const;
const sortFields = ['createdAt', 'updatedAt', 'ticketNumber', 'requestedPriority', 'itPriority', 'status'] as const;
const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  CLOSED: ['REOPENED'],
  CANCELLED: []
};

const staffTicketSelect = {
  ticketNumber: true, summary: true, description: true, requestedPriority: true, itPriority: true,
  status: true, requesterResolutionIndicatedAt: true, createdAt: true, updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], select: { id: true, originalFileName: true, mimeType: true, sizeBytes: true, createdAt: true, removedAt: true, removalReason: true } },
  publicComments: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } },
  internalNotes: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } }
} satisfies Prisma.TicketSelect;

function fail(response: Parameters<Parameters<typeof staffRouter.get>[1]>[1], status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message } });
}

function singleQuery(value: unknown) {
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function positiveInteger(value: unknown) {
  const item = singleQuery(value);
  if (item === undefined) return undefined;
  if (item === null || !/^\d+$/.test(item)) return null;
  const parsed = Number(item);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function enumValue<T extends string>(value: unknown, values: readonly T[]) {
  const item = singleQuery(value);
  if (item === undefined) return undefined;
  return item !== null && values.includes(item as T) ? item as T : null;
}

staffRouter.get('/staff/tickets', staffOnly, async (request, response, next) => {
  try {
    const searchValue = singleQuery(request.query.search);
    const search = typeof searchValue === 'string' ? searchValue.trim() : searchValue;
    const categoryId = positiveInteger(request.query.categoryId);
    const relatedSystemId = positiveInteger(request.query.relatedSystemId);
    const status = enumValue(request.query.status, Object.values(TicketStatus));
    const requestedPriority = enumValue(request.query.requestedPriority, Object.values(RequestedPriority));
    const itPriority = enumValue(request.query.itPriority, Object.values(RequestedPriority));
    const owner = singleQuery(request.query.owner);
    const sortByValue = enumValue(request.query.sortBy, sortFields);
    const sortOrderValue = enumValue(request.query.sortOrder, ['asc', 'desc'] as const);
    const pageValue = positiveInteger(request.query.page);
    const pageSizeValue = positiveInteger(request.query.pageSize);
    const sortBy = sortByValue === undefined ? 'updatedAt' : sortByValue;
    const sortOrder = sortOrderValue === undefined ? 'desc' : sortOrderValue;
    const page = pageValue === undefined ? 1 : pageValue;
    const pageSize = pageSizeValue === undefined ? 20 : pageSizeValue;

    const ownerId = owner && !['unassigned', 'me'].includes(owner) ? positiveInteger(owner) : undefined;
    if (
      search === null || (typeof search === 'string' && (!search || search.length > 100)) ||
      categoryId === null || relatedSystemId === null || status === null ||
      requestedPriority === null || itPriority === null || owner === null || ownerId === null ||
      sortBy === null || sortOrder === null || page === null || pageSize === null ||
      !pageSizes.includes(pageSize as typeof pageSizes[number])
    ) {
      fail(response, 400, 'INVALID_QUERY', 'Ticket queue parameters are invalid.');
      return;
    }

    if (ownerId) {
      const validOwner = await prisma.user.findFirst({
        where: { id: ownerId, isActive: true, role: { in: [UserRole.IT_STAFF, UserRole.ADMINISTRATOR] } },
        select: { id: true }
      });
      if (!validOwner) {
        fail(response, 400, 'INVALID_QUERY', 'Ticket queue owner is invalid.');
        return;
      }
    }

    const where: Prisma.TicketWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(relatedSystemId ? { relatedSystemId } : {}),
      ...(status ? { status } : {}),
      ...(requestedPriority ? { requestedPriority } : {}),
      ...(itPriority ? { itPriority } : {}),
      ...(owner === 'unassigned' ? { ownerId: null } : {}),
      ...(owner === 'me' ? { ownerId: request.auth!.user.id } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(search ? {
        OR: [
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { requester: { name: { contains: search, mode: 'insensitive' } } },
          { requester: { email: { contains: search, mode: 'insensitive' } } }
        ]
      } : {})
    };
    const orderBy = [
      { [sortBy]: sortOrder },
      { id: 'asc' }
    ] as Prisma.TicketOrderByWithRelationInput[];

    const [items, totalItems, categories, relatedSystems, owners] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ticketNumber: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          status: true,
          updatedAt: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true, role: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } }
        }
      }),
      prisma.ticket.count({ where }),
      prisma.category.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true } }),
      prisma.relatedSystem.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true } }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: [UserRole.IT_STAFF, UserRole.ADMINISTRATOR] } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, role: true }
      })
    ]);

    response.status(200).json({
      items,
      filters: { categories, relatedSystems, owners },
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
    });
  } catch (error) {
    next(error);
  }
});

staffRouter.get('/staff/assignees', staffOnly, async (_request, response, next) => {
  try {
    const assignees = await prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.IT_STAFF, UserRole.ADMINISTRATOR] } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, role: true }
    });
    response.status(200).json(assignees);
  } catch (error) { next(error); }
});

staffRouter.get('/staff/tickets/:ticketNumber', staffOnly, async (request, response, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: String(request.params.ticketNumber) },
      select: staffTicketSelect
    });
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    response.status(200).json(ticket);
  } catch (error) { next(error); }
});

function mutationBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const expectedUpdatedAt = (body as Record<string, unknown>).expectedUpdatedAt;
  if (typeof expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(expectedUpdatedAt))) return null;
  return { body: body as Record<string, unknown>, expectedUpdatedAt: new Date(expectedUpdatedAt) };
}

async function mutateTicket(
  ticketNumber: string,
  expectedUpdatedAt: Date,
  data: Prisma.TicketUncheckedUpdateManyInput
) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.ticket.findUnique({ where: { ticketNumber } });
    if (!existing) return { kind: 'missing' as const };
    const updated = await transaction.ticket.updateMany({
      where: { id: existing.id, updatedAt: expectedUpdatedAt }, data
    });
    if (updated.count === 0) return { kind: 'conflict' as const };
    const ticket = await transaction.ticket.findUniqueOrThrow({ where: { id: existing.id }, select: staffTicketSelect });
    return { kind: 'updated' as const, ticket };
  });
}

function sendMutationResult(response: Parameters<Parameters<typeof staffRouter.patch>[1]>[1], result: Awaited<ReturnType<typeof mutateTicket>>) {
  if (result.kind === 'missing') return fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
  if (result.kind === 'conflict') return fail(response, 409, 'STALE_WRITE', 'The ticket changed. Reload it before saving again.');
  response.status(200).json(result.ticket);
}

staffRouter.patch('/staff/tickets/:ticketNumber/assignment', staffOnly, async (request, response, next) => {
  try {
    const parsed = mutationBody(request.body);
    const ownerValue = parsed?.body.ownerId;
    if (!parsed || (ownerValue !== null && (!Number.isSafeInteger(ownerValue) || Number(ownerValue) <= 0))) {
      fail(response, 400, 'VALIDATION_ERROR', 'Select a valid active owner or unassign the ticket.');
      return;
    }
    const ownerId = ownerValue === null ? null : Number(ownerValue);
    if (ownerId !== null) {
      const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: [UserRole.IT_STAFF, UserRole.ADMINISTRATOR] } }, select: { id: true } });
      if (!owner) {
        fail(response, 400, 'VALIDATION_ERROR', 'The selected owner is not active or permitted.');
        return;
      }
    }
    sendMutationResult(response, await mutateTicket(String(request.params.ticketNumber), parsed.expectedUpdatedAt, { ownerId }));
  } catch (error) { next(error); }
});

staffRouter.patch('/staff/tickets/:ticketNumber/it-priority', staffOnly, async (request, response, next) => {
  try {
    const parsed = mutationBody(request.body);
    const itPriority = parsed && typeof parsed.body.itPriority === 'string' && Object.values(RequestedPriority).includes(parsed.body.itPriority as RequestedPriority)
      ? parsed.body.itPriority as RequestedPriority : null;
    if (!parsed || !itPriority) {
      fail(response, 400, 'VALIDATION_ERROR', 'Select a valid IT Priority.');
      return;
    }
    sendMutationResult(response, await mutateTicket(String(request.params.ticketNumber), parsed.expectedUpdatedAt, { itPriority }));
  } catch (error) { next(error); }
});

staffRouter.patch('/staff/tickets/:ticketNumber/status', staffOnly, async (request, response, next) => {
  try {
    const parsed = mutationBody(request.body);
    const status = parsed && typeof parsed.body.status === 'string' && Object.values(TicketStatus).includes(parsed.body.status as TicketStatus)
      ? parsed.body.status as TicketStatus : null;
    if (!parsed || !status) {
      fail(response, 400, 'VALIDATION_ERROR', 'Select a valid ticket status.');
      return;
    }
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: String(request.params.ticketNumber) }, select: { status: true, ownerId: true } });
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    if (ticket.status === status) {
      fail(response, 400, 'VALIDATION_ERROR', 'The ticket already has this status.');
      return;
    }
    if (!transitions[ticket.status].includes(status)) {
      fail(response, 409, 'INVALID_STATUS_TRANSITION', `A ticket cannot move from ${ticket.status} to ${status}.`);
      return;
    }
    if (['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED'].includes(status) && ticket.ownerId === null) {
      fail(response, 409, 'OWNER_REQUIRED', 'Assign an owner before moving this ticket to the selected status.');
      return;
    }
    sendMutationResult(response, await mutateTicket(String(request.params.ticketNumber), parsed.expectedUpdatedAt, { status }));
  } catch (error) { next(error); }
});
