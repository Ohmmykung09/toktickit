import { Prisma, UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from './auth-router.js';
import { prisma } from './db.js';
import { parseMessageBody } from './message-policy.js';

export const communicationRouter = Router();
const requesterOnly = requireRole(UserRole.REQUESTER);
const staffOnly = requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR);
const authorSelect = { id: true, name: true, role: true } satisfies Prisma.UserSelect;
const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: { select: authorSelect }
} satisfies Prisma.PublicCommentSelect;

type MessageKind = 'public' | 'internal';
type CommunicationWriteKind = MessageKind | 'resolution';
type CommunicationTestHooks = {
  beforeWriteTransaction?: (kind: CommunicationWriteKind, actorId: number) => Promise<void>;
};

let communicationTestHooks: CommunicationTestHooks = {};

export function setCommunicationTestHooksForTesting(hooks: CommunicationTestHooks) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Communication test hooks are available only in tests.');
  communicationTestHooks = hooks;
}

function fail(response: Parameters<Parameters<typeof communicationRouter.get>[1]>[1], status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
  response.status(status).json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } });
}

async function accessibleTicket(ticketNumber: string, user: { id: number; role: UserRole }) {
  return prisma.ticket.findFirst({
    where: {
      ticketNumber,
      ...(user.role === UserRole.REQUESTER ? { requesterId: user.id } : {})
    },
    select: { id: true }
  });
}

async function lockedActor(transaction: Prisma.TransactionClient, actorId: number) {
  const actors = await transaction.$queryRaw<Array<{ id: number; role: UserRole; isActive: boolean }>>(Prisma.sql`
    SELECT "id", "role", "isActive"
    FROM "User"
    WHERE "id" = ${actorId}
    FOR UPDATE
  `);
  return actors[0];
}

async function appendMessage(
  kind: MessageKind,
  ticketNumber: string,
  actorId: number,
  content: string
) {
  await communicationTestHooks.beforeWriteTransaction?.(kind, actorId);
  return prisma.$transaction(async (transaction) => {
    const actor = await lockedActor(transaction, actorId);
    const permittedRoles = kind === 'public'
      ? [UserRole.REQUESTER, UserRole.IT_STAFF, UserRole.ADMINISTRATOR]
      : [UserRole.IT_STAFF, UserRole.ADMINISTRATOR];
    if (!actor || !actor.isActive || !permittedRoles.includes(actor.role)) {
      return { outcome: 'forbidden' } as const;
    }

    const ticket = await transaction.ticket.findFirst({
      where: {
        ticketNumber,
        ...(actor.role === UserRole.REQUESTER ? { requesterId: actor.id } : {})
      },
      select: { id: true }
    });
    if (!ticket) return { outcome: 'not-found' } as const;

    const data = { ticketId: ticket.id, authorId: actor.id, content };
    const message = kind === 'public'
      ? await transaction.publicComment.create({ data, select: messageSelect })
      : await transaction.internalNote.create({ data, select: messageSelect });
    return { outcome: 'created', message } as const;
  });
}

async function recordResolutionIndication(ticketNumber: string, actorId: number) {
  await communicationTestHooks.beforeWriteTransaction?.('resolution', actorId);
  return prisma.$transaction(async (transaction) => {
    const actor = await lockedActor(transaction, actorId);
    if (!actor || !actor.isActive || actor.role !== UserRole.REQUESTER) {
      return { outcome: 'forbidden' } as const;
    }
    const ticket = await transaction.ticket.findFirst({
      where: { ticketNumber, requesterId: actor.id },
      select: { id: true }
    });
    if (!ticket) return { outcome: 'not-found' } as const;

    await transaction.ticket.updateMany({
      where: { id: ticket.id, requesterResolutionIndicatedAt: null },
      data: {
        requesterResolutionIndicatedAt: new Date(),
        requesterResolutionIndicatedById: actor.id
      }
    });
    const indication = await transaction.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { requesterResolutionIndicatedAt: true }
    });
    return { outcome: 'recorded', indication } as const;
  });
}

function sendWriteResult(
  response: Parameters<Parameters<typeof communicationRouter.post>[1]>[1],
  result: Awaited<ReturnType<typeof appendMessage>>
) {
  if (result.outcome === 'forbidden') {
    fail(response, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    return;
  }
  if (result.outcome === 'not-found') {
    fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
    return;
  }
  response.status(201).json(result.message);
}

communicationRouter.get('/tickets/:ticketNumber/public-comments', async (request, response, next) => {
  try {
    const ticket = await accessibleTicket(String(request.params.ticketNumber), request.auth!.user);
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    const comments = await prisma.publicComment.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: messageSelect
    });
    response.status(200).json(comments);
  } catch (caught) { next(caught); }
});

communicationRouter.post('/tickets/:ticketNumber/public-comments', async (request, response, next) => {
  try {
    const parsed = parseMessageBody(request.body);
    if (!parsed.ok) {
      fail(response, 400, 'VALIDATION_ERROR', parsed.error, { content: parsed.error });
      return;
    }
    sendWriteResult(response, await appendMessage(
      'public',
      String(request.params.ticketNumber),
      request.auth!.user.id,
      parsed.content
    ));
  } catch (caught) { next(caught); }
});

communicationRouter.post('/tickets/:ticketNumber/problem-appears-resolved', requesterOnly, async (request, response, next) => {
  try {
    const result = await recordResolutionIndication(
      String(request.params.ticketNumber),
      request.auth!.user.id
    );
    if (result.outcome === 'forbidden') {
      fail(response, 403, 'FORBIDDEN', 'You do not have permission to perform this action.');
      return;
    }
    if (result.outcome === 'not-found') {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    response.status(200).json(result.indication);
  } catch (caught) { next(caught); }
});

communicationRouter.get('/staff/tickets/:ticketNumber/internal-notes', staffOnly, async (request, response, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: String(request.params.ticketNumber) },
      select: { id: true }
    });
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    const notes = await prisma.internalNote.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: messageSelect
    });
    response.status(200).json(notes);
  } catch (caught) { next(caught); }
});

communicationRouter.post('/staff/tickets/:ticketNumber/internal-notes', staffOnly, async (request, response, next) => {
  try {
    const parsed = parseMessageBody(request.body);
    if (!parsed.ok) {
      fail(response, 400, 'VALIDATION_ERROR', parsed.error, { content: parsed.error });
      return;
    }
    sendWriteResult(response, await appendMessage(
      'internal',
      String(request.params.ticketNumber),
      request.auth!.user.id,
      parsed.content
    ));
  } catch (caught) { next(caught); }
});
