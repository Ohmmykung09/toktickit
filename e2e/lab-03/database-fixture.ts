import { PrismaClient, type UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import { hashPassword } from '../../server/src/auth-policy.js';
import {
  e2ePassword,
  actionTicketNumber,
  e2eTicketPrefix,
  e2eUserEmailPrefix,
  e2eUsers,
  requesterResolvedTicketNumber,
  requesterWaitingTicketNumber,
  resolutionTicketNumber,
  staffTicketNumber,
  staffUrgentTicketNumber
} from './fixture-data.js';

dotenv.config({ path: 'server/.env' });

function databaseClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Create server/.env with DATABASE_URL before running the Lab 3 E2E suite.');
  }
  return new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
}

async function cleanFixtureData(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: e2eUserEmailPrefix } },
    select: { id: true }
  });
  const userIds = users.map(({ id }) => id);

  const fixtureTickets = await prisma.ticket.findMany({
    where: {
      OR: [
        { ticketNumber: { startsWith: e2eTicketPrefix } },
        ...(userIds.length ? [{ requesterId: { in: userIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const fixtureTicketIds = fixtureTickets.map(({ id }) => id);
  if (fixtureTicketIds.length) {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: fixtureTicketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: fixtureTicketIds } } });
  }

  if (userIds.length) {
    await prisma.publicComment.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.internalNote.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.ticket.updateMany({ where: { ownerId: { in: userIds } }, data: { ownerId: null } });
    await prisma.ticket.updateMany({
      where: { requesterResolutionIndicatedById: { in: userIds } },
      data: { requesterResolutionIndicatedById: null, requesterResolutionIndicatedAt: null }
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

export async function prepareDatabaseFixture() {
  const prisma = databaseClient();
  try {
    await cleanFixtureData(prisma);
    const passwordHash = await hashPassword(e2ePassword);
    const createdUsers = new Map<string, { id: number }>();

    for (const user of Object.values(e2eUsers)) {
      const created = await prisma.user.create({
        data: {
          ...user,
          role: user.role as UserRole,
          isActive: user !== e2eUsers.inactive,
          mustChangePassword: user === e2eUsers.firstLogin,
          passwordHash,
          passwordProvisionedAt: new Date()
        },
        select: { id: true }
      });
      createdUsers.set(user.email, created);
    }

    const category = await prisma.category.upsert({
      where: { name: 'Network' },
      update: { isActive: true },
      create: { name: 'Network', isActive: true }
    });
    const relatedSystem = await prisma.relatedSystem.upsert({
      where: { name: 'Campus Wi-Fi' },
      update: { isActive: true },
      create: { name: 'Campus Wi-Fi', isActive: true }
    });
    const requester = createdUsers.get(e2eUsers.requester.email);
    const staff = createdUsers.get(e2eUsers.staff.email);
    if (!requester || !staff) throw new Error('The E2E actor fixtures were not created.');

    const now = new Date();
    const ticketFixtures = [
      { ticketNumber: staffTicketNumber, summary: 'Lab 3 E2E staff workflow', status: 'NEW' as const, ownerId: null, itPriority: 'MEDIUM' as const },
      { ticketNumber: actionTicketNumber, summary: 'Lab 4 E2E Actions Taken workflow', status: 'OPEN' as const, ownerId: staff.id, itPriority: 'HIGH' as const },
      { ticketNumber: resolutionTicketNumber, summary: 'Lab 4 E2E Ticket resolution workflow', status: 'OPEN' as const, ownerId: staff.id, itPriority: 'MEDIUM' as const },
      { ticketNumber: requesterWaitingTicketNumber, summary: 'Lab 4 E2E requester waiting ticket', status: 'WAITING_FOR_REQUESTER' as const, ownerId: staff.id, itPriority: 'LOW' as const },
      { ticketNumber: requesterResolvedTicketNumber, summary: 'Lab 4 E2E requester resolved ticket', status: 'RESOLVED' as const, ownerId: staff.id, itPriority: 'LOW' as const, resolvedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      { ticketNumber: staffUrgentTicketNumber, summary: 'Lab 4 E2E urgent unassigned ticket', status: 'NEW' as const, ownerId: null, itPriority: 'CRITICAL' as const }
    ];

    const createdTickets = new Map<string, { id: number }>();
    for (const [index, fixture] of ticketFixtures.entries()) {
      const created = await prisma.ticket.create({
        data: {
          ...fixture,
          idempotencyKey: `00000000-0000-4000-8000-${String(index + 3400).padStart(12, '0')}`,
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          description: `Deterministic browser fixture for ${fixture.summary}.`,
          requestedPriority: 'HIGH',
          updatedAt: now
        },
        select: { id: true }
      });
      createdTickets.set(fixture.ticketNumber, created);
    }

    const waitingTicket = createdTickets.get(requesterWaitingTicketNumber);
    if (!waitingTicket) throw new Error('The Lab 4 requester ticket fixture was not created.');
    await prisma.actionTaken.create({
      data: {
        ticketId: waitingTicket.id,
        actionDateTime: now,
        description: 'Reviewed the requester connection report.',
        result: 'A follow-up confirmation is needed from the requester.',
        status: 'WAITING_FOR_REQUESTER',
        assigneeId: staff.id,
        createdById: staff.id,
        performedById: staff.id,
        followUpRequired: true,
        followUpNote: 'Confirm whether the connection remains stable.'
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function removeDatabaseFixture() {
  const prisma = databaseClient();
  try {
    await cleanFixtureData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
