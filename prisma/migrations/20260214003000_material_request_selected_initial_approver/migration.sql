BEGIN;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "selectedInitialApproverUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MaterialRequest_selectedInitialApproverUserId_idx"
  ON "MaterialRequest"("selectedInitialApproverUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequest_selectedInitialApproverUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_selectedInitialApproverUserId_fkey"
      FOREIGN KEY ("selectedInitialApproverUserId") REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
