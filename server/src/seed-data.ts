import { hash } from 'bcryptjs';
import type { PrismaClient, UserRole } from '@prisma/client';

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

export async function seedDatabase(prisma: PrismaClient, initialPassword: string) {
  if (initialPassword.length < 12 || initialPassword.length > 72) {
    throw new Error('LAB3_SEED_INITIAL_PASSWORD must contain 12 to 72 characters.');
  }

  const passwordHash = await hash(initialPassword, 12);

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

  for (const user of seedUsers) {
    const email = user.email.trim().toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        failedLoginWindowStartedAt: null,
        lockedUntil: null
      },
      create: {
        ...user,
        email,
        passwordHash,
        mustChangePassword: true
      }
    });
  }

  return {
    categories: categoryNames.length,
    relatedSystems: relatedSystemNames.length,
    users: seedUsers.length
  };
}
