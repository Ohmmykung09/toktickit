import { readFile } from 'node:fs/promises';
import { compare } from 'bcryptjs';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db.js';
import { seedDatabase, seedUsers } from '../../src/seed-data.js';

const testInitialPassword = 'Lab3TestPass!';
const configuredInitialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD ?? 'ChangeMe123!';
const migrationPath = new URL(
  '../../prisma/migrations/20260911000000_lab3_user_migration/migration.sql',
  import.meta.url
);

afterAll(async () => {
  await seedDatabase(prisma, configuredInitialPassword);
  await prisma.$disconnect();
});

describe('Lab 3 User migration and seed', () => {
  it('renames the legacy requester table and preserves valid ownership references', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('ALTER TABLE "DevelopmentRequester" RENAME TO "User"');
    expect(migration).not.toContain('DROP TABLE "DevelopmentRequester"');

    const [orphanedTickets, orphanedAttachmentRemovers] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Ticket" ticket
        LEFT JOIN "User" requester ON requester.id = ticket."requesterId"
        WHERE requester.id IS NULL
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Attachment" attachment
        LEFT JOIN "User" remover ON remover.id = attachment."removedByUserId"
        WHERE attachment."removedByUserId" IS NOT NULL AND remover.id IS NULL
      `
    ]);

    expect(orphanedTickets[0].count).toBe(0n);
    expect(orphanedAttachmentRemovers[0].count).toBe(0n);
  });

  it('seeds normalized role data repeatedly without duplicates or identity changes', async () => {
    await seedDatabase(prisma, testInitialPassword);
    const firstRun = await prisma.user.findMany({
      where: { email: { in: seedUsers.map((user) => user.email) } },
      orderBy: { email: 'asc' }
    });

    await seedDatabase(prisma, testInitialPassword);
    const secondRun = await prisma.user.findMany({
      where: { email: { in: seedUsers.map((user) => user.email) } },
      orderBy: { email: 'asc' }
    });

    expect(secondRun.map(({ id, email }) => ({ id, email }))).toEqual(
      firstRun.map(({ id, email }) => ({ id, email }))
    );
    expect(secondRun).toHaveLength(seedUsers.length);
    expect(secondRun.every((user) => user.email === user.email.toLowerCase())).toBe(true);
    expect(secondRun.every((user) => user.passwordHash !== testInitialPassword)).toBe(true);
    expect(await compare(testInitialPassword, secondRun[0].passwordHash)).toBe(true);

    expect(secondRun.filter((user) => user.role === 'REQUESTER' && user.isActive)).toHaveLength(4);
    expect(secondRun.filter((user) => user.role === 'IT_STAFF' && user.isActive)).toHaveLength(3);
    expect(secondRun.filter((user) => user.role === 'ADMINISTRATOR' && user.isActive)).toHaveLength(1);
    expect(secondRun.filter((user) => !user.isActive)).toHaveLength(2);
    expect(secondRun.every((user) => user.mustChangePassword)).toBe(true);
  });
});
