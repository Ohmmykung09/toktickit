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
    const ticket = await accessibleTicket(String(request.params.ticketNumber), request.auth!.user);
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    const comment = await prisma.publicComment.create({
      data: { ticketId: ticket.id, authorId: request.auth!.user.id, content: parsed.content },
      select: messageSelect
    });
    response.status(201).json(comment);
  } catch (caught) { next(caught); }
});

communicationRouter.post('/tickets/:ticketNumber/problem-appears-resolved', requesterOnly, async (request, response, next) => {
  try {
    const ticket = await accessibleTicket(String(request.params.ticketNumber), request.auth!.user);
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    await prisma.ticket.updateMany({
      where: { id: ticket.id, requesterResolutionIndicatedAt: null },
      data: {
        requesterResolutionIndicatedAt: new Date(),
        requesterResolutionIndicatedById: request.auth!.user.id
      }
    });
    const indication = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { requesterResolutionIndicatedAt: true }
    });
    response.status(200).json(indication);
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
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: String(request.params.ticketNumber) },
      select: { id: true }
    });
    if (!ticket) {
      fail(response, 404, 'RESOURCE_NOT_FOUND', 'Ticket not found.');
      return;
    }
    const note = await prisma.internalNote.create({
      data: { ticketId: ticket.id, authorId: request.auth!.user.id, content: parsed.content },
      select: messageSelect
    });
    response.status(201).json(note);
  } catch (caught) { next(caught); }
});
