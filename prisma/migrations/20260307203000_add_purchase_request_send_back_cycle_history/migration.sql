-- Preserve purchase request approval history by cycle and persist send-back notice metadata.
ALTER TABLE "PurchaseRequest"
ADD COLUMN IF NOT EXISTS "approvalCycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "sentBackAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sentBackReason" TEXT,
ADD COLUMN IF NOT EXISTS "sentBackByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "sentBackAcknowledgedAt" TIMESTAMP(3);

ALTER TABLE "PurchaseRequestApprovalStep"
ADD COLUMN IF NOT EXISTS "approvalCycle" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "PurchaseRequestApprovalStep_purchaseRequestId_stepNumber_approv_key";
DROP INDEX IF EXISTS "PurchaseRequestApprovalStep_purchaseRequestId_stepNumber_st_idx";
DROP INDEX IF EXISTS "PurchaseRequestApprovalStep_purchaseRequestId_status_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequestApprovalStep_purchaseRequestId_approvalCycle_stepNumber_approverUserId_key"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "approvalCycle", "stepNumber", "approverUserId");

CREATE INDEX IF NOT EXISTS "PurchaseRequestApprovalStep_pr_cycle_step_status_idx"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "approvalCycle", "stepNumber", "status");

CREATE INDEX IF NOT EXISTS "PurchaseRequestApprovalStep_pr_cycle_status_idx"
ON "PurchaseRequestApprovalStep"("purchaseRequestId", "approvalCycle", "status");

CREATE INDEX IF NOT EXISTS "PurchaseRequest_approvalCycle_idx"
ON "PurchaseRequest"("approvalCycle");

CREATE INDEX IF NOT EXISTS "PurchaseRequest_sentBackByUserId_idx"
ON "PurchaseRequest"("sentBackByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PurchaseRequest_sentBackByUserId_fkey'
  ) THEN
    ALTER TABLE "PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_sentBackByUserId_fkey"
    FOREIGN KEY ("sentBackByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
