import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma as adminPrisma } from '../../src/db.js';
import { seedDatabase } from '../../src/seed-data.js';

const migrationFiles = [
  new URL('../../prisma/migrations/20260814144249_create_category/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260822000000_lab2_ticket_foundation/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260901000000_lab2_review_fixes/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911000000_lab3_user_migration/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911100000_bind_session_version/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260928000000_lab4_action_taken_foundation/migration.sql', import.meta.url)
];
const validInitialPassword = 'Lab4TestPass!';

function isolatedDatabaseUrl(schema: string) {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required for migration integration tests.');
  const url = new URL(configuredUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

async function applySqlFile(client: PrismaClient, file: URL) {
  const sql = await readFile(file, 'utf8');
  const statements = sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}

async function applyMigrations(client: PrismaClient, count = migrationFiles.length) {
  for (const file of migrationFiles.slice(0, count)) {
    await applySqlFile(client, file);
  }
}

async function withIsolatedSchema(run: (client: PrismaClient) => Promise<void>) {
  const schema = 'lab4_' + randomUUID().replaceAll('-', '');
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const client = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl(schema) } } });

  try {
    await run(client);
  } finally {
    await client.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}

afterAll(async () => {
  await adminPrisma.$disconnect();
});

describe('Lab 4 Actions Taken migration and seed', () => {
  it('applies the complete migration history and seeds zero, one, and multiple Actions Taken', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client);

      const result = await seedDatabase(client, validInitialPassword);
      expect(result.actionsTaken).toBe(7);
      expect(await client.actionTaken.count()).toBe(7);
      expect(
        await client.actionTaken.count({ where: { ticket: { ticketNumber: 'TKT-20260911-9001' } } })
      ).toBe(0);
      expect(
        await client.actionTaken.count({ where: { ticket: { ticketNumber: 'TKT-20260911-9002' } } })
      ).toBe(1);
      expect(
        await client.actionTaken.count({ where: { ticket: { ticketNumber: 'TKT-20260911-9003' } } })
      ).toBe(2);

      const completed = await client.actionTaken.findUniqueOrThrow({
        where: { fixtureKey: 'lab4-action-9005-01' },
        include: { ticket: true, createdBy: true, performedBy: true, assignee: true }
      });
      expect(completed).toMatchObject({
        status: 'COMPLETED',
        resolutionCycle: 1,
        version: 1,
        followUpRequired: false,
        completedAt: new Date('2026-09-11T09:35:00.000Z'),
        cancelledAt: null,
        ticket: { ticketNumber: 'TKT-20260911-9005', resolutionCycle: 1 },
        createdBy: { role: 'IT_STAFF' },
        performedBy: { role: 'IT_STAFF' },
        assignee: { role: 'IT_STAFF', isActive: true }
      });
    });
  });

  it('adds the foundation to populated Lab 3 data without changing legacy records', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client, 5);

      const [requester] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "User" ("name", "email", "role", "isActive") ' +
          "VALUES ('Legacy Requester', 'legacy@example.test', 'REQUESTER', true) RETURNING \"id\""
      );
      const [category] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "Category" ("name", "isActive") VALUES (\'Legacy Category\', true) RETURNING "id"'
      );
      const [system] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "RelatedSystem" ("name", "isActive") VALUES (\'Legacy System\', true) RETURNING "id"'
      );
      const [ticket] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "Ticket" (' +
          '"ticketNumber", "idempotencyKey", "requesterId", "categoryId", "relatedSystemId", ' +
          '"summary", "requestedPriority", "itPriority", "description", "status", "updatedAt"' +
          ') VALUES (' +
          "'TKT-LEGACY-0001', '00000000-0000-4000-8000-000000000001', " +
          requester.id +
          ', ' +
          category.id +
          ', ' +
          system.id +
          ", 'Legacy ticket', 'HIGH', 'HIGH', 'Preserve this ticket', 'NEW', CURRENT_TIMESTAMP) RETURNING \"id\""
      );
      await client.$executeRawUnsafe(
        'INSERT INTO "Attachment" (' +
          '"ticketId", "originalFileName", "storedFileName", "mimeType", "sizeBytes"' +
          ') VALUES (' +
          ticket.id +
          ", 'legacy.pdf', 'legacy-storage.pdf', 'application/pdf', 128)"
      );
      await client.$executeRawUnsafe(
        'INSERT INTO "PublicComment" ("ticketId", "authorId", "content") VALUES (' +
          ticket.id +
          ", " +
          requester.id +
          ", 'Legacy public comment')"
      );
      await client.$executeRawUnsafe(
        'INSERT INTO "InternalNote" ("ticketId", "authorId", "content") VALUES (' +
          ticket.id +
          ", " +
          requester.id +
          ", 'Legacy internal note')"
      );

      const before = await Promise.all([
        client.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) FROM "User"'),
        client.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) FROM "Ticket"'),
        client.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) FROM "Attachment"'),
        client.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) FROM "PublicComment"'),
        client.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) FROM "InternalNote"')
      ]);

      await applySqlFile(client, migrationFiles[5]);

      const after = await Promise.all([
        client.user.count(),
        client.ticket.count(),
        client.attachment.count(),
        client.publicComment.count(),
        client.internalNote.count()
      ]);
      expect(after).toEqual(before.map(([row]) => Number(row.count)));

      const migratedTicket = await client.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(migratedTicket).toMatchObject({
        ticketNumber: 'TKT-LEGACY-0001',
        summary: 'Legacy ticket',
        status: 'NEW',
        resolutionCycle: 1,
        resolvedAt: null
      });
      expect(await client.actionTaken.count()).toBe(0);
      expect(await client.attachment.count({ where: { ticketId: ticket.id } })).toBe(1);
      expect(await client.publicComment.count({ where: { ticketId: ticket.id } })).toBe(1);
      expect(await client.internalNote.count({ where: { ticketId: ticket.id } })).toBe(1);
    });
  });

  it('keeps user-managed values and fixture counts unchanged on repeated seed runs', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client);
      await seedDatabase(client, validInitialPassword);

      const action = await client.actionTaken.findUniqueOrThrow({
        where: { fixtureKey: 'lab4-action-9002-01' }
      });
      await client.actionTaken.update({
        where: { id: action.id },
        data: {
          description: 'User-managed action description',
          result: 'User-managed result'
        }
      });
      const ticket = await client.ticket.findUniqueOrThrow({
        where: { ticketNumber: 'TKT-20260911-9002' }
      });
      await client.ticket.update({
        where: { id: ticket.id },
        data: { summary: 'User-managed ticket summary' }
      });

      const beforeCounts = await Promise.all([
        client.user.count(),
        client.ticket.count(),
        client.actionTaken.count(),
        client.publicComment.count(),
        client.internalNote.count()
      ]);
      await seedDatabase(client, 'DifferentPass2!');
      const afterCounts = await Promise.all([
        client.user.count(),
        client.ticket.count(),
        client.actionTaken.count(),
        client.publicComment.count(),
        client.internalNote.count()
      ]);
      expect(afterCounts).toEqual(beforeCounts);

      await expect(
        client.actionTaken.findUniqueOrThrow({ where: { fixtureKey: 'lab4-action-9002-01' } })
      ).resolves.toMatchObject({
        description: 'User-managed action description',
        result: 'User-managed result'
      });
      await expect(
        client.ticket.findUniqueOrThrow({ where: { ticketNumber: 'TKT-20260911-9002' } })
      ).resolves.toMatchObject({ summary: 'User-managed ticket summary' });
    });
  });
});
