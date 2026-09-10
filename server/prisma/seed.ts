import '../src/env.js';
import { PrismaClient } from '@prisma/client';
import { requireConfiguredInitialPassword, seedDatabase } from '../src/seed-data.js';

const prisma = new PrismaClient();

async function main() {
  const initialPassword = requireConfiguredInitialPassword(process.env.LAB3_SEED_INITIAL_PASSWORD);
  const result = await seedDatabase(prisma, initialPassword);
  console.log(
    `Seeded ${result.categories} categories, ${result.relatedSystems} related systems, ` +
      `${result.users} users, and ${result.tickets} tickets. Provisioned ${result.provisionedUsers} users.`
  );
}

main()
  .catch((error: unknown) => {
    console.error('TokTickIT seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
