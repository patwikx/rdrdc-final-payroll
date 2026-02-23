BEGIN;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "requiresReceiptAcknowledgment" BOOLEAN NOT NULL DEFAULT false;

-- Legacy rows should remain outside the new acknowledgment requirement.
UPDATE "MaterialRequest"
SET "requiresReceiptAcknowledgment" = false
WHERE "createdAt" < NOW();

-- New requests will require requester acknowledgment by default.
ALTER TABLE "MaterialRequest"
  ALTER COLUMN "requiresReceiptAcknowledgment" SET DEFAULT true;

CREATE INDEX IF NOT EXISTS "MaterialRequest_requiresReceiptAcknowledgment_idx"
  ON "MaterialRequest"("requiresReceiptAcknowledgment");

COMMIT;
