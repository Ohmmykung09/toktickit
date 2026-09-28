import { access } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, RequestedPriority, TicketStatus, UserRole } from '@prisma/client';
import { Router } from 'express';
import { prisma } from './db.js';
import { requireRole } from './auth-router.js';
import { canTransition, transitionRequiresOwner } from './status-policy.js';

export const staffRouter = Router();
const attachmentDirectory = path.resolve(process.cwd(), 'uploads');

type StaffMutationTestHooks = {
  beforeTransaction?: (operation: 'assignment' | 'it-priority' | 'status') => Promise<void>;
};

let staffMutationTestHooks: StaffMutationTestHooks = {};

export function setStaffMutationTestHooksForTesting(hooks: StaffMutationTestHooks) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Staff mutation test hooks are available only in tests.');
  staffMutationTestHooks = hooks;
}

const staffOnly = requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR);
const pageSizes = [10, 20, 50] as const;
const sortFields = ['createdAt', 'updatedAt', 'ticketNumber', 'requestedPriority', 'itPriority', 'status'] as const;
const staffTicketSelect = {
  ticketNumber: true, summary: true, description: true, requestedPriority: true, itPriority: true,
  status: true, resolutionCycle: true, resolvedAt: true, requesterResolutionIndicatedAt: true, createdAt: true, updatedAt: true,
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

staffRouter.get('/staff/tickets/:ticketNumber/attachments/:attachmentId/download', staffOnly, async (request, response, next) => {
  try {
    const attachmentId = Number(request.params.attachmentId);
    if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Attachment not found.');
      return;
    }
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, removedAt: null, ticket: { ticketNumber: String(request.params.ticketNumber) } },
      select: { storedFileName: true, originalFileName: true }
    });
    if (!attachment) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Attachment not found.');
      return;
    }
    const filePath = path.join(attachmentDirectory, attachment.storedFileName);
    await access(filePath);
    response.download(filePath, attachment.originalFileName);
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === 'ENOENT') {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Attachment not found.');
      return;
    }
    next(caught);
  }
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
  data: Prisma.TicketUncheckedUpdateManyInput,
  operation: 'assignment' | 'it-priority' | 'status',
  ownerIdToValidate?: number | null
) {
  await staffMutationTestHooks.beforeTransaction?.(operation);
  return prisma.$transaction(async (transaction) => {
    if (ownerIdToValidate !== undefined && ownerIdToValidate !== null) {
      const owners = await transaction.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${ownerIdToValidate}
          AND "isActive" = true
          AND "role" IN ('IT_STAFF'::"UserRole", 'ADMINISTRATOR'::"UserRole")
        FOR UPDATE
      `);
      if (!owners[0]) return { kind: 'invalid-owner' as const };
    }
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

async function mutateTicketStatus(ticketNumber: string, expectedUpdatedAt: Date, status: TicketStatus) {
  await staffMutationTestHooks.beforeTransaction?.('status');
  return prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{
      id: number;
      status: TicketStatus;
      ownerId: number | null;
      resolutionCycle: number;
      resolvedAt: Date | null;
      updatedAt: Date;
    }>>(Prisma.sql`
      SELECT "id", "status", "ownerId", "resolutionCycle", "resolvedAt", "updatedAt"
      FROM "Ticket"
      WHERE "ticketNumber" = ${ticketNumber}
      FOR UPDATE
    `);
    const existing = locked[0];
    if (!existing) return { kind: 'missing' as const };
    if (existing.status === status) return { kind: 'same-status' as const };
    if (!canTransition(existing.status, status)) return { kind: 'invalid-transition' as const };

    if (transitionRequiresOwner(status)) {
      const owner = existing.ownerId === null ? [] : await transaction.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${existing.ownerId}
          AND "isActive" = true
          AND "role" IN ('IT_STAFF'::"UserRole", 'ADMINISTRATOR'::"UserRole")
        FOR UPDATE
      `);
      if (!owner[0]) return { kind: 'owner-required' as const };
    }

    if (status === TicketStatus.RESOLVED) {
      const qualifyingAction = await transaction.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT "id"
        FROM "ActionTaken"
        WHERE "ticketId" = ${existing.id}
          AND "resolutionCycle" = ${existing.resolutionCycle}
          AND "status" = 'COMPLETED'::"ActionTakenStatus"
          AND "completedAt" IS NOT NULL
          AND CHAR_LENGTH(BTRIM("result")) > 0
        LIMIT 1
      `);
      if (!qualifyingAction[0]) return { kind: 'resolution-required' as const };
    }

    const data: Prisma.TicketUncheckedUpdateManyInput = { status };
    if (status === TicketStatus.RESOLVED) data.resolvedAt = new Date();
    if (status === TicketStatus.REOPENED) {
      data.resolutionCycle = { increment: 1 };
      data.resolvedAt = null;
    }
    const updated = await transaction.ticket.updateMany({
      where: { id: existing.id, updatedAt: expectedUpdatedAt },
      data
    });
    if (updated.count === 0) return { kind: 'conflict' as const };
    const ticket = await transaction.ticket.findUniqueOrThrow({ where: { id: existing.id }, select: staffTicketSelect });
    return { kind: 'updated' as const, ticket };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function sendMutationResult(response: Parameters<Parameters<typeof staffRouter.patch>[1]>[1], result: Awaited<ReturnType<typeof mutateTicket>>) {
  if (result.kind === 'missing') return fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
  if (result.kind === 'invalid-owner') return fail(response, 400, 'VALIDATION_ERROR', 'The selected owner is not active or permitted.');
  if (result.kind === 'conflict') return fail(response, 409, 'STALE_WRITE', 'The ticket changed. Reload it before saving again.');
  response.status(200).json(result.ticket);
}

function sendStatusMutationResult(
  response: Parameters<Parameters<typeof staffRouter.patch>[1]>[1],
  result: Awaited<ReturnType<typeof mutateTicketStatus>>
) {
  if (result.kind === 'missing') return fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
  if (result.kind === 'same-status') return fail(response, 400, 'VALIDATION_ERROR', 'The ticket already has this status.');
  if (result.kind === 'invalid-transition') return fail(response, 409, 'INVALID_STATUS_TRANSITION', 'The requested Ticket status transition is not permitted.');
  if (result.kind === 'owner-required') return fail(response, 409, 'OWNER_REQUIRED', 'Assign an active owner before moving this Ticket to the selected status.');
  if (result.kind === 'resolution-required') return fail(response, 409, 'RESOLUTION_ACTION_REQUIRED', 'Complete a qualifying Action Taken for the current resolution cycle before resolving this Ticket.');
  if (result.kind === 'conflict') return fail(response, 409, 'STALE_WRITE', 'The ticket changed. Reload it before saving again.');
  response.status(200).json(result.ticket);
}

function isSerializationConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; meta?: { code?: string } };
  return candidate.code === 'P2034' || (candidate.code === 'P2010' && candidate.meta?.code === '40001');
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
    sendMutationResult(response, await mutateTicket(
      String(request.params.ticketNumber), parsed.expectedUpdatedAt, { ownerId }, 'assignment', ownerId
    ));
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
    sendMutationResult(response, await mutateTicket(
      String(request.params.ticketNumber), parsed.expectedUpdatedAt, { itPriority }, 'it-priority'
    ));
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
    sendStatusMutationResult(response, await mutateTicketStatus(
      String(request.params.ticketNumber), parsed.expectedUpdatedAt, status
    ));
  } catch (error) {
    if (isSerializationConflict(error)) {
      fail(response, 409, 'STALE_WRITE', 'The ticket changed. Reload it before saving again.');
      return;
    }
    next(error);
  }
});
