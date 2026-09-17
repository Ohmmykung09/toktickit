import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hash, verify } from 'argon2';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma as adminPrisma } from '../../src/db.js';
import {
  argon2idOptions,
  assertValidInitialPassword,
  maximumPasswordLength,
  minimumPasswordLength,
  requireConfiguredInitialPassword,
  seedDatabase,
  seedUsers
} from '../../src/seed-data.js';

const migrationFiles = [
  new URL('../../prisma/migrations/20260814144249_create_category/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260822000000_lab2_ticket_foundation/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260901000000_lab2_review_fixes/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911000000_lab3_user_migration/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911100000_bind_session_version/migration.sql', import.meta.url)
];
const validInitialPassword = 'Lab3TestPass!';
const categoryNameForPreservation = 'Account and Access';

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
  const schema = 'lab3_' + randomUUID().replaceAll('-', '');
  await adminPrisma.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  const client = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl(schema) } } });

  try {
    await run(client);
  } finally {
    await client.$disconnect();
    await adminPrisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
  }
}

afterAll(async () => {
  await adminPrisma.$disconnect();
});

describe('Lab 3 isolated migration and seed', () => {
  it('applies the actual migration history to an empty schema', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client);

      const statuses = await client.$queryRawUnsafe<Array<{ enumlabel: string }>>(
        'SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid ' +
          'JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace ' +
          "WHERE pg_type.typname = 'TicketStatus' AND pg_namespace.nspname = current_schema() " +
          'ORDER BY pg_enum.enumsortorder'
      );

      expect(statuses.map(({ enumlabel }) => enumlabel)).toEqual([
        'NEW',
        'OPEN',
        'IN_PROGRESS',
        'WAITING_FOR_REQUESTER',
        'RESOLVED',
        'CLOSED',
        'REOPENED',
        'CANCELLED'
      ]);
      expect(await client.user.count()).toBe(0);
      expect(await client.session.count()).toBe(0);
      expect(await client.publicComment.count()).toBe(0);
      expect(await client.internalNote.count()).toBe(0);
    });
  });

  it('migrates populated Lab 2 data without changing ownership or installing credentials', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client, 3);
      const [requester] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "DevelopmentRequester" ("name", "email", "isActive") ' +
          "VALUES ('Legacy Requester', ' Legacy@Example.Test ', true) RETURNING \"id\""
      );
      const [category] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "Category" ("name", "isActive") ' +
          "VALUES ('Legacy Category', true) RETURNING \"id\""
      );
      const [system] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "RelatedSystem" ("name", "isActive") ' +
          "VALUES ('Legacy System', true) RETURNING \"id\""
      );
      const [ticket] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "Ticket" (' +
          '"ticketNumber", "idempotencyKey", "requesterId", "categoryId", "relatedSystemId", ' +
          '"summary", "requestedPriority", "description", "updatedAt") VALUES (' +
          "'TKT-LEGACY-0001', '00000000-0000-4000-8000-000000000001', " +
          requester.id +
          ', ' +
          category.id +
          ', ' +
          system.id +
          ", 'Legacy ticket', CAST('HIGH' AS \"RequestedPriority\"), " +
          "'Legacy ownership must remain intact.', CURRENT_TIMESTAMP) RETURNING \"id\""
      );
      const [attachment] = await client.$queryRawUnsafe<Array<{ id: number }>>(
        'INSERT INTO "Attachment" (' +
          '"ticketId", "originalFileName", "storedFileName", "mimeType", "sizeBytes", ' +
          '"removedAt", "removedByRequesterId") VALUES (' +
          ticket.id +
          ", 'legacy.pdf', 'legacy-storage.pdf', 'application/pdf', 128, CURRENT_TIMESTAMP, " +
          requester.id +
          ') RETURNING "id"'
      );

      await applySqlFile(client, migrationFiles[3]);

      const migratedUser = await client.user.findUniqueOrThrow({ where: { id: requester.id } });
      const migratedTicket = await client.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      const migratedAttachment = await client.attachment.findUniqueOrThrow({ where: { id: attachment.id } });

      expect(migratedUser).toMatchObject({
        id: requester.id,
        email: 'legacy@example.test',
        role: 'REQUESTER',
        passwordHash: null,
        passwordProvisionedAt: null,
        mustChangePassword: true
      });
      expect(migratedTicket).toMatchObject({
        requesterId: requester.id,
        ownerId: null,
        requestedPriority: 'HIGH',
        itPriority: 'HIGH',
        status: 'NEW'
      });
      expect(migratedAttachment.removedByUserId).toBe(requester.id);

      const provisioning = await seedDatabase(client, validInitialPassword);
      const provisionedUser = await client.user.findUniqueOrThrow({ where: { id: requester.id } });
      expect(provisioning.provisionedUsers).toBe(1);
      expect(provisionedUser.passwordHash).toMatch(/^\$argon2id\$/);
      expect(provisionedUser.passwordProvisionedAt).toBeInstanceOf(Date);
      expect(await verify(provisionedUser.passwordHash!, validInitialPassword)).toBe(true);
      expect(provisionedUser.name).toBe('Legacy Requester');
    });
  });

  it('preserves edited user and lookup state when the seed runs again', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client);
      await seedDatabase(client, validInitialPassword);

      const editedPassword = 'EditedStatePass!';
      const editedPasswordHash = await hash(editedPassword, argon2idOptions);
      const original = await client.user.findUniqueOrThrow({ where: { email: seedUsers[0].email } });
      await client.user.update({
        where: { id: original.id },
        data: {
          name: 'Locally Edited Name',
          role: 'IT_STAFF',
          isActive: false,
          passwordHash: editedPasswordHash,
          passwordProvisionedAt: new Date('2026-09-11T12:00:00.000Z'),
          mustChangePassword: false,
          failedLoginAttempts: 4,
          lockedUntil: new Date('2026-09-11T13:00:00.000Z')
        }
      });
      await client.category.update({
        where: { name: categoryNameForPreservation },
        data: { isActive: false }
      });

      const beforeCounts = await Promise.all([
        client.user.count(),
        client.ticket.count(),
        client.publicComment.count(),
        client.internalNote.count()
      ]);
      await seedDatabase(client, 'DifferentPass2!');
      const afterCounts = await Promise.all([
        client.user.count(),
        client.ticket.count(),
        client.publicComment.count(),
        client.internalNote.count()
      ]);
      const edited = await client.user.findUniqueOrThrow({ where: { id: original.id } });

      expect(afterCounts).toEqual(beforeCounts);
      expect(edited).toMatchObject({
        name: 'Locally Edited Name',
        role: 'IT_STAFF',
        isActive: false,
        mustChangePassword: false,
        failedLoginAttempts: 4
      });
      expect(edited.lockedUntil).toEqual(new Date('2026-09-11T13:00:00.000Z'));
      expect(await verify(edited.passwordHash!, editedPassword)).toBe(true);
      expect(
        await client.category.findUniqueOrThrow({ where: { name: categoryNameForPreservation } })
      ).toMatchObject({ isActive: false });
    });
  });

  it('enforces canonical email storage and canonical uniqueness in PostgreSQL', async () => {
    await withIsolatedSchema(async (client) => {
      await applyMigrations(client);

      await expect(
        client.user.create({
          data: { name: 'Mixed Case', email: 'Mixed@Example.Test', role: 'REQUESTER' }
        })
      ).rejects.toThrow();

      await client.user.create({
        data: { name: 'Canonical', email: 'canonical@example.test', role: 'REQUESTER' }
      });
      await expect(
        client.user.create({
          data: { name: 'Duplicate', email: 'canonical@example.test', role: 'IT_STAFF' }
        })
      ).rejects.toThrow();
    });
  });

  it('enforces the exact initial-password boundaries before Argon2id hashing', () => {
    expect(() => requireConfiguredInitialPassword(undefined)).toThrow(/is required/);
    expect(() =>
      assertValidInitialPassword('A1!' + 'x'.repeat(minimumPasswordLength - 4))
    ).toThrow(/12 to 128/);
    expect(() =>
      assertValidInitialPassword('A1!' + 'x'.repeat(minimumPasswordLength - 3))
    ).not.toThrow();
    expect(() =>
      assertValidInitialPassword('A1!' + 'x'.repeat(maximumPasswordLength - 3))
    ).not.toThrow();
    expect(() =>
      assertValidInitialPassword('A1!' + 'x'.repeat(maximumPasswordLength - 2))
    ).toThrow(/12 to 128/);
  });
});
