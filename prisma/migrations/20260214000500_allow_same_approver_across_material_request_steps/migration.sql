BEGIN;

-- Allow one user to appear in multiple step numbers within the same department flow.
DROP INDEX IF EXISTS "DepartmentMaterialRequestApprovalFlowStep_flowId_approverUserId_key";

COMMIT;
