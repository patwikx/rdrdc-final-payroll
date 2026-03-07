CREATE TABLE "PurchaseOrderGoodsReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "grpoNumber" TEXT NOT NULL,
  "receivedAt" DATE NOT NULL,
  "remarks" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "receivedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderGoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderGoodsReceiptLine" (
  "id" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "itemCode" TEXT,
  "description" TEXT NOT NULL,
  "uom" TEXT NOT NULL,
  "quantityOrdered" DECIMAL(12,3) NOT NULL,
  "previouslyReceivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "receivedQuantity" DECIMAL(12,3) NOT NULL,
  "remainingQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderGoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrderGoodsReceipt_companyId_grpoNumber_key"
ON "PurchaseOrderGoodsReceipt"("companyId", "grpoNumber");

CREATE INDEX "PurchaseOrderGoodsReceipt_purchaseOrderId_receivedAt_idx"
ON "PurchaseOrderGoodsReceipt"("purchaseOrderId", "receivedAt");

CREATE INDEX "PurchaseOrderGoodsReceipt_receivedByUserId_idx"
ON "PurchaseOrderGoodsReceipt"("receivedByUserId");

CREATE UNIQUE INDEX "PurchaseOrderGoodsReceiptLine_goodsReceiptId_lineNumber_key"
ON "PurchaseOrderGoodsReceiptLine"("goodsReceiptId", "lineNumber");

CREATE INDEX "PurchaseOrderGoodsReceiptLine_purchaseOrderLineId_idx"
ON "PurchaseOrderGoodsReceiptLine"("purchaseOrderLineId");

ALTER TABLE "PurchaseOrderGoodsReceipt"
ADD CONSTRAINT "PurchaseOrderGoodsReceipt_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderGoodsReceipt"
ADD CONSTRAINT "PurchaseOrderGoodsReceipt_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderGoodsReceipt"
ADD CONSTRAINT "PurchaseOrderGoodsReceipt_receivedByUserId_fkey"
FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderGoodsReceiptLine"
ADD CONSTRAINT "PurchaseOrderGoodsReceiptLine_goodsReceiptId_fkey"
FOREIGN KEY ("goodsReceiptId") REFERENCES "PurchaseOrderGoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderGoodsReceiptLine"
ADD CONSTRAINT "PurchaseOrderGoodsReceiptLine_purchaseOrderLineId_fkey"
FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
