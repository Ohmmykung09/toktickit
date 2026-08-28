import cors from 'cors';
import express from 'express';
import { Prisma, RequestedPriority, TicketStatus } from '@prisma/client';
import { prisma } from './db.js';
import { env } from './env.js';
import {
  createTicket,
  IdempotencyConflictError,
  type CreateTicketInput
} from './ticket-service.js';

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin
  })
);
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'TokTickIT API'
  });
});

app.get('/api/categories', async (_request, response, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true,
        name: true
      }
    });

    response.status(200).json(categories);
  } catch (error) {
    next(error);
  }
});

app.get('/api/related-systems', async (_request, response, next) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });

    response.status(200).json(relatedSystems);
  } catch (error) {
    next(error);
  }
});

app.get('/api/development-requesters', async (_request, response, next) => {
  try {
    const requesters = await prisma.developmentRequester.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });

    response.status(200).json(requesters);
  } catch (error) {
    next(error);
  }
});

function requesterIdFrom(request: express.Request) {
  const value = Number(request.header('X-Development-Requester-Id'));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function validIdempotencyKey(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function validTicketInput(body: unknown): CreateTicketInput | null {
  if (!body || typeof body !== 'object') return null;

  const input = body as Record<string, unknown>;
  const categoryId = input.categoryId;
  const relatedSystemId = input.relatedSystemId;
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const requestedPriority = input.requestedPriority;

  if (
    !Number.isInteger(categoryId) ||
    !Number.isInteger(relatedSystemId) ||
    summary.length < 5 ||
    summary.length > 120 ||
    description.length < 10 ||
    description.length > 2000 ||
    !Object.values(RequestedPriority).includes(requestedPriority as RequestedPriority)
  ) {
    return null;
  }

  return {
    categoryId: categoryId as number,
    relatedSystemId: relatedSystemId as number,
    summary,
    description,
    requestedPriority: requestedPriority as RequestedPriority
  };
}

async function activeRequesterId(request: express.Request) {
  const requesterId = requesterIdFrom(request);
  if (!requesterId) return null;

  const requester = await prisma.developmentRequester.findFirst({
    where: { id: requesterId, isActive: true },
    select: { id: true }
  });
  return requester?.id ?? null;
}

function pageValue(value: unknown, defaultValue: number, maximum: number) {
  if (value === undefined) return defaultValue;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= maximum ? number : null;
}

function requestedPriority(value: unknown) {
  if (value === undefined) return undefined;
  const normalized = String(value).toUpperCase();
  return Object.values(RequestedPriority).includes(normalized as RequestedPriority)
    ? (normalized as RequestedPriority)
    : null;
}

function ticketStatus(value: unknown) {
  if (value === undefined) return undefined;
  return String(value).toUpperCase() === 'NEW' ? TicketStatus.NEW : null;
}

function displayStatus(status: TicketStatus) {
  return status === TicketStatus.NEW ? 'New' : status;
}

function displayPriority(priority: RequestedPriority) {
  return `${priority.charAt(0)}${priority.slice(1).toLowerCase()}`;
}

app.post('/api/tickets', async (request, response, next) => {
  const requesterId = requesterIdFrom(request);
  const idempotencyKey = request.header('Idempotency-Key');
  const input = validTicketInput(request.body);

  if (!requesterId || !validIdempotencyKey(idempotencyKey) || !input) {
    response.status(400).json({ error: 'Ticket details are invalid.' });
    return;
  }

  try {
    const [requester, category, relatedSystem] = await Promise.all([
      prisma.developmentRequester.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true }
      }),
      prisma.category.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { id: true }
      }),
      prisma.relatedSystem.findFirst({
        where: { id: input.relatedSystemId, isActive: true },
        select: { id: true }
      })
    ]);

    if (!requester || !category || !relatedSystem) {
      response.status(400).json({ error: 'Requester or ticket lookup values are invalid.' });
      return;
    }

    const result = await createTicket(requesterId, idempotencyKey, input);
    response.status(result.created ? 201 : 200).json(result.ticket);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      response.status(409).json({ error: 'This idempotency key was already used for different ticket details.' });
      return;
    }

    next(error);
  }
});

app.get('/api/tickets', async (request, response, next) => {
  try {
    const requesterId = await activeRequesterId(request);
    const page = pageValue(request.query.page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = pageValue(request.query.pageSize, 10, 50);
    const categoryId = request.query.categoryId === undefined ? undefined : Number(request.query.categoryId);
    const status = ticketStatus(request.query.status);
    const priority = requestedPriority(request.query.priority);
    const sort = request.query.sort ?? 'updatedAt';
    const direction = request.query.direction ?? 'desc';

    if (
      !requesterId ||
      !page ||
      !pageSize ||
      (categoryId !== undefined && (!Number.isInteger(categoryId) || categoryId <= 0)) ||
      status === null ||
      priority === null ||
      !['updatedAt', 'createdAt', 'ticketNumber'].includes(String(sort)) ||
      !['asc', 'desc'].includes(String(direction))
    ) {
      response.status(400).json({ error: 'Ticket list parameters are invalid.' });
      return;
    }

    const q = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    const where: Prisma.TicketWhereInput = {
      requesterId,
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { requestedPriority: priority } : {}),
      ...(q ? { OR: [{ ticketNumber: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] } : {})
    };
    const orderBy = { [String(sort)]: String(direction) } as Prisma.TicketOrderByWithRelationInput;
    const [items, totalItems] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ticketNumber: true,
          summary: true,
          status: true,
          requestedPriority: true,
          updatedAt: true,
          category: { select: { id: true, name: true } }
        }
      }),
      prisma.ticket.count({ where })
    ]);

    response.status(200).json({
      items: items.map((ticket) => ({
        ...ticket,
        status: displayStatus(ticket.status),
        requestedPriority: displayPriority(ticket.requestedPriority)
      })),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets/:ticketNumber', async (request, response, next) => {
  try {
    const requesterId = await activeRequesterId(request);
    if (!requesterId) {
      response.status(400).json({ error: 'Development Requester context is invalid.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: request.params.ticketNumber },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: { where: { removedAt: null }, orderBy: { createdAt: 'desc' } }
      }
    });
    if (!ticket) {
      response.status(404).json({ error: 'Ticket not found.' });
      return;
    }
    if (ticket.requesterId !== requesterId) {
      response.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }

    response.status(200).json({
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      status: displayStatus(ticket.status),
      requestedPriority: displayPriority(ticket.requestedPriority),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      attachments: ticket.attachments.map(({ id, originalFileName, mimeType, sizeBytes, createdAt }) => ({ id, originalFileName, mimeType, sizeBytes, createdAt }))
    });
  } catch (error) {
    next(error);
  }
});

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'TokTickIT API',
    message: 'Project foundation is running'
  });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);
    response.status(500).json({
      error: 'Unable to process the request'
    });
  }
);
