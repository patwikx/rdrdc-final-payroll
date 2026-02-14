BEGIN;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "selectedStepTwoApproverUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MaterialRequest_selectedStepTwoApproverUserId_idx"
  ON "MaterialRequest"("selectedStepTwoApproverUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequest_selectedStepTwoApproverUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_selectedStepTwoApproverUserId_fkey"
      FOREIGN KEY ("selectedStepTwoApproverUserId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
