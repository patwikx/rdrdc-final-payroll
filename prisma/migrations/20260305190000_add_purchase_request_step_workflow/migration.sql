-- Add staged approval workflow fields for Purchase Requests.
ALTER TABLE "PurchaseRequest"
ADD COLUMN "selectedInitialApproverUserId" TEXT,
ADD COLUMN "selectedStepTwoApproverUserId" TEXT,
ADD COLUMN "selectedStepThreeApproverUserId" TEXT,
ADD COLUMN "selectedStepFourApproverUserId" TEXT,
ADD COLUMN "requiredSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentStep" INTEGER;

-- Approval-step records per Purchase Request, aligned with Material Request step semantics.
CREATE TABLE "PurchaseRequestApprovalStep" (
  "id" TEXT NOT NULL,
  "purchaseRequestId" TEXT NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "stepName" TEXT,
  "approverUserId" TEXT NOT NULL,
  "status" "MaterialRequestStepStatus" NOT NULL DEFAULT 'PENDING',
  "actedAt" TIMESTAMP(3),
  "actedByUserId" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRequestApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseRequest_selectedInitialApproverUserId_idx" ON "PurchaseRequest"("selectedInitialApproverUserId");
CREATE INDEX "PurchaseRequest_selectedStepTwoApproverUserId_idx" ON "PurchaseRequest"("selectedStepTwoApproverUserId");
CREATE INDEX "PurchaseRequest_selectedStepThreeApproverUserId_idx" ON "PurchaseRequest"("selectedStepThreeApproverUserId");
CREATE INDEX "PurchaseRequest_selectedStepFourApproverUserId_idx" ON "PurchaseRequest"("selectedStepFourApproverUserId");
CREATE INDEX "PurchaseRequest_currentStep_idx" ON "PurchaseRequest"("currentStep");

CREATE UNIQUE INDEX "PurchaseRequestApprovalStep_purchaseRequestId_stepNumber_approv_key"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "stepNumber", "approverUserId");
CREATE INDEX "PurchaseRequestApprovalStep_approverUserId_status_idx"
ON "PurchaseRequestApprovalStep"("approverUserId", "status");
CREATE INDEX "PurchaseRequestApprovalStep_purchaseRequestId_stepNumber_st_idx"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "stepNumber", "status");
CREATE INDEX "PurchaseRequestApprovalStep_purchaseRequestId_status_idx"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "status");

ALTER TABLE "PurchaseRequest"
ADD CONSTRAINT "PurchaseRequest_selectedInitialApproverUserId_fkey"
FOREIGN KEY ("selectedInitialApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequest"
ADD CONSTRAINT "PurchaseRequest_selectedStepTwoApproverUserId_fkey"
FOREIGN KEY ("selectedStepTwoApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequest"
ADD CONSTRAINT "PurchaseRequest_selectedStepThreeApproverUserId_fkey"
FOREIGN KEY ("selectedStepThreeApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequest"
ADD CONSTRAINT "PurchaseRequest_selectedStepFourApproverUserId_fkey"
FOREIGN KEY ("selectedStepFourApproverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestApprovalStep"
ADD CONSTRAINT "PurchaseRequestApprovalStep_purchaseRequestId_fkey"
FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestApprovalStep"
ADD CONSTRAINT "PurchaseRequestApprovalStep_approverUserId_fkey"
FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestApprovalStep"
ADD CONSTRAINT "PurchaseRequestApprovalStep_actedByUserId_fkey"
FOREIGN KEY ("actedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
