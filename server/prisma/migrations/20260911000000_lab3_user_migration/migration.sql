-- Evolve the temporary Lab 2 requester identity into the complete Lab 3 data
-- foundation while preserving primary keys and ownership references.
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_removedByRequesterId_fkey";

ALTER TABLE "DevelopmentRequester" RENAME TO "User";
ALTER SEQUENCE "DevelopmentRequester_id_seq" RENAME TO "User_id_seq";
ALTER TABLE "User" RENAME CONSTRAINT "DevelopmentRequester_pkey" TO "User_pkey";
ALTER INDEX "DevelopmentRequester_email_key" RENAME TO "User_email_key";
DROP INDEX "DevelopmentRequester_isActive_name_idx";

UPDATE "User" SET "email" = LOWER(TRIM("email"));

ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordProvisionedAt" TIMESTAMP(3),
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginWindowStartedAt" TIMESTAMP(3),
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT "User_email_canonical_check" CHECK ("email" = LOWER(TRIM("email"))),
  ADD CONSTRAINT "User_password_hash_policy_check" CHECK ("passwordHash" IS NULL OR "passwordHash" LIKE '$argon2id$%'),
  ADD CONSTRAINT "User_password_provisioning_check" CHECK (
    ("passwordHash" IS NULL AND "passwordProvisionedAt" IS NULL)
    OR ("passwordHash" IS NOT NULL AND "passwordProvisionedAt" IS NOT NULL)
  );

ALTER TABLE "Attachment" RENAME COLUMN "removedByRequesterId" TO "removedByUserId";

ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "Ticket"
  ADD COLUMN "ownerId" INTEGER,
  ADD COLUMN "itPriority" "RequestedPriority",
  ADD COLUMN "requesterResolutionIndicatedAt" TIMESTAMP(3),
  ADD COLUMN "requesterResolutionIndicatedById" INTEGER,
  ADD CONSTRAINT "Ticket_requester_resolution_check" CHECK (
    ("requesterResolutionIndicatedAt" IS NULL AND "requesterResolutionIndicatedById" IS NULL)
    OR ("requesterResolutionIndicatedAt" IS NOT NULL AND "requesterResolutionIndicatedById" IS NOT NULL)
  );

UPDATE "Ticket" SET "itPriority" = "requestedPriority";
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;

CREATE TABLE "Session" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "csrfTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicComment" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicComment_content_check" CHECK (CHAR_LENGTH(BTRIM("content")) BETWEEN 1 AND 2000)
);

CREATE TABLE "InternalNote" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalNote_content_check" CHECK (CHAR_LENGTH(BTRIM("content")) BETWEEN 1 AND 2000)
);

CREATE INDEX "User_isActive_role_name_idx" ON "User"("isActive", "role", "name");
CREATE INDEX "Ticket_ownerId_status_updatedAt_idx" ON "Ticket"("ownerId", "status", "updatedAt");
CREATE INDEX "Ticket_status_itPriority_updatedAt_idx" ON "Ticket"("status", "itPriority", "updatedAt");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx" ON "PublicComment"("ticketId", "createdAt", "id");
CREATE INDEX "InternalNote_ticketId_createdAt_id_idx" ON "InternalNote"("ticketId", "createdAt", "id");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterResolutionIndicatedById_fkey"
  FOREIGN KEY ("requesterResolutionIndicatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_removedByUserId_fkey"
  FOREIGN KEY ("removedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote"
  ADD CONSTRAINT "InternalNote_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalNote"
  ADD CONSTRAINT "InternalNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
