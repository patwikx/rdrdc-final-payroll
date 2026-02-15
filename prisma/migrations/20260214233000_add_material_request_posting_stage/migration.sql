DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialRequestPostingStatus') THEN
    CREATE TYPE "MaterialRequestPostingStatus" AS ENUM ('PENDING_POSTING', 'POSTED');
  END IF;
END $$;

ALTER TABLE "UserCompanyAccess"
  ADD COLUMN IF NOT EXISTS "isMaterialRequestPoster" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "postingStatus" "MaterialRequestPostingStatus",
  ADD COLUMN IF NOT EXISTS "postingReference" TEXT,
  ADD COLUMN IF NOT EXISTS "postingRemarks" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postedByUserId" TEXT;

CREATE TABLE IF NOT EXISTS "MaterialRequestPosting" (
  "id" TEXT NOT NULL,
  "materialRequestId" TEXT NOT NULL,
  "postingReference" TEXT NOT NULL,
  "remarks" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaterialRequestPosting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MaterialRequest_postedByUserId_idx"
  ON "MaterialRequest"("postedByUserId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_postingStatus_idx"
  ON "MaterialRequest"("postingStatus");
CREATE INDEX IF NOT EXISTS "MaterialRequest_companyId_status_postingStatus_idx"
  ON "MaterialRequest"("companyId", "status", "postingStatus");
CREATE INDEX IF NOT EXISTS "MaterialRequestPosting_materialRequestId_postedAt_idx"
  ON "MaterialRequestPosting"("materialRequestId", "postedAt");
CREATE INDEX IF NOT EXISTS "MaterialRequestPosting_postedByUserId_idx"
  ON "MaterialRequestPosting"("postedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequest_postedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_postedByUserId_fkey"
      FOREIGN KEY ("postedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestPosting_materialRequestId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestPosting"
      ADD CONSTRAINT "MaterialRequestPosting_materialRequestId_fkey"
      FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestPosting_postedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestPosting"
      ADD CONSTRAINT "MaterialRequestPosting_postedByUserId_fkey"
      FOREIGN KEY ("postedByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "MaterialRequest"
SET "postingStatus" = 'PENDING_POSTING'
WHERE "status" = 'APPROVED'
  AND "processingStatus" = 'COMPLETED'
  AND "postingStatus" IS NULL;
