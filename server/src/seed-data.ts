import type {
  ActionTakenStatus,
  PrismaClient,
  RequestedPriority,
  TicketStatus,
  UserRole
} from '@prisma/client';
import {
  argon2idOptions,
  hashPassword,
  maximumPasswordLength,
  minimumPasswordLength,
  passwordValidationError
} from './auth-policy.js';

export { argon2idOptions, maximumPasswordLength, minimumPasswordLength };

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

const seedActions: ReadonlyArray<{
  fixtureKey: string;
  ticketNumber: string;
  actionDateTime: Date;
  description: string;
  result: string;
  status: ActionTakenStatus;
  assigneeEmail: string | null;
  performedByEmail: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}> = [
  {
    fixtureKey: 'lab4-action-9002-01',
    ticketNumber: 'TKT-20260911-9002',
    actionDateTime: new Date('2026-09-11T08:15:00.000Z'),
    description: 'Checked the laptop battery health and power-management settings.',
    result: 'Battery health is degraded; a replacement request was prepared.',
    status: 'COMPLETED',
    assigneeEmail: 'ploy.it@example.test',
    performedByEmail: 'ploy.it@example.test',
    followUpRequired: true,
    followUpNote: 'Confirm the replacement schedule with the requester.',
    attachmentNotes: 'Look for the battery diagnostic screenshot.',
    completedAt: new Date('2026-09-11T08:30:00.000Z'),
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9003-01',
    ticketNumber: 'TKT-20260911-9003',
    actionDateTime: new Date('2026-09-11T08:45:00.000Z'),
    description: 'Reviewed the access-point logs for repeated client disconnects.',
    result: 'The affected access point shows repeated radio resets.',
    status: 'IN_PROGRESS',
    assigneeEmail: 'ton.it@example.test',
    performedByEmail: 'ton.it@example.test',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    completedAt: null,
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9003-02',
    ticketNumber: 'TKT-20260911-9003',
    actionDateTime: new Date('2026-09-11T09:10:00.000Z'),
    description: 'Applied a temporary channel change and started a stability check.',
    result: 'The temporary change reduced disconnects during the first observation period.',
    status: 'WAITING_FOR_REQUESTER',
    assigneeEmail: 'ton.it@example.test',
    performedByEmail: 'ploy.it@example.test',
    followUpRequired: true,
    followUpNote: 'Ask the requester to confirm stability from the affected area.',
    attachmentNotes: 'Look for the wireless stability capture.',
    completedAt: null,
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9005-01',
    ticketNumber: 'TKT-20260911-9005',
    actionDateTime: new Date('2026-09-11T09:20:00.000Z'),
    description: 'Updated the VPN profile and verified a new connection.',
    result: 'The requester connected successfully and the VPN route was verified.',
    status: 'COMPLETED',
    assigneeEmail: 'ploy.it@example.test',
    performedByEmail: 'ploy.it@example.test',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    completedAt: new Date('2026-09-11T09:35:00.000Z'),
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9006-01',
    ticketNumber: 'TKT-20260911-9006',
    actionDateTime: new Date('2026-09-11T10:00:00.000Z'),
    description: 'Cleared the stuck printer queue and restarted the print service.',
    result: 'The queued document printed successfully.',
    status: 'COMPLETED',
    assigneeEmail: 'ton.it@example.test',
    performedByEmail: 'ton.it@example.test',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    completedAt: new Date('2026-09-11T10:15:00.000Z'),
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9007-01',
    ticketNumber: 'TKT-20260911-9007',
    actionDateTime: new Date('2026-09-11T10:30:00.000Z'),
    description: 'Compared the returned course-page error with the previous deployment.',
    result: 'A deployment difference was found and additional requester confirmation is needed.',
    status: 'WAITING_FOR_REQUESTER',
    assigneeEmail: 'mint.it@example.test',
    performedByEmail: 'mint.it@example.test',
    followUpRequired: true,
    followUpNote: 'Request the affected course code and browser details.',
    attachmentNotes: null,
    completedAt: null,
    cancelledAt: null
  },
  {
    fixtureKey: 'lab4-action-9008-01',
    ticketNumber: 'TKT-20260911-9008',
    actionDateTime: new Date('2026-09-11T10:45:00.000Z'),
    description: 'Reviewed the duplicate access request against the original ticket.',
    result: 'The duplicate request was confirmed and no further work was required.',
    status: 'CANCELLED',
    assigneeEmail: 'ploy.it@example.test',
    performedByEmail: 'ploy.it@example.test',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    completedAt: null,
    cancelledAt: new Date('2026-09-11T10:50:00.000Z')
  }
];

export function assertValidInitialPassword(password: string) {
  const validationError = passwordValidationError(password);
  if (validationError) throw new Error(`LAB3_SEED_INITIAL_PASSWORD: ${validationError}`);
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
  return hashPassword(password);
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
        resolutionCycle: 1,
        resolvedAt:
          fixture.status === 'RESOLVED' || fixture.status === 'CLOSED'
            ? new Date('2026-09-11T09:35:00.000Z')
            : null,
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

  for (const fixture of seedActions) {
    const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: fixture.ticketNumber } });
    const creator = usersByEmail.get(fixture.performedByEmail);
    const performer = usersByEmail.get(fixture.performedByEmail);
    const assignee = fixture.assigneeEmail ? usersByEmail.get(fixture.assigneeEmail) : null;
    if (!ticket || !creator || !performer || (fixture.assigneeEmail && !assignee)) {
      throw new Error(`Seed references are incomplete for ${fixture.fixtureKey}.`);
    }

    await prisma.actionTaken.upsert({
      where: { fixtureKey: fixture.fixtureKey },
      update: {},
      create: {
        fixtureKey: fixture.fixtureKey,
        ticketId: ticket.id,
        actionDateTime: fixture.actionDateTime,
        description: fixture.description,
        result: fixture.result,
        status: fixture.status,
        resolutionCycle: 1,
        assigneeId: assignee?.id ?? null,
        createdById: creator.id,
        performedById: performer.id,
        followUpRequired: fixture.followUpRequired,
        followUpNote: fixture.followUpNote,
        attachmentNotes: fixture.attachmentNotes,
        completedAt: fixture.completedAt,
        cancelledAt: fixture.cancelledAt
      }
    });
  }

  return {
    categories: categoryNames.length,
    relatedSystems: relatedSystemNames.length,
    users: seedUsers.length,
    tickets: seedTickets.length,
    actionsTaken: seedActions.length,
    provisionedUsers: provisionedUsers.count
  };
}
