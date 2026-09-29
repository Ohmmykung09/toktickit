-- Add requester-safe retry identity for Action Taken creation.
BEGIN;

ALTER TABLE "ActionTaken"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "ActionTaken_ticketId_idempotencyKey_key"
  ON "ActionTaken"("ticketId", "idempotencyKey");

COMMIT;
