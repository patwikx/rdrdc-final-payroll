-- Add company-level toggle and user flag for new Purchase Request -> Purchase Order workflow.
ALTER TABLE "Company"
ADD COLUMN "enablePurchaseRequestWorkflow" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UserCompanyAccess"
ADD COLUMN "isPurchaseRequestItemManager" BOOLEAN NOT NULL DEFAULT false;

-- Enums for new procurement flow.
CREATE TYPE "PurchaseRequestStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "PurchaseRequestItemSource" AS ENUM (
  'MANUAL',
  'CATALOG'
);

CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'CLOSED',
  'CANCELLED'
);

CREATE TABLE "ProcurementItemCategory" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,

  CONSTRAINT "ProcurementItemCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcurementItem" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "uom" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,

  CONSTRAINT "ProcurementItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "requesterEmployeeId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "datePrepared" DATE NOT NULL,
  "dateRequired" DATE NOT NULL,
  "purpose" TEXT,
  "remarks" TEXT,
  "deliverTo" TEXT,
  "isStoreUse" BOOLEAN NOT NULL DEFAULT false,
  "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "finalDecisionByUserId" TEXT,
  "finalDecisionRemarks" TEXT,
  "cancellationReason" TEXT,
  "cancelledByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseRequestItem" (
  "id" TEXT NOT NULL,
  "purchaseRequestId" TEXT NOT NULL,
  "procurementItemId" TEXT,
  "lineNumber" INTEGER NOT NULL,
  "source" "PurchaseRequestItemSource" NOT NULL DEFAULT 'MANUAL',
  "itemCode" TEXT,
  "description" TEXT NOT NULL,
  "uom" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(12,2),
  "lineTotal" DECIMAL(14,2),
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sourcePurchaseRequestId" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "supplierName" TEXT NOT NULL,
  "remarks" TEXT,
  "purchaseOrderDate" DATE NOT NULL,
  "expectedDeliveryDate" DATE,
  "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "sourcePurchaseRequestItemId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "itemCode" TEXT,
  "description" TEXT NOT NULL,
  "uom" TEXT NOT NULL,
  "quantityOrdered" DECIMAL(12,3) NOT NULL,
  "quantityReceived" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcurementItemCategory_code_key" ON "ProcurementItemCategory"("code");
CREATE UNIQUE INDEX "ProcurementItemCategory_name_key" ON "ProcurementItemCategory"("name");
CREATE INDEX "ProcurementItemCategory_isActive_idx" ON "ProcurementItemCategory"("isActive");

CREATE UNIQUE INDEX "ProcurementItem_code_key" ON "ProcurementItem"("code");
CREATE INDEX "ProcurementItem_categoryId_isActive_idx" ON "ProcurementItem"("categoryId", "isActive");

CREATE UNIQUE INDEX "PurchaseRequest_companyId_requestNumber_key" ON "PurchaseRequest"("companyId", "requestNumber");
CREATE INDEX "PurchaseRequest_companyId_status_idx" ON "PurchaseRequest"("companyId", "status");
CREATE INDEX "PurchaseRequest_departmentId_idx" ON "PurchaseRequest"("departmentId");
CREATE INDEX "PurchaseRequest_requesterEmployeeId_idx" ON "PurchaseRequest"("requesterEmployeeId");
CREATE INDEX "PurchaseRequest_finalDecisionByUserId_idx" ON "PurchaseRequest"("finalDecisionByUserId");
CREATE INDEX "PurchaseRequest_cancelledByUserId_idx" ON "PurchaseRequest"("cancelledByUserId");
CREATE INDEX "PurchaseRequest_submittedAt_idx" ON "PurchaseRequest"("submittedAt");

CREATE UNIQUE INDEX "PurchaseRequestItem_purchaseRequestId_lineNumber_key" ON "PurchaseRequestItem"("purchaseRequestId", "lineNumber");
CREATE UNIQUE INDEX "PurchaseRequestItem_purchaseRequestId_itemCode_key" ON "PurchaseRequestItem"("purchaseRequestId", "itemCode");
CREATE INDEX "PurchaseRequestItem_purchaseRequestId_idx" ON "PurchaseRequestItem"("purchaseRequestId");
CREATE INDEX "PurchaseRequestItem_procurementItemId_idx" ON "PurchaseRequestItem"("procurementItemId");

CREATE UNIQUE INDEX "PurchaseOrder_companyId_poNumber_key" ON "PurchaseOrder"("companyId", "poNumber");
CREATE INDEX "PurchaseOrder_companyId_status_idx" ON "PurchaseOrder"("companyId", "status");
CREATE INDEX "PurchaseOrder_sourcePurchaseRequestId_idx" ON "PurchaseOrder"("sourcePurchaseRequestId");
CREATE INDEX "PurchaseOrder_createdByUserId_idx" ON "PurchaseOrder"("createdByUserId");

CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_lineNumber_key" ON "PurchaseOrderLine"("purchaseOrderId", "lineNumber");
CREATE UNIQUE INDEX "PurchaseOrderLine_purchaseOrderId_sourcePurchaseRequestItemId_key" ON "PurchaseOrderLine"("purchaseOrderId", "sourcePurchaseRequestItemId");
CREATE INDEX "PurchaseOrderLine_sourcePurchaseRequestItemId_idx" ON "PurchaseOrderLine"("sourcePurchaseRequestItemId");

ALTER TABLE "ProcurementItemCategory" ADD CONSTRAINT "ProcurementItemCategory_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementItemCategory" ADD CONSTRAINT "ProcurementItemCategory_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ProcurementItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterEmployeeId_fkey"
FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_finalDecisionByUserId_fkey"
FOREIGN KEY ("finalDecisionByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_cancelledByUserId_fkey"
FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey"
FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_procurementItemId_fkey"
FOREIGN KEY ("procurementItemId") REFERENCES "ProcurementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sourcePurchaseRequestId_fkey"
FOREIGN KEY ("sourcePurchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_sourcePurchaseRequestItemId_fkey"
FOREIGN KEY ("sourcePurchaseRequestItemId") REFERENCES "PurchaseRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
