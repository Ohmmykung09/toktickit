-- Align the database migration with Prisma's @updatedAt application-managed timestamp.
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
