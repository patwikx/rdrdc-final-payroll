-- Add serving batch models for material request processing (replaces per-request PO/supplier columns).
CREATE TABLE "MaterialRequestServeBatch" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "notes" TEXT,
    "isFinalServe" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestServeBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequestServeBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "materialRequestItemId" TEXT NOT NULL,
    "quantityServed" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestServeBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialRequestServeBatchItem_batchId_materialRequestItemId_key"
  ON "MaterialRequestServeBatchItem"("batchId", "materialRequestItemId");
CREATE INDEX "MaterialRequestServeBatch_materialRequestId_servedAt_idx"
  ON "MaterialRequestServeBatch"("materialRequestId", "servedAt");
CREATE INDEX "MaterialRequestServeBatch_servedByUserId_idx"
  ON "MaterialRequestServeBatch"("servedByUserId");
CREATE INDEX "MaterialRequestServeBatchItem_materialRequestItemId_idx"
  ON "MaterialRequestServeBatchItem"("materialRequestItemId");

ALTER TABLE "MaterialRequestServeBatch"
  ADD CONSTRAINT "MaterialRequestServeBatch_materialRequestId_fkey"
  FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestServeBatch"
  ADD CONSTRAINT "MaterialRequestServeBatch_servedByUserId_fkey"
  FOREIGN KEY ("servedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestServeBatchItem"
  ADD CONSTRAINT "MaterialRequestServeBatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "MaterialRequestServeBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestServeBatchItem"
  ADD CONSTRAINT "MaterialRequestServeBatchItem_materialRequestItemId_fkey"
  FOREIGN KEY ("materialRequestItemId") REFERENCES "MaterialRequestItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
