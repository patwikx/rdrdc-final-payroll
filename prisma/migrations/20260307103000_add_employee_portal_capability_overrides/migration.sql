CREATE TYPE "PortalAccessScope" AS ENUM ('NONE', 'OWN', 'APPROVAL_QUEUE', 'COMPANY');

CREATE TABLE "EmployeePortalCapabilityOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "accessScope" "PortalAccessScope" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePortalCapabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeePortalCapabilityOverride_userId_companyId_capability_key"
ON "EmployeePortalCapabilityOverride"("userId", "companyId", "capability");

CREATE INDEX "EmployeePortalCapabilityOverride_userId_companyId_idx"
ON "EmployeePortalCapabilityOverride"("userId", "companyId");

CREATE INDEX "EmployeePortalCapabilityOverride_companyId_capability_idx"
ON "EmployeePortalCapabilityOverride"("companyId", "capability");

ALTER TABLE "EmployeePortalCapabilityOverride"
ADD CONSTRAINT "EmployeePortalCapabilityOverride_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeePortalCapabilityOverride"
ADD CONSTRAINT "EmployeePortalCapabilityOverride_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
