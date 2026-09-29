import { ActionTakenStatus, Prisma, UserRole } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { requireRole } from './auth-router.js';
import { prisma } from './db.js';

export const actionsTakenRouter = Router();

const staffOnly = requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR);
const actionStatuses = Object.values(ActionTakenStatus);
const terminalStatuses = [ActionTakenStatus.COMPLETED, ActionTakenStatus.CANCELLED] as const;
const actionTransitions: Readonly<Record<ActionTakenStatus, readonly ActionTakenStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'COMPLETED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};
const auditUserSelect = { id: true, name: true, role: true } satisfies Prisma.UserSelect;
const actionSelect = {
  id: true,
  actionDateTime: true,
  status: true,
  resolutionCycle: true,
  description: true,
  result: true,
  assignee: { select: auditUserSelect },
  createdBy: { select: auditUserSelect },
  performedBy: { select: auditUserSelect },
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  completedAt: true,
  cancelledAt: true,
  version: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ActionTakenSelect;

type FieldErrors = Record<string, string>;

function fail(response: Response, status: number, code: string, message: string, fieldErrors?: FieldErrors) {
  response.status(status).json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } });
}

function objectBody(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

function trimmedText(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return Array.from(text).length >= minimum && Array.from(text).length <= maximum ? text : null;
}

function optionalTrimmedText(value: unknown, maximum: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return Array.from(text).length <= maximum ? text || null : null;
}

function validOptionalText(value: unknown, maximum: number) {
  return value === null || value === undefined
    || (typeof value === 'string' && Array.from(value.trim()).length <= maximum);
}

function validIdempotencyKey(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  const date = new Date(value);
  return date.getTime() > Date.now() + 5 * 60 * 1000 ? null : date;
}

function validAssigneeId(value: unknown) {
  if (value === null) return null;
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function validExpectedVersion(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function parseCreateBody(body: unknown) {
  const input = objectBody(body);
  const fieldErrors: FieldErrors = {};
  if (!input) return { input: null, fieldErrors: { body: 'Request body must be an object.' } };

  const actionDateTime = validDate(input.actionDateTime);
  if (!actionDateTime) fieldErrors.actionDateTime = 'Enter a valid date/time that is not more than five minutes in the future.';
  const description = trimmedText(input.description, 1, 5000);
  if (!description) fieldErrors.description = 'Description must contain 1 to 5,000 characters.';
  const result = trimmedText(input.result, 1, 2000);
  if (!result) fieldErrors.result = 'Result must contain 1 to 2,000 characters.';
  const followUpRequired = input.followUpRequired === undefined ? false : input.followUpRequired;
  if (typeof followUpRequired !== 'boolean') fieldErrors.followUpRequired = 'Follow-up Required must be boolean.';
  const followUpNote = input.followUpNote === undefined || input.followUpNote === null
    ? null
    : trimmedText(input.followUpNote, 1, 2000);
  if (followUpRequired === true && !followUpNote) fieldErrors.followUpNote = 'Follow-up Note is required when follow-up is required.';
  if (followUpRequired === false && input.followUpNote !== undefined && input.followUpNote !== null && String(input.followUpNote).trim()) {
    fieldErrors.followUpNote = 'Follow-up Note must be empty when follow-up is not required.';
  }
  const attachmentNotes = optionalTrimmedText(input.attachmentNotes, 2000);
  if (!validOptionalText(input.attachmentNotes, 2000)) {
    fieldErrors.attachmentNotes = 'Attachment Notes must contain at most 2,000 characters.';
  }
  const assigneeId = input.assigneeId === undefined ? null : validAssigneeId(input.assigneeId);
  if (assigneeId === undefined) fieldErrors.assigneeId = 'Assignee must be a valid active staff user or null.';

  return {
    input: Object.keys(fieldErrors).length ? null : {
      actionDateTime: actionDateTime!,
      description: description!,
      result: result!,
      followUpRequired: followUpRequired as boolean,
      followUpNote,
      attachmentNotes,
      assigneeId: assigneeId as number | null
    },
    fieldErrors
  };
}

function parseUpdateBody(body: unknown) {
  const input = objectBody(body);
  const fieldErrors: FieldErrors = {};
  if (!input) return { input: null, fieldErrors: { body: 'Request body must be an object.' } };
  const expectedVersion = validExpectedVersion(input.expectedVersion);
  if (!expectedVersion) fieldErrors.expectedVersion = 'Expected Version must be a positive integer.';

  let actionDateTime: Date | undefined;
  if ('actionDateTime' in input) {
    actionDateTime = validDate(input.actionDateTime) ?? undefined;
    if (!actionDateTime) fieldErrors.actionDateTime = 'Enter a valid date/time that is not more than five minutes in the future.';
  }
  let description: string | undefined;
  if ('description' in input) {
    description = trimmedText(input.description, 1, 5000) ?? undefined;
    if (!description) fieldErrors.description = 'Description must contain 1 to 5,000 characters.';
  }
  let result: string | undefined;
  if ('result' in input) {
    result = trimmedText(input.result, 1, 2000) ?? undefined;
    if (!result) fieldErrors.result = 'Result must contain 1 to 2,000 characters.';
  }
  let assigneeId: number | null | undefined;
  if ('assigneeId' in input) {
    assigneeId = validAssigneeId(input.assigneeId);
    if (assigneeId === undefined) fieldErrors.assigneeId = 'Assignee must be a valid active staff user or null.';
  }
  let status: ActionTakenStatus | undefined;
  if ('status' in input) {
    status = typeof input.status === 'string' && actionStatuses.includes(input.status as ActionTakenStatus)
      ? input.status as ActionTakenStatus
      : undefined;
    if (!status) fieldErrors.status = 'Select a valid Action Taken status.';
  }
  let followUpRequired: boolean | undefined;
  if ('followUpRequired' in input) {
    followUpRequired = typeof input.followUpRequired === 'boolean' ? input.followUpRequired : undefined;
    if (followUpRequired === undefined) fieldErrors.followUpRequired = 'Follow-up Required must be boolean.';
  }
  let followUpNote: string | null | undefined;
  if ('followUpNote' in input) {
    followUpNote = input.followUpNote === null || input.followUpNote === ''
      ? null
      : trimmedText(input.followUpNote, 1, 2000);
    if (input.followUpNote !== null && input.followUpNote !== '' && !followUpNote) {
      fieldErrors.followUpNote = 'Follow-up Note must contain 1 to 2,000 characters.';
    }
  }
  let attachmentNotes: string | null | undefined;
  if ('attachmentNotes' in input) {
    attachmentNotes = optionalTrimmedText(input.attachmentNotes, 2000);
    if (!validOptionalText(input.attachmentNotes, 2000)) {
      fieldErrors.attachmentNotes = 'Attachment Notes must contain at most 2,000 characters.';
    }
  }

  return {
    input: Object.keys(fieldErrors).length ? null : {
      expectedVersion: expectedVersion!,
      ...(actionDateTime ? { actionDateTime } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(result !== undefined ? { result } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(status ? { status } : {}),
      ...(followUpRequired !== undefined ? { followUpRequired } : {}),
      ...(followUpNote !== undefined ? { followUpNote } : {}),
      ...(attachmentNotes !== undefined ? { attachmentNotes } : {})
    },
    fieldErrors
  };
}

async function activeAssignee(transaction: Prisma.TransactionClient, assigneeId: number) {
  return transaction.user.findFirst({
    where: { id: assigneeId, isActive: true, role: { in: [UserRole.IT_STAFF, UserRole.ADMINISTRATOR] } },
    select: { id: true }
  });
}

async function accessibleTicket(ticketNumber: string, user: { id: number; role: UserRole }) {
  return prisma.ticket.findFirst({
    where: { ticketNumber, ...(user.role === UserRole.REQUESTER ? { requesterId: user.id } : {}) },
    select: { id: true }
  });
}

function sendMutationOutcome(response: Response, outcome: string) {
  if (outcome === 'not-found') return fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket or Action Taken not found.');
  if (outcome === 'stale') return fail(response, 409, 'STALE_WRITE', 'The Action Taken changed. Reload it before saving again.');
  if (outcome === 'terminal') return fail(response, 409, 'ACTION_TERMINAL', 'Terminal Actions Taken cannot be edited.');
  if (outcome === 'invalid-transition') return fail(response, 409, 'INVALID_ACTION_TRANSITION', 'The Action Taken transition is not permitted.');
  if (outcome === 'inactive-assignee') return fail(response, 409, 'INACTIVE_ASSIGNEE', 'The selected assignee is not an active staff user.');
  if (outcome === 'assignee-required') return fail(response, 409, 'ASSIGNEE_REQUIRED', 'An active assignee is required for this Action Taken status.');
  if (outcome === 'idempotency-conflict') return fail(response, 409, 'IDEMPOTENCY_CONFLICT', 'This idempotency key was already used for different Action Taken details.');
  return false;
}

function isSerializationConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; meta?: { code?: string } };
  return candidate.code === 'P2034' || (candidate.code === 'P2010' && candidate.meta?.code === '40001');
}

actionsTakenRouter.get('/tickets/:ticketNumber/actions-taken', async (request, response, next) => {
  try {
    const ticket = await accessibleTicket(String(request.params.ticketNumber), request.auth!.user);
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket or Action Taken not found.');
      return;
    }
    const actions = await prisma.actionTaken.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ actionDateTime: 'asc' }, { id: 'asc' }],
      select: actionSelect
    });
    response.status(200).json(actions);
  } catch (error) {
    if (isSerializationConflict(error)) {
      fail(response, 409, 'STALE_WRITE', 'The Action Taken changed. Reload it before saving again.');
      return;
    }
    next(error);
  }
});

actionsTakenRouter.post('/staff/tickets/:ticketNumber/actions-taken', staffOnly, async (request, response, next) => {
  try {
    const idempotencyKey = request.header('Idempotency-Key');
    if (!validIdempotencyKey(idempotencyKey)) {
      fail(response, 400, 'VALIDATION_ERROR', 'A valid Idempotency-Key header is required.');
      return;
    }
    const parsed = parseCreateBody(request.body);
    if (!parsed.input) {
      fail(response, 400, 'VALIDATION_ERROR', 'Action Taken details are invalid.', parsed.fieldErrors);
      return;
    }
    const input = parsed.input;
    const result = await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { ticketNumber: String(request.params.ticketNumber) },
        select: { id: true, resolutionCycle: true }
      });
      if (!ticket) return { outcome: 'not-found' as const };
      const existing = await transaction.actionTaken.findUnique({
        where: { ticketId_idempotencyKey: { ticketId: ticket.id, idempotencyKey } },
        select: actionSelect
      });
      if (existing) {
        const samePayload = existing.actionDateTime.getTime() === input.actionDateTime.getTime()
          && existing.description === input.description
          && existing.result === input.result
          && existing.assignee?.id === input.assigneeId
          && existing.followUpRequired === input.followUpRequired
          && existing.followUpNote === input.followUpNote
          && existing.attachmentNotes === input.attachmentNotes;
        return samePayload
          ? { outcome: 'replayed' as const, action: existing }
          : { outcome: 'idempotency-conflict' as const };
      }
      if (input.assigneeId !== null && !(await activeAssignee(transaction, input.assigneeId))) {
        return { outcome: 'inactive-assignee' as const };
      }
      const action = await transaction.actionTaken.create({
        data: {
          ticketId: ticket.id,
          actionDateTime: input.actionDateTime,
          description: input.description,
          result: input.result,
          resolutionCycle: ticket.resolutionCycle,
          assigneeId: input.assigneeId,
          createdById: request.auth!.user.id,
          performedById: request.auth!.user.id,
          followUpRequired: input.followUpRequired,
          followUpNote: input.followUpNote,
          attachmentNotes: input.attachmentNotes,
          idempotencyKey
        },
        select: actionSelect
      });
      return { outcome: 'created' as const, action };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (sendMutationOutcome(response, result.outcome)) return;
    response.status(result.outcome === 'replayed' ? 200 : 201).json(result.action);
  } catch (error) {
    if (isSerializationConflict(error)) {
      fail(response, 409, 'STALE_WRITE', 'The Action Taken changed. Reload it before saving again.');
      return;
    }
    next(error);
  }
});

actionsTakenRouter.patch('/staff/tickets/:ticketNumber/actions-taken/:actionId', staffOnly, async (request, response, next) => {
  try {
    const actionId = Number(request.params.actionId);
    if (!Number.isSafeInteger(actionId) || actionId <= 0) {
      fail(response, 400, 'VALIDATION_ERROR', 'Action Taken ID is invalid.');
      return;
    }
    const parsed = parseUpdateBody(request.body);
    if (!parsed.input) {
      fail(response, 400, 'VALIDATION_ERROR', 'Action Taken details are invalid.', parsed.fieldErrors);
      return;
    }
    const input = parsed.input;

    const result = await prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT a."id"
        FROM "ActionTaken" a
        JOIN "Ticket" t ON t."id" = a."ticketId"
        WHERE a."id" = ${actionId}
          AND t."ticketNumber" = ${String(request.params.ticketNumber)}
        FOR UPDATE
      `);
      if (!lockedRows[0]) return { outcome: 'not-found' as const };
      const action = await transaction.actionTaken.findUnique({ where: { id: actionId } });
      if (!action) return { outcome: 'not-found' as const };
      if (action.version !== input.expectedVersion) return { outcome: 'stale' as const };
      if (Object.keys(input).length === 1) {
        return {
          outcome: 'unchanged' as const,
          action: await transaction.actionTaken.findUniqueOrThrow({ where: { id: action.id }, select: actionSelect })
        };
      }
      if (terminalStatuses.some((terminalStatus) => terminalStatus === action.status)) return { outcome: 'terminal' as const };

      const nextStatus = input.status ?? action.status;
      if (nextStatus !== action.status && !actionTransitions[action.status].includes(nextStatus)) {
        return { outcome: 'invalid-transition' as const };
      }
      const nextAssigneeId = input.assigneeId === undefined ? action.assigneeId : input.assigneeId;
      const requiresAssignee = nextStatus !== ActionTakenStatus.OPEN;
      if (requiresAssignee && nextAssigneeId === null) return { outcome: 'assignee-required' as const };
      if (nextAssigneeId !== null && !(await activeAssignee(transaction, nextAssigneeId))) {
        return { outcome: 'inactive-assignee' as const };
      }

      const nextFollowUpRequired = input.followUpRequired ?? action.followUpRequired;
      const nextFollowUpNote = input.followUpNote === undefined ? action.followUpNote : input.followUpNote;
      if (nextFollowUpRequired && !nextFollowUpNote) {
        return { outcome: 'validation' as const };
      }
      if (!nextFollowUpRequired && nextFollowUpNote) {
        return { outcome: 'validation' as const };
      }

      const now = new Date();
      const updated = await transaction.actionTaken.updateMany({
        where: { id: action.id, version: input.expectedVersion },
        data: {
          ...(input.actionDateTime ? { actionDateTime: input.actionDateTime } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.result !== undefined ? { result: input.result } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
          ...(input.status ? { status: input.status } : {}),
          followUpRequired: nextFollowUpRequired,
          followUpNote: nextFollowUpNote,
          ...(input.attachmentNotes !== undefined ? { attachmentNotes: input.attachmentNotes } : {}),
          performedById: request.auth!.user.id,
          completedAt: nextStatus === ActionTakenStatus.COMPLETED ? now : null,
          cancelledAt: nextStatus === ActionTakenStatus.CANCELLED ? now : null,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) return { outcome: 'stale' as const };
      return {
        outcome: 'updated' as const,
        action: await transaction.actionTaken.findUniqueOrThrow({ where: { id: action.id }, select: actionSelect })
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.outcome === 'validation') {
      fail(response, 400, 'VALIDATION_ERROR', 'Follow-up fields are invalid.', { followUpNote: 'Follow-up Note must match Follow-Up Required.' });
      return;
    }
    if (sendMutationOutcome(response, result.outcome)) return;
    response.status(200).json(result.action);
  } catch (error) {
    if (isSerializationConflict(error)) {
      fail(response, 409, 'STALE_WRITE', 'The Action Taken changed. Reload it before saving again.');
      return;
    }
    next(error);
  }
});
