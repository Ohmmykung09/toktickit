import cors from 'cors';
import express from 'express';
import { RequestedPriority } from '@prisma/client';
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
