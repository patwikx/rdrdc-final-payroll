BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'MaterialRequestProcessingStatus'
  ) THEN
    CREATE TYPE "MaterialRequestProcessingStatus" AS ENUM (
      'PENDING_PURCHASER',
      'IN_PROGRESS',
      'COMPLETED'
    );
  END IF;
END $$;

ALTER TABLE "UserCompanyAccess"
  ADD COLUMN IF NOT EXISTS "isMaterialRequestPurchaser" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "processingStatus" "MaterialRequestProcessingStatus",
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "processedByUserId" TEXT;

UPDATE "MaterialRequest"
SET "processingStatus" = 'PENDING_PURCHASER'
WHERE "status" = 'APPROVED'
  AND "processingStatus" IS NULL;

CREATE INDEX IF NOT EXISTS "MaterialRequest_processedByUserId_idx"
  ON "MaterialRequest"("processedByUserId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_processingStatus_idx"
  ON "MaterialRequest"("processingStatus");
CREATE INDEX IF NOT EXISTS "MaterialRequest_companyId_status_processingStatus_idx"
  ON "MaterialRequest"("companyId", "status", "processingStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequest_processedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_processedByUserId_fkey"
      FOREIGN KEY ("processedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
