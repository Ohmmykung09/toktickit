import { Prisma, RequestedPriority } from '@prisma/client';
import { prisma } from './db.js';

export type CreateTicketInput = {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
};

type TicketRecord = {
  ticketNumber: string;
  status: string;
  createdAt: Date;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
};

export class IdempotencyConflictError extends Error {}

function ticketPrefix(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `TKT-${year}${month}${day}-`;
}

function hasSamePayload(ticket: TicketRecord, input: CreateTicketInput, requesterId: number) {
  return (
    ticket.requesterId === requesterId &&
    ticket.categoryId === input.categoryId &&
    ticket.relatedSystemId === input.relatedSystemId &&
    ticket.summary === input.summary &&
    ticket.requestedPriority === input.requestedPriority &&
    ticket.description === input.description
  );
}

export function ticketResponse(ticket: Pick<TicketRecord, 'ticketNumber' | 'status' | 'createdAt'>) {
  return {
    ticketNumber: ticket.ticketNumber,
    status: ticket.status === 'NEW' ? 'New' : ticket.status,
    createdAt: ticket.createdAt
  };
}

export async function createTicket(
  requesterId: number,
  idempotencyKey: string,
  input: CreateTicketInput
) {
  return prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.ticket.findUnique({
        where: { idempotencyKey }
      });

      if (existing) {
        if (!hasSamePayload(existing, input, requesterId)) {
          throw new IdempotencyConflictError();
        }

        return { created: false, ticket: ticketResponse(existing) };
      }

      const prefix = ticketPrefix(new Date());
      const latestTicket = await transaction.ticket.findFirst({
        where: { ticketNumber: { startsWith: prefix } },
        orderBy: { ticketNumber: 'desc' },
        select: { ticketNumber: true }
      });
      const currentSequence = latestTicket
        ? Number(latestTicket.ticketNumber.slice(prefix.length))
        : 0;
      const ticketNumber = `${prefix}${String(currentSequence + 1).padStart(4, '0')}`;

      const ticket = await transaction.ticket.create({
        data: {
          ticketNumber,
          idempotencyKey,
          requesterId,
          ...input
        }
      });

      return { created: true, ticket: ticketResponse(ticket) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
