import { Prisma, RequestedPriority, TicketStatus, UserRole } from '@prisma/client';
import { Router } from 'express';
import { prisma } from './db.js';
import { requireRole } from './auth-router.js';

export const staffRouter = Router();

const staffOnly = requireRole(UserRole.IT_STAFF, UserRole.ADMINISTRATOR);
const pageSizes = [10, 20, 50] as const;
const sortFields = ['createdAt', 'updatedAt', 'ticketNumber', 'requestedPriority', 'itPriority', 'status'] as const;

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
