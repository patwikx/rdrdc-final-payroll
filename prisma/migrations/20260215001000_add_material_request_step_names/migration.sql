ALTER TABLE "DepartmentMaterialRequestApprovalFlowStep"
  ADD COLUMN IF NOT EXISTS "stepName" TEXT;

ALTER TABLE "MaterialRequestApprovalStep"
  ADD COLUMN IF NOT EXISTS "stepName" TEXT;
