import '../src/env.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categoryNames = [
  'Account and Access',
  'Hardware',
  'Software',
  'Network'
];

const relatedSystemNames = [
  'Campus Wi-Fi',
  'Corporate Laptop',
  'Email',
  'Grade Submission App',
  'LEB2 App',
  'Printer',
  'VPN'
];

const requesters = [
  { name: 'Aom S.', email: 'aom@example.test', isActive: true },
  { name: 'Beam K.', email: 'beam@example.test', isActive: true },
  { name: 'Mew P.', email: 'mew@example.test', isActive: true },
  { name: 'Nok T.', email: 'nok@example.test', isActive: true },
  { name: 'Retired Requester', email: 'inactive@example.test', isActive: false }
];

async function main() {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true }
    });
  }

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true }
    });
  }

  for (const requester of requesters) {
    await prisma.developmentRequester.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester
    });
  }

  console.log(`Seeded ${categoryNames.length} categories, ${relatedSystemNames.length} related systems, and ${requesters.length} development requesters.`);
}

main()
  .catch((error: unknown) => {
    console.error('Category seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
