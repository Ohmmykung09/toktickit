import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { Prisma, RequestedPriority, TicketStatus } from '@prisma/client';
import { prisma } from './db.js';
import { env } from './env.js';
import {
  createTicket,
  IdempotencyConflictError,
  type CreateTicketInput
} from './ticket-service.js';

export const app = express();

const attachmentDirectory = path.resolve(process.cwd(), 'uploads');
const maximumAttachmentSize = 5 * 1024 * 1024;
const permittedAttachments = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.pdf', 'application/pdf']
]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maximumAttachmentSize, files: 1 } });

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

async function ownedTicket(request: express.Request, ticketNumber: string) {
  const requesterId = await activeRequesterId(request);
  if (!requesterId) return { requesterId: null, ticket: null };

  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber } });
  if (!ticket || ticket.requesterId !== requesterId) return { requesterId, ticket: null };
  return { requesterId, ticket };
}

function attachmentInfo(attachment: { id: number; originalFileName: string; mimeType: string; sizeBytes: number; createdAt: Date }) {
  return attachment;
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

app.post('/api/tickets/:ticketNumber/attachments', upload.single('file'), async (request, response, next) => {
  try {
    const { requesterId, ticket } = await ownedTicket(request, String(request.params.ticketNumber));
    if (!requesterId) {
      response.status(400).json({ error: 'Development Requester context is invalid.' });
      return;
    }
    if (!ticket) {
      response.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }
    if (!request.file) {
      response.status(400).json({ error: 'Select one attachment to upload.' });
      return;
    }

    const extension = path.extname(request.file.originalname).toLowerCase();
    if (permittedAttachments.get(extension) !== request.file.mimetype) {
      response.status(400).json({ error: 'Only JPG, JPEG, PNG, WEBP, and PDF attachments are permitted.' });
      return;
    }

    const activeAttachmentCount = await prisma.attachment.count({
      where: { ticketId: ticket.id, removedAt: null }
    });
    if (activeAttachmentCount >= 5) {
      response.status(400).json({ error: 'A ticket can have at most five active attachments.' });
      return;
    }

    const storedFileName = `${randomUUID()}${extension}`;
    await mkdir(attachmentDirectory, { recursive: true });
    await writeFile(path.join(attachmentDirectory, storedFileName), request.file.buffer);

    try {
      const attachment = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          originalFileName: request.file.originalname,
          storedFileName,
          mimeType: request.file.mimetype,
          sizeBytes: request.file.size
        }
      });
      response.status(201).json(attachmentInfo(attachment));
    } catch (error) {
      await unlink(path.join(attachmentDirectory, storedFileName)).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets/:ticketNumber/attachments', async (request, response, next) => {
  try {
    const { requesterId, ticket } = await ownedTicket(request, String(request.params.ticketNumber));
    if (!requesterId) {
      response.status(400).json({ error: 'Development Requester context is invalid.' });
      return;
    }
    if (!ticket) {
      response.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId: ticket.id, removedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    response.status(200).json(attachments.map(attachmentInfo));
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets/:ticketNumber/attachments/:attachmentId/download', async (request, response, next) => {
  try {
    const { requesterId, ticket } = await ownedTicket(request, String(request.params.ticketNumber));
    const attachmentId = Number(request.params.attachmentId);
    if (!requesterId || !Number.isInteger(attachmentId) || attachmentId <= 0) {
      response.status(400).json({ error: 'Attachment request is invalid.' });
      return;
    }
    if (!ticket) {
      response.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id, removedAt: null }
    });
    if (!attachment) {
      response.status(404).json({ error: 'Attachment not found.' });
      return;
    }

    const filePath = path.join(attachmentDirectory, attachment.storedFileName);
    await access(filePath);
    response.download(filePath, attachment.originalFileName);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tickets/:ticketNumber/attachments/:attachmentId', async (request, response, next) => {
  try {
    const { requesterId, ticket } = await ownedTicket(request, String(request.params.ticketNumber));
    const attachmentId = Number(request.params.attachmentId);
    if (!requesterId || !Number.isInteger(attachmentId) || attachmentId <= 0) {
      response.status(400).json({ error: 'Attachment request is invalid.' });
      return;
    }
    if (!ticket) {
      response.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId: ticket.id, removedAt: null }
    });
    if (!attachment) {
      response.status(404).json({ error: 'Attachment not found.' });
      return;
    }

    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { removedAt: new Date(), removedByRequesterId: requesterId }
    });
    response.status(200).json({ message: 'Attachment removed.' });
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
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: 'Attachment must be 5 MB or smaller.' });
      return;
    }
    console.error(error);
    response.status(500).json({
      error: 'Unable to process the request'
    });
  }
);
