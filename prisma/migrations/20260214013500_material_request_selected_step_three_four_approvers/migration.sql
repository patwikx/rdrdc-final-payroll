BEGIN;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "selectedStepThreeApproverUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "selectedStepFourApproverUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MaterialRequest_selectedStepThreeApproverUserId_idx"
  ON "MaterialRequest"("selectedStepThreeApproverUserId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_selectedStepFourApproverUserId_idx"
  ON "MaterialRequest"("selectedStepFourApproverUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequest_selectedStepThreeApproverUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_selectedStepThreeApproverUserId_fkey"
      FOREIGN KEY ("selectedStepThreeApproverUserId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequest_selectedStepFourApproverUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_selectedStepFourApproverUserId_fkey"
      FOREIGN KEY ("selectedStepFourApproverUserId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
