ALTER TABLE "Payslip"
ADD COLUMN IF NOT EXISTS "departmentSnapshotId" TEXT,
ADD COLUMN IF NOT EXISTS "departmentSnapshotName" TEXT;

CREATE INDEX IF NOT EXISTS "Payslip_departmentSnapshotId_idx"
ON "Payslip"("departmentSnapshotId");
