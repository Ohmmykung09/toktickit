import { prisma } from './db.js';

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log('PostgreSQL connection check passed.');
}

main()
  .catch((error: unknown) => {
    console.error('PostgreSQL connection check failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
