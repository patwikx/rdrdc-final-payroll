BEGIN;

-- Allow multiple approvers per approval step in department flow configuration.
DROP INDEX IF EXISTS "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_approverUserId_key"
  ON "DepartmentMaterialRequestApprovalFlowStep"("flowId", "stepNumber", "approverUserId");
CREATE INDEX IF NOT EXISTS "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_idx"
  ON "DepartmentMaterialRequestApprovalFlowStep"("flowId", "stepNumber");

-- Allow multiple approvers per runtime approval step in material requests.
DROP INDEX IF EXISTS "MaterialRequestApprovalStep_materialRequestId_stepNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialRequestApprovalStep_materialRequestId_stepNumber_approverUserId_key"
  ON "MaterialRequestApprovalStep"("materialRequestId", "stepNumber", "approverUserId");
CREATE INDEX IF NOT EXISTS "MaterialRequestApprovalStep_materialRequestId_stepNumber_status_idx"
  ON "MaterialRequestApprovalStep"("materialRequestId", "stepNumber", "status");

COMMIT;
