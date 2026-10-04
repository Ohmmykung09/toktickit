ALTER TABLE "Session"
ADD COLUMN "sessionVersion" INTEGER;

UPDATE "Session" AS session
SET "sessionVersion" = user_account."sessionVersion"
FROM "User" AS user_account
WHERE session."userId" = user_account."id";

ALTER TABLE "Session"
ALTER COLUMN "sessionVersion" SET NOT NULL;
