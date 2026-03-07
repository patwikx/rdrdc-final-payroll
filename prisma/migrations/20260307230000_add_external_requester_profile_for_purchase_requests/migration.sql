-- Support non-employee requester accounts (agency/third-party) for Purchase Requests.

CREATE TABLE IF NOT EXISTS "ExternalRequesterProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requesterCode" TEXT NOT NULL,
  "agencyName" TEXT,
  "branchId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalRequesterProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalRequesterProfile_companyId_userId_key"
ON "ExternalRequesterProfile"("companyId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalRequesterProfile_companyId_requesterCode_key"
ON "ExternalRequesterProfile"("companyId", "requesterCode");

CREATE INDEX IF NOT EXISTS "ExternalRequesterProfile_companyId_isActive_idx"
ON "ExternalRequesterProfile"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "ExternalRequesterProfile_userId_idx"
ON "ExternalRequesterProfile"("userId");

CREATE INDEX IF NOT EXISTS "ExternalRequesterProfile_branchId_idx"
ON "ExternalRequesterProfile"("branchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExternalRequesterProfile_companyId_fkey'
  ) THEN
    ALTER TABLE "ExternalRequesterProfile"
    ADD CONSTRAINT "ExternalRequesterProfile_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExternalRequesterProfile_userId_fkey'
  ) THEN
    ALTER TABLE "ExternalRequesterProfile"
    ADD CONSTRAINT "ExternalRequesterProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExternalRequesterProfile_branchId_fkey'
  ) THEN
    ALTER TABLE "ExternalRequesterProfile"
    ADD CONSTRAINT "ExternalRequesterProfile_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "PurchaseRequest"
ALTER COLUMN "requesterEmployeeId" DROP NOT NULL;

ALTER TABLE "PurchaseRequest"
ADD COLUMN IF NOT EXISTS "requesterExternalProfileId" TEXT;

CREATE INDEX IF NOT EXISTS "PurchaseRequest_requesterExternalProfileId_idx"
ON "PurchaseRequest"("requesterExternalProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PurchaseRequest_requesterExternalProfileId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_requesterExternalProfileId_fkey"
    FOREIGN KEY ("requesterExternalProfileId") REFERENCES "ExternalRequesterProfile"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
