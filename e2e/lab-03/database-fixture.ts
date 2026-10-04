import { PrismaClient, type UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import { hashPassword } from '../../server/src/auth-policy.js';
import {
  e2ePassword,
  e2eTicketPrefix,
  e2eUserEmailPrefix,
  e2eUsers,
  staffTicketNumber
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

  await prisma.ticket.deleteMany({
    where: {
      OR: [
        { ticketNumber: { startsWith: e2eTicketPrefix } },
        ...(userIds.length ? [{ requesterId: { in: userIds } }] : [])
      ]
    }
  });

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
    if (!requester) throw new Error('The E2E requester fixture was not created.');

    await prisma.ticket.create({
      data: {
        ticketNumber: staffTicketNumber,
        idempotencyKey: '00000000-0000-4000-8000-000000003400',
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: 'Lab 3 E2E staff workflow',
        description: 'A deterministic ticket for claim, priority, status, comment, and note evidence.',
        requestedPriority: 'HIGH',
        itPriority: 'MEDIUM',
        status: 'NEW'
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
