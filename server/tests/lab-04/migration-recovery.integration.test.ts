import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma as adminPrisma } from '../../src/db.js';

function isolatedDatabaseUrl(schema: string) {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) throw new Error('DATABASE_URL is required for migration recovery tests.');
  const url = new URL(configuredUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

async function withIsolatedSchema(run: (client: PrismaClient) => Promise<void>) {
  const schema = 'lab4_recovery_' + randomUUID().replaceAll('-', '');
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

describe('Lab 4 migration recovery', () => {
  it('rolls back a forced mid-migration failure without leaving partial schema changes', async () => {
    await withIsolatedSchema(async (client) => {
      await client.$executeRawUnsafe(
        'CREATE TABLE "LegacyProbe" ("id" SERIAL PRIMARY KEY, "value" TEXT NOT NULL)'
      );
      await client.$executeRawUnsafe(
        'INSERT INTO "LegacyProbe" ("value") VALUES (\'preserve during rollback\')'
      );

      await expect(
        client.$transaction(async (transaction) => {
          await transaction.$executeRawUnsafe(
            'CREATE TABLE "ActionTakenRollbackProbe" ("id" SERIAL PRIMARY KEY)'
          );
          await transaction.$executeRawUnsafe(
            'ALTER TABLE "LegacyProbe" ADD COLUMN "temporaryLab4Column" TEXT'
          );
          throw new Error('forced Lab 4 migration failure');
        })
      ).rejects.toThrow('forced Lab 4 migration failure');

      const partialTable = await client.$queryRawUnsafe<Array<{ table_name: string }>>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'ActionTakenRollbackProbe'"
      );
      const partialColumn = await client.$queryRawUnsafe<Array<{ column_name: string }>>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'LegacyProbe' AND column_name = 'temporaryLab4Column'"
      );
      const preservedRows = await client.$queryRawUnsafe<Array<{ value: string }>>(
        'SELECT "value" FROM "LegacyProbe"'
      );

      expect(partialTable).toEqual([]);
      expect(partialColumn).toEqual([]);
      expect(preservedRows).toEqual([{ value: 'preserve during rollback' }]);
    });
  });
});
