import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma as adminPrisma } from '../../src/db.js';

const historicalMigrationFiles = [
  new URL('../../prisma/migrations/20260814144249_create_category/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260822000000_lab2_ticket_foundation/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260901000000_lab2_review_fixes/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911000000_lab3_user_migration/migration.sql', import.meta.url),
  new URL('../../prisma/migrations/20260911100000_bind_session_version/migration.sql', import.meta.url)
];
const lab4MigrationFile = new URL(
  '../../prisma/migrations/20260928000000_lab4_action_taken_foundation/migration.sql',
  import.meta.url
);
const legacyTables = [
  'User',
  'Category',
  'RelatedSystem',
  'Ticket',
  'Attachment',
  'PublicComment',
  'InternalNote'
] as const;
const legacyTableColumns: Record<(typeof legacyTables)[number], string[]> = {
  User: [
    'id',
    'name',
    'email',
    'passwordHash',
    'passwordProvisionedAt',
    'role',
    'isActive',
    'mustChangePassword',
    'failedLoginAttempts',
    'failedLoginWindowStartedAt',
    'lockedUntil',
    'sessionVersion',
    'createdAt',
    'updatedAt'
  ],
  Category: ['id', 'name', 'isActive', 'createdAt'],
  RelatedSystem: ['id', 'name', 'isActive', 'createdAt'],
  Ticket: [
    'id',
    'ticketNumber',
    'idempotencyKey',
    'requesterId',
    'ownerId',
    'categoryId',
    'relatedSystemId',
    'summary',
    'requestedPriority',
    'itPriority',
    'description',
    'status',
    'requesterResolutionIndicatedAt',
    'requesterResolutionIndicatedById',
    'createdAt',
    'updatedAt'
  ],
  Attachment: [
    'id',
    'ticketId',
    'originalFileName',
    'storedFileName',
    'mimeType',
    'sizeBytes',
    'createdAt',
    'removedAt',
    'removedByUserId'
  ],
  PublicComment: ['id', 'ticketId', 'authorId', 'content', 'createdAt'],
  InternalNote: ['id', 'ticketId', 'authorId', 'content', 'createdAt']
};
const legacyBackupExpressions: Record<(typeof legacyTables)[number], string[]> = {
  User: [
    '"id"',
    '"name"',
    '"email"',
    '"passwordHash"',
    '"passwordProvisionedAt"',
    '"role"::text AS "role"',
    '"isActive"',
    '"mustChangePassword"',
    '"failedLoginAttempts"',
    '"failedLoginWindowStartedAt"',
    '"lockedUntil"',
    '"sessionVersion"',
    '"createdAt"',
    '"updatedAt"'
  ],
  Category: ['"id"', '"name"', '"isActive"', '"createdAt"'],
  RelatedSystem: ['"id"', '"name"', '"isActive"', '"createdAt"'],
  Ticket: [
    '"id"',
    '"ticketNumber"',
    '"idempotencyKey"',
    '"requesterId"',
    '"ownerId"',
    '"categoryId"',
    '"relatedSystemId"',
    '"summary"',
    '"requestedPriority"::text AS "requestedPriority"',
    '"itPriority"::text AS "itPriority"',
    '"description"',
    '"status"::text AS "status"',
    '"requesterResolutionIndicatedAt"',
    '"requesterResolutionIndicatedById"',
    '"createdAt"',
    '"updatedAt"'
  ],
  Attachment: [
    '"id"',
    '"ticketId"',
    '"originalFileName"',
    '"storedFileName"',
    '"mimeType"',
    '"sizeBytes"',
    '"createdAt"',
    '"removedAt"',
    '"removedByUserId"'
  ],
  PublicComment: ['"id"', '"ticketId"', '"authorId"', '"content"', '"createdAt"'],
  InternalNote: ['"id"', '"ticketId"', '"authorId"', '"content"', '"createdAt"']
};
const legacyRestoreExpressions: Record<(typeof legacyTables)[number], string[]> = {
  Category: legacyTableColumns.Category.map((column) => `"${column}"`),
  RelatedSystem: legacyTableColumns.RelatedSystem.map((column) => `"${column}"`),
  Attachment: legacyTableColumns.Attachment.map((column) => `"${column}"`),
  PublicComment: legacyTableColumns.PublicComment.map((column) => `"${column}"`),
  InternalNote: legacyTableColumns.InternalNote.map((column) => `"${column}"`),
  User: legacyTableColumns.User.map((column) =>
    column === 'role' ? '"role"::"UserRole"' : `"${column}"`
  ),
  Ticket: legacyTableColumns.Ticket.map((column) =>
    ['requestedPriority', 'itPriority'].includes(column)
      ? `"${column}"::"RequestedPriority"`
      : column === 'status'
        ? '"status"::"TicketStatus"'
        : `"${column}"`
  )
};

function isolatedDatabaseUrl(schema: string) {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required for migration recovery tests.');
  const url = new URL(configuredUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

function splitSql(sql: string) {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applySql(client: PrismaClient, sql: string) {
  for (const statement of splitSql(sql)) {
    await client.$executeRawUnsafe(statement);
  }
}

async function applySqlFile(client: PrismaClient, file: URL) {
  await applySql(client, await readFile(file, 'utf8'));
}

async function applyHistoricalMigrations(client: PrismaClient) {
  for (const file of historicalMigrationFiles) {
    await applySqlFile(client, file);
  }
}

async function legacyCounts(client: PrismaClient) {
  const counts = await Promise.all(
    legacyTables.map(async (table) => {
      const [row] = await client.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) FROM "${table}"`
      );
      return [table, Number(row.count)] as const;
    })
  );
  return Object.fromEntries(counts);
}

async function tableExists(client: PrismaClient, table: string) {
  const rows = await client.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '${table}'`
  );
  return rows.length === 1;
}

async function columnExists(client: PrismaClient, table: string, column: string) {
  const rows = await client.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${table}' AND column_name = '${column}'`
  );
  return rows.length === 1;
}

async function insertLegacyData(client: PrismaClient) {
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
      "'TKT-RECOVERY-0001', '00000000-0000-4000-8000-000000000099', " +
      requester.id +
      ', ' +
      category.id +
      ', ' +
      system.id +
      ", 'Legacy recovery ticket', 'HIGH', 'HIGH', 'Preserve this ticket', 'NEW', CURRENT_TIMESTAMP) RETURNING \"id\""
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "Attachment" ("ticketId", "originalFileName", "storedFileName", "mimeType", "sizeBytes") ' +
      `VALUES (${ticket.id}, 'legacy.pdf', 'legacy-storage.pdf', 'application/pdf', 128)`
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "PublicComment" ("ticketId", "authorId", "content") ' +
      `VALUES (${ticket.id}, ${requester.id}, 'Legacy public comment')`
  );
  await client.$executeRawUnsafe(
    'INSERT INTO "InternalNote" ("ticketId", "authorId", "content") ' +
      `VALUES (${ticket.id}, ${requester.id}, 'Legacy internal note')`
  );
}

async function snapshotLegacyData(client: PrismaClient, backupSchema: string) {
  for (const table of legacyTables) {
    const expressions = legacyBackupExpressions[table].join(', ');
    await client.$executeRawUnsafe(
      `CREATE TABLE "${backupSchema}"."${table}" AS SELECT ${expressions} FROM "${table}"`
    );
  }
}

async function restoreHistoricalSchema(
  client: PrismaClient,
  schema: string,
  backupSchema: string
) {
  await adminPrisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await applyHistoricalMigrations(client);

  for (const table of legacyTables) {
    const columns = legacyTableColumns[table].map((column) => `"${column}"`).join(', ');
    const expressions = legacyRestoreExpressions[table].join(', ');
    await client.$executeRawUnsafe(
      `INSERT INTO "${table}" (${columns}) SELECT ${expressions} FROM "${backupSchema}"."${table}"`
    );
  }
}

async function withIsolatedSchema(
  run: (client: PrismaClient, schema: string, backupSchema: string) => Promise<void>
) {
  const schema = 'lab4_recovery_' + randomUUID().replaceAll('-', '');
  const backupSchema = schema + '_backup';
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${backupSchema}"`);
  const client = new PrismaClient({ datasources: { db: { url: isolatedDatabaseUrl(schema) } } });

  try {
    await run(client, schema, backupSchema);
  } finally {
    await client.$disconnect();
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${backupSchema}" CASCADE`);
  }
}

afterAll(async () => {
  await adminPrisma.$disconnect();
});

describe('Lab 4 migration recovery', () => {
  it('rolls back a forced failure inside the real migration and retries cleanly', async () => {
    await withIsolatedSchema(async (client) => {
      await applyHistoricalMigrations(client);
      await insertLegacyData(client);
      const beforeCounts = await legacyCounts(client);
      const migrationSql = await readFile(lab4MigrationFile, 'utf8');
      const marker = 'CREATE UNIQUE INDEX "ActionTaken_fixtureKey_key"';
      const failingSql = migrationSql.replace(
        marker,
        `SELECT CAST('forced Lab 4 migration failure' AS INTEGER);\n\n${marker}`
      );
      expect(failingSql).not.toBe(migrationSql);

      await expect(applySql(client, failingSql)).rejects.toThrow();
      await client.$executeRawUnsafe('ROLLBACK');

      expect(await tableExists(client, 'ActionTaken')).toBe(false);
      expect(await columnExists(client, 'Ticket', 'resolutionCycle')).toBe(false);
      expect(await legacyCounts(client)).toEqual(beforeCounts);

      await applySqlFile(client, lab4MigrationFile);
      expect(await tableExists(client, 'ActionTaken')).toBe(true);
      expect(await legacyCounts(client)).toEqual(beforeCounts);
    });
  }, 30_000);

  it('rehearses backup restore after a committed failure and retries the migration', async () => {
    await withIsolatedSchema(async (client, schema, backupSchema) => {
      await applyHistoricalMigrations(client);
      await insertLegacyData(client);
      const beforeCounts = await legacyCounts(client);
      await snapshotLegacyData(client, backupSchema);

      const migrationSql = await readFile(lab4MigrationFile, 'utf8');
      const committedFailureSql = `${migrationSql}\nSELECT CAST('forced post-commit failure' AS INTEGER);`;
      await expect(applySql(client, committedFailureSql)).rejects.toThrow();
      expect(await tableExists(client, 'ActionTaken')).toBe(true);
      expect(await legacyCounts(client)).toEqual(beforeCounts);

      await restoreHistoricalSchema(client, schema, backupSchema);
      expect(await tableExists(client, 'ActionTaken')).toBe(false);
      expect(await legacyCounts(client)).toEqual(beforeCounts);

      await applySqlFile(client, lab4MigrationFile);
      expect(await tableExists(client, 'ActionTaken')).toBe(true);
      expect(await legacyCounts(client)).toEqual(beforeCounts);
    });
  }, 30_000);
});
