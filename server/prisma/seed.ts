import '../src/env.js';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/seed-data.js';

const prisma = new PrismaClient();

async function main() {
  const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD ?? 'ChangeMe123!';
  const result = await seedDatabase(prisma, initialPassword);
  console.log(`Seeded ${result.categories} categories, ${result.relatedSystems} related systems, and ${result.users} users.`);
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
