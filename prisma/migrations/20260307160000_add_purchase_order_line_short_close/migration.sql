ALTER TABLE "PurchaseOrderLine"
ADD COLUMN "isShortClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shortClosedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN "shortClosedReason" TEXT,
ADD COLUMN "shortClosedAt" TIMESTAMP(3),
ADD COLUMN "shortClosedByUserId" TEXT;

CREATE INDEX "PurchaseOrderLine_shortClosedByUserId_idx"
ON "PurchaseOrderLine"("shortClosedByUserId");

ALTER TABLE "PurchaseOrderLine"
ADD CONSTRAINT "PurchaseOrderLine_shortClosedByUserId_fkey"
FOREIGN KEY ("shortClosedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
