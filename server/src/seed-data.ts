import { argon2id, hash } from 'argon2';
import type { PrismaClient, RequestedPriority, TicketStatus, UserRole } from '@prisma/client';

export const minimumPasswordLength = 12;
export const maximumPasswordLength = 128;

export const argon2idOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const;

export const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network'
] as const;

export const relatedSystemNames = [
  'Campus Wi-Fi',
  'Corporate Laptop',
  'Email',
  'Grade Submission App',
  'LEB2 App',
  'Printer',
  'VPN'
] as const;

export const seedUsers: ReadonlyArray<{
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}> = [
  { name: 'Aom S.', email: 'aom@example.test', role: 'REQUESTER', isActive: true },
  { name: 'Beam K.', email: 'beam@example.test', role: 'REQUESTER', isActive: true },
  { name: 'Mew P.', email: 'mew@example.test', role: 'REQUESTER', isActive: true },
  { name: 'Nok T.', email: 'nok@example.test', role: 'REQUESTER', isActive: true },
  { name: 'Retired Requester', email: 'inactive@example.test', role: 'REQUESTER', isActive: false },
  { name: 'Ploy IT', email: 'ploy.it@example.test', role: 'IT_STAFF', isActive: true },
  { name: 'Ton IT', email: 'ton.it@example.test', role: 'IT_STAFF', isActive: true },
  { name: 'Mint IT', email: 'mint.it@example.test', role: 'IT_STAFF', isActive: true },
  { name: 'Former IT', email: 'former.it@example.test', role: 'IT_STAFF', isActive: false },
  { name: 'TokTickIT Admin', email: 'admin@example.test', role: 'ADMINISTRATOR', isActive: true }
];

const seedTickets: ReadonlyArray<{
  ticketNumber: string;
  requesterEmail: string;
  ownerEmail: string | null;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  status: TicketStatus;
  requesterIndicatedResolution: boolean;
}> = [
  {
    ticketNumber: 'TKT-20260911-9001',
    requesterEmail: 'aom@example.test',
    ownerEmail: null,
    categoryName: 'Account and Access',
    relatedSystemName: 'Email',
    summary: 'Unable to access university email',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    status: 'NEW',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9002',
    requesterEmail: 'beam@example.test',
    ownerEmail: 'ploy.it@example.test',
    categoryName: 'Hardware',
    relatedSystemName: 'Corporate Laptop',
    summary: 'Laptop battery drains unexpectedly',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    status: 'OPEN',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9003',
    requesterEmail: 'mew@example.test',
    ownerEmail: 'ton.it@example.test',
    categoryName: 'Network',
    relatedSystemName: 'Campus Wi-Fi',
    summary: 'Campus Wi-Fi disconnects repeatedly',
    requestedPriority: 'CRITICAL',
    itPriority: 'CRITICAL',
    status: 'IN_PROGRESS',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9004',
    requesterEmail: 'nok@example.test',
    ownerEmail: 'mint.it@example.test',
    categoryName: 'Software',
    relatedSystemName: 'Grade Submission App',
    summary: 'Grade submission confirmation missing',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    status: 'WAITING_FOR_REQUESTER',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9005',
    requesterEmail: 'aom@example.test',
    ownerEmail: 'ploy.it@example.test',
    categoryName: 'Network',
    relatedSystemName: 'VPN',
    summary: 'VPN connection restored after update',
    requestedPriority: 'MEDIUM',
    itPriority: 'LOW',
    status: 'RESOLVED',
    requesterIndicatedResolution: true
  },
  {
    ticketNumber: 'TKT-20260911-9006',
    requesterEmail: 'beam@example.test',
    ownerEmail: 'ton.it@example.test',
    categoryName: 'Hardware',
    relatedSystemName: 'Printer',
    summary: 'Printer queue issue completed',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    status: 'CLOSED',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9007',
    requesterEmail: 'mew@example.test',
    ownerEmail: 'mint.it@example.test',
    categoryName: 'Software',
    relatedSystemName: 'LEB2 App',
    summary: 'Course page issue returned',
    requestedPriority: 'MEDIUM',
    itPriority: 'HIGH',
    status: 'REOPENED',
    requesterIndicatedResolution: false
  },
  {
    ticketNumber: 'TKT-20260911-9008',
    requesterEmail: 'nok@example.test',
    ownerEmail: null,
    categoryName: 'Account and Access',
    relatedSystemName: 'Email',
    summary: 'Duplicate access request cancelled',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    status: 'CANCELLED',
    requesterIndicatedResolution: false
  }
];

export function assertValidInitialPassword(password: string) {
  if (password.length < minimumPasswordLength || password.length > maximumPasswordLength) {
    throw new Error(
      `LAB3_SEED_INITIAL_PASSWORD must contain ${minimumPasswordLength} to ${maximumPasswordLength} characters.`
    );
  }

  const characterClasses = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  if (characterClasses < 3) {
    throw new Error('LAB3_SEED_INITIAL_PASSWORD must use at least three character classes.');
  }
}

export function requireConfiguredInitialPassword(password: string | undefined) {
  if (!password) {
    throw new Error(
      'LAB3_SEED_INITIAL_PASSWORD is required. Set it only in the ignored local environment before seeding.'
    );
  }
  assertValidInitialPassword(password);
  return password;
}

export async function hashInitialPassword(password: string) {
  assertValidInitialPassword(password);
  return hash(password, argon2idOptions);
}

export async function seedDatabase(prisma: PrismaClient, initialPassword: string) {
  const passwordHash = await hashInitialPassword(initialPassword);
  const passwordProvisionedAt = new Date();

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true }
    });
  }

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true }
    });
  }

  for (const user of seedUsers) {
    const email = user.email.trim().toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        ...user,
        email,
        passwordHash,
        passwordProvisionedAt,
        mustChangePassword: true
      }
    });
  }

  const provisionedUsers = await prisma.user.updateMany({
    where: {
      passwordHash: null,
      passwordProvisionedAt: null
    },
    data: {
      passwordHash,
      passwordProvisionedAt,
      mustChangePassword: true
    }
  });

  const [users, categories, relatedSystems] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: seedUsers.map((user) => user.email) } } }),
    prisma.category.findMany({ where: { name: { in: [...categoryNames] } } }),
    prisma.relatedSystem.findMany({ where: { name: { in: [...relatedSystemNames] } } })
  ]);
  const usersByEmail = new Map(users.map((user) => [user.email, user]));
  const categoriesByName = new Map(categories.map((category) => [category.name, category]));
  const systemsByName = new Map(relatedSystems.map((system) => [system.name, system]));

  for (const [index, fixture] of seedTickets.entries()) {
    const requester = usersByEmail.get(fixture.requesterEmail);
    const owner = fixture.ownerEmail ? usersByEmail.get(fixture.ownerEmail) : null;
    const category = categoriesByName.get(fixture.categoryName);
    const relatedSystem = systemsByName.get(fixture.relatedSystemName);
    if (!requester || !category || !relatedSystem || (fixture.ownerEmail && !owner)) {
      throw new Error(`Seed references are incomplete for ${fixture.ticketNumber}.`);
    }

    const indicatedAt = fixture.requesterIndicatedResolution ? new Date('2026-09-11T09:00:00.000Z') : null;
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: fixture.ticketNumber },
      update: {},
      create: {
        ticketNumber: fixture.ticketNumber,
        idempotencyKey: `00000000-0000-4000-8000-${String(9001 + index).padStart(12, '0')}`,
        requesterId: requester.id,
        ownerId: owner?.id ?? null,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: fixture.summary,
        description: `Local Lab 3 fixture for ${fixture.summary.toLowerCase()}.`,
        requestedPriority: fixture.requestedPriority,
        itPriority: fixture.itPriority,
        status: fixture.status,
        requesterResolutionIndicatedAt: indicatedAt,
        requesterResolutionIndicatedById: indicatedAt ? requester.id : null
      }
    });

    if (index === 0) {
      const publicAuthor = usersByEmail.get('aom@example.test');
      const noteAuthor = usersByEmail.get('ploy.it@example.test');
      if (!publicAuthor || !noteAuthor) throw new Error('Seed message authors are missing.');

      const publicContent = 'I can reproduce this issue whenever I open the mail application.';
      const noteContent = 'Checked the account status; continue with access-log review.';
      const publicComment = await prisma.publicComment.findFirst({
        where: { ticketId: ticket.id, authorId: publicAuthor.id, content: publicContent }
      });
      if (!publicComment) {
        await prisma.publicComment.create({
          data: { ticketId: ticket.id, authorId: publicAuthor.id, content: publicContent }
        });
      }

      const internalNote = await prisma.internalNote.findFirst({
        where: { ticketId: ticket.id, authorId: noteAuthor.id, content: noteContent }
      });
      if (!internalNote) {
        await prisma.internalNote.create({
          data: { ticketId: ticket.id, authorId: noteAuthor.id, content: noteContent }
        });
      }
    }
  }

  return {
    categories: categoryNames.length,
    relatedSystems: relatedSystemNames.length,
    users: seedUsers.length,
    tickets: seedTickets.length,
    provisionedUsers: provisionedUsers.count
  };
}
