ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "isAuthorizedSignatory" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Employee_companyId_isAuthorizedSignatory_idx"
ON "Employee"("companyId", "isAuthorizedSignatory");
