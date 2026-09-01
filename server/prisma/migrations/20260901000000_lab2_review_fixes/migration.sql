-- Replace global idempotency uniqueness with requester-scoped uniqueness.
DROP INDEX "Ticket_idempotencyKey_key";
CREATE UNIQUE INDEX "Ticket_requesterId_idempotencyKey_key" ON "Ticket"("requesterId", "idempotencyKey");

-- Preserve the requester's reason when an attachment is soft-removed.
ALTER TABLE "Attachment" ADD COLUMN "removalReason" TEXT;
