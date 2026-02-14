BEGIN;

CREATE TYPE "MaterialRequestSeries" AS ENUM ('PO', 'JO', 'OTHERS');
CREATE TYPE "MaterialRequestType" AS ENUM ('ITEM', 'SERVICE');
CREATE TYPE "MaterialRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "MaterialRequestStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
CREATE TYPE "MaterialRequestItemSource" AS ENUM ('MANUAL', 'CATALOG');

CREATE TABLE "DepartmentMaterialRequestApprovalFlow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "requiredSteps" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "DepartmentMaterialRequestApprovalFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentMaterialRequestApprovalFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentMaterialRequestApprovalFlowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "series" "MaterialRequestSeries" NOT NULL,
    "requestType" "MaterialRequestType" NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requesterEmployeeId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "datePrepared" DATE NOT NULL,
    "dateRequired" DATE NOT NULL,
    "chargeTo" TEXT,
    "bldgCode" TEXT,
    "purpose" TEXT,
    "remarks" TEXT,
    "deliverTo" TEXT,
    "isStoreUse" BOOLEAN NOT NULL DEFAULT false,
    "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "requiredSteps" INTEGER NOT NULL,
    "currentStep" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "finalDecisionByUserId" TEXT,
    "finalDecisionRemarks" TEXT,
    "cancellationReason" TEXT,
    "cancelledByUserId" TEXT,
    "legacySourceSystem" TEXT,
    "legacyRecordId" TEXT,
    "legacyBusinessUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequestApprovalStep" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "status" "MaterialRequestStepStatus" NOT NULL DEFAULT 'PENDING',
    "actedAt" TIMESTAMP(3),
    "actedByUserId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequestItem" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "source" "MaterialRequestItemSource" NOT NULL DEFAULT 'MANUAL',
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "lineTotal" DECIMAL(14,2),
    "remarks" TEXT,
    "legacyItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentMaterialRequestApprovalFlow_departmentId_key" ON "DepartmentMaterialRequestApprovalFlow"("departmentId");
CREATE INDEX "DepartmentMaterialRequestApprovalFlow_companyId_idx" ON "DepartmentMaterialRequestApprovalFlow"("companyId");
CREATE INDEX "DepartmentMaterialRequestApprovalFlow_isActive_idx" ON "DepartmentMaterialRequestApprovalFlow"("isActive");

CREATE UNIQUE INDEX "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_key" ON "DepartmentMaterialRequestApprovalFlowStep"("flowId", "stepNumber");
CREATE UNIQUE INDEX "DepartmentMaterialRequestApprovalFlowStep_flowId_approverUserId_key" ON "DepartmentMaterialRequestApprovalFlowStep"("flowId", "approverUserId");
CREATE INDEX "DepartmentMaterialRequestApprovalFlowStep_approverUserId_idx" ON "DepartmentMaterialRequestApprovalFlowStep"("approverUserId");

CREATE UNIQUE INDEX "MaterialRequest_companyId_requestNumber_key" ON "MaterialRequest"("companyId", "requestNumber");
CREATE UNIQUE INDEX "MaterialRequest_companyId_legacySourceSystem_legacyRecordId_key" ON "MaterialRequest"("companyId", "legacySourceSystem", "legacyRecordId");
CREATE INDEX "MaterialRequest_companyId_status_idx" ON "MaterialRequest"("companyId", "status");
CREATE INDEX "MaterialRequest_departmentId_idx" ON "MaterialRequest"("departmentId");
CREATE INDEX "MaterialRequest_requesterEmployeeId_idx" ON "MaterialRequest"("requesterEmployeeId");
CREATE INDEX "MaterialRequest_submittedAt_idx" ON "MaterialRequest"("submittedAt");

CREATE UNIQUE INDEX "MaterialRequestApprovalStep_materialRequestId_stepNumber_key" ON "MaterialRequestApprovalStep"("materialRequestId", "stepNumber");
CREATE INDEX "MaterialRequestApprovalStep_approverUserId_status_idx" ON "MaterialRequestApprovalStep"("approverUserId", "status");
CREATE INDEX "MaterialRequestApprovalStep_materialRequestId_status_idx" ON "MaterialRequestApprovalStep"("materialRequestId", "status");

CREATE UNIQUE INDEX "MaterialRequestItem_materialRequestId_lineNumber_key" ON "MaterialRequestItem"("materialRequestId", "lineNumber");
CREATE INDEX "MaterialRequestItem_materialRequestId_idx" ON "MaterialRequestItem"("materialRequestId");
CREATE INDEX "MaterialRequestItem_itemCode_idx" ON "MaterialRequestItem"("itemCode");

ALTER TABLE "DepartmentMaterialRequestApprovalFlow"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlow_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepartmentMaterialRequestApprovalFlow"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlow_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepartmentMaterialRequestApprovalFlow"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlow_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DepartmentMaterialRequestApprovalFlow"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlow_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DepartmentMaterialRequestApprovalFlowStep"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlowStep_flowId_fkey"
    FOREIGN KEY ("flowId") REFERENCES "DepartmentMaterialRequestApprovalFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DepartmentMaterialRequestApprovalFlowStep"
    ADD CONSTRAINT "DepartmentMaterialRequestApprovalFlowStep_approverUserId_fkey"
    FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_requesterEmployeeId_fkey"
    FOREIGN KEY ("requesterEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_requesterUserId_fkey"
    FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_finalDecisionByUserId_fkey"
    FOREIGN KEY ("finalDecisionByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest"
    ADD CONSTRAINT "MaterialRequest_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestApprovalStep"
    ADD CONSTRAINT "MaterialRequestApprovalStep_materialRequestId_fkey"
    FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestApprovalStep"
    ADD CONSTRAINT "MaterialRequestApprovalStep_approverUserId_fkey"
    FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestApprovalStep"
    ADD CONSTRAINT "MaterialRequestApprovalStep_actedByUserId_fkey"
    FOREIGN KEY ("actedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestItem"
    ADD CONSTRAINT "MaterialRequestItem_materialRequestId_fkey"
    FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
