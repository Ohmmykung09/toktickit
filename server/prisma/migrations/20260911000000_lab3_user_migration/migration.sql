-- Replace the temporary Lab 2 requester identity with an authenticated User
-- while preserving primary keys and every existing ownership reference.
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
  ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '$2b$12$6wrSs5CI6yZXNJ219gxrj.NRn9djzUdl/C9KIismHnbaiiirB/1Jy',
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginWindowStartedAt" TIMESTAMP(3),
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;
ALTER TABLE "Attachment" RENAME COLUMN "removedByRequesterId" TO "removedByUserId";

CREATE UNIQUE INDEX "User_email_normalized_key" ON "User" (LOWER("email"));
CREATE INDEX "User_isActive_role_name_idx" ON "User"("isActive", "role", "name");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_removedByUserId_fkey"
  FOREIGN KEY ("removedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
