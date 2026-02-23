BEGIN;

ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "requesterAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requesterAcknowledgedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MaterialRequest_requesterAcknowledgedByUserId_idx"
  ON "MaterialRequest"("requesterAcknowledgedByUserId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_requesterAcknowledgedAt_idx"
  ON "MaterialRequest"("requesterAcknowledgedAt");
CREATE INDEX IF NOT EXISTS "MaterialRequest_companyId_status_processingStatus_requesterAcknowledgedAt_idx"
  ON "MaterialRequest"("companyId", "status", "processingStatus", "requesterAcknowledgedAt");

CREATE TABLE IF NOT EXISTS "MaterialRequestReceivingReport" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "materialRequestId" TEXT NOT NULL,
  "reportNumber" TEXT NOT NULL,
  "remarks" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaterialRequestReceivingReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialRequestReceivingReportItem" (
  "id" TEXT NOT NULL,
  "receivingReportId" TEXT NOT NULL,
  "materialRequestItemId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "itemCode" TEXT,
  "description" TEXT NOT NULL,
  "uom" TEXT NOT NULL,
  "requestedQuantity" DECIMAL(12,3) NOT NULL,
  "receivedQuantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(12,2),
  "lineTotal" DECIMAL(14,2),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaterialRequestReceivingReportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequestReceivingReport_materialRequestId_key"
  ON "MaterialRequestReceivingReport"("materialRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequestReceivingReport_companyId_reportNumber_key"
  ON "MaterialRequestReceivingReport"("companyId", "reportNumber");
CREATE INDEX IF NOT EXISTS "MaterialRequestReceivingReport_companyId_receivedAt_idx"
  ON "MaterialRequestReceivingReport"("companyId", "receivedAt");
CREATE INDEX IF NOT EXISTS "MaterialRequestReceivingReport_materialRequestId_receivedAt_idx"
  ON "MaterialRequestReceivingReport"("materialRequestId", "receivedAt");
CREATE INDEX IF NOT EXISTS "MaterialRequestReceivingReport_receivedByUserId_idx"
  ON "MaterialRequestReceivingReport"("receivedByUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequestReceivingReportItem_receivingReportId_materialRequestItemId_key"
  ON "MaterialRequestReceivingReportItem"("receivingReportId", "materialRequestItemId");
CREATE INDEX IF NOT EXISTS "MaterialRequestReceivingReportItem_receivingReportId_lineNumber_idx"
  ON "MaterialRequestReceivingReportItem"("receivingReportId", "lineNumber");
CREATE INDEX IF NOT EXISTS "MaterialRequestReceivingReportItem_materialRequestItemId_idx"
  ON "MaterialRequestReceivingReportItem"("materialRequestItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequest_requesterAcknowledgedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequest"
      ADD CONSTRAINT "MaterialRequest_requesterAcknowledgedByUserId_fkey"
      FOREIGN KEY ("requesterAcknowledgedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestReceivingReport_companyId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestReceivingReport"
      ADD CONSTRAINT "MaterialRequestReceivingReport_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestReceivingReport_materialRequestId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestReceivingReport"
      ADD CONSTRAINT "MaterialRequestReceivingReport_materialRequestId_fkey"
      FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestReceivingReport_receivedByUserId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestReceivingReport"
      ADD CONSTRAINT "MaterialRequestReceivingReport_receivedByUserId_fkey"
      FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestReceivingReportItem_receivingReportId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestReceivingReportItem"
      ADD CONSTRAINT "MaterialRequestReceivingReportItem_receivingReportId_fkey"
      FOREIGN KEY ("receivingReportId") REFERENCES "MaterialRequestReceivingReport"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaterialRequestReceivingReportItem_materialRequestItemId_fkey'
  ) THEN
    ALTER TABLE "MaterialRequestReceivingReportItem"
      ADD CONSTRAINT "MaterialRequestReceivingReportItem_materialRequestItemId_fkey"
      FOREIGN KEY ("materialRequestItemId") REFERENCES "MaterialRequestItem"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
