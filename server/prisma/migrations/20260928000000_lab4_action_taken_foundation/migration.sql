-- Add the Lab 4 Actions Taken foundation without rewriting Lab 1 to Lab 3 data.
BEGIN;

CREATE TYPE "ActionTakenStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Ticket"
  ADD COLUMN "resolutionCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD CONSTRAINT "Ticket_resolutionCycle_positive_check" CHECK ("resolutionCycle" > 0);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actionDateTime" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "status" "ActionTakenStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionCycle" INTEGER NOT NULL DEFAULT 1,
  "assigneeId" INTEGER,
  "createdById" INTEGER NOT NULL,
  "performedById" INTEGER NOT NULL,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "fixtureKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_description_check" CHECK (CHAR_LENGTH(BTRIM("description")) BETWEEN 1 AND 5000),
  CONSTRAINT "ActionTaken_result_check" CHECK (CHAR_LENGTH(BTRIM("result")) BETWEEN 1 AND 2000),
  CONSTRAINT "ActionTaken_followUp_check" CHECK (
    ("followUpRequired" = false AND "followUpNote" IS NULL)
    OR ("followUpRequired" = true AND "followUpNote" IS NOT NULL AND CHAR_LENGTH(BTRIM("followUpNote")) BETWEEN 1 AND 2000)
  ),
  CONSTRAINT "ActionTaken_attachmentNotes_check" CHECK (
    "attachmentNotes" IS NULL OR CHAR_LENGTH(BTRIM("attachmentNotes")) <= 2000
  ),
  CONSTRAINT "ActionTaken_lifecycle_timestamps_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "completedAt" IS NULL)
    OR ("status" IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER') AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  ),
  CONSTRAINT "ActionTaken_resolutionCycle_positive_check" CHECK ("resolutionCycle" > 0),
  CONSTRAINT "ActionTaken_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "ActionTaken_fixtureKey_key" ON "ActionTaken"("fixtureKey");
CREATE INDEX "ActionTaken_ticketId_actionDateTime_id_idx" ON "ActionTaken"("ticketId", "actionDateTime", "id");
CREATE INDEX "ActionTaken_ticketId_resolutionCycle_status_completedAt_idx"
  ON "ActionTaken"("ticketId", "resolutionCycle", "status", "completedAt");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_idx"
  ON "ActionTaken"("assigneeId", "status", "updatedAt");
CREATE INDEX "ActionTaken_performedById_actionDateTime_idx"
  ON "ActionTaken"("performedById", "actionDateTime");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
