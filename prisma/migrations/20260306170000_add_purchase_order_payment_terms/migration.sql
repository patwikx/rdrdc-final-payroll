ALTER TABLE "PurchaseOrder"
ADD COLUMN "paymentTerms" TEXT;

UPDATE "PurchaseOrder"
SET "paymentTerms" = 'COD'
WHERE "paymentTerms" IS NULL;

ALTER TABLE "PurchaseOrder"
ALTER COLUMN "paymentTerms" SET DEFAULT 'COD';

ALTER TABLE "PurchaseOrder"
ALTER COLUMN "paymentTerms" SET NOT NULL;
