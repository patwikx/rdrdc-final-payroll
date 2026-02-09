-- Scope EmploymentStatus, EmploymentType, and EmploymentClass per company.

ALTER TABLE "EmploymentStatus" ADD COLUMN "companyId" TEXT;
ALTER TABLE "EmploymentType" ADD COLUMN "companyId" TEXT;
ALTER TABLE "EmploymentClass" ADD COLUMN "companyId" TEXT;

ALTER TABLE "EmploymentStatus" DROP CONSTRAINT IF EXISTS "EmploymentStatus_code_key";
ALTER TABLE "EmploymentType" DROP CONSTRAINT IF EXISTS "EmploymentType_code_key";
ALTER TABLE "EmploymentClass" DROP CONSTRAINT IF EXISTS "EmploymentClass_code_key";

DROP INDEX IF EXISTS "EmploymentStatus_code_key";
DROP INDEX IF EXISTS "EmploymentType_code_key";
DROP INDEX IF EXISTS "EmploymentClass_code_key";

INSERT INTO "EmploymentStatus" (
  "id",
  "companyId",
  "code",
  "name",
  "description",
  "isActive",
  "allowsPayroll",
  "allowsLeave",
  "allowsLoans",
  "triggersOffboarding",
  "displayOrder",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById"
)
SELECT
  gen_random_uuid(),
  c."id",
  es."code",
  es."name",
  es."description",
  es."isActive",
  es."allowsPayroll",
  es."allowsLeave",
  es."allowsLoans",
  es."triggersOffboarding",
  es."displayOrder",
  es."createdAt",
  es."updatedAt",
  es."createdById",
  es."updatedById"
FROM "Company" c
CROSS JOIN "EmploymentStatus" es
WHERE es."companyId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "EmploymentStatus" es_existing
    WHERE es_existing."companyId" = c."id"
      AND es_existing."code" = es."code"
  );

INSERT INTO "EmploymentType" (
  "id",
  "companyId",
  "code",
  "name",
  "description",
  "hasBenefits",
  "hasLeaveCredits",
  "has13thMonth",
  "hasMandatoryDeductions",
  "maxContractMonths",
  "displayOrder",
  "isActive",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById"
)
SELECT
  gen_random_uuid(),
  c."id",
  et."code",
  et."name",
  et."description",
  et."hasBenefits",
  et."hasLeaveCredits",
  et."has13thMonth",
  et."hasMandatoryDeductions",
  et."maxContractMonths",
  et."displayOrder",
  et."isActive",
  et."createdAt",
  et."updatedAt",
  et."createdById",
  et."updatedById"
FROM "Company" c
CROSS JOIN "EmploymentType" et
WHERE et."companyId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "EmploymentType" et_existing
    WHERE et_existing."companyId" = c."id"
      AND et_existing."code" = et."code"
  );

INSERT INTO "EmploymentClass" (
  "id",
  "companyId",
  "code",
  "name",
  "description",
  "standardHoursPerDay",
  "standardDaysPerWeek",
  "isOvertimeEligible",
  "isHolidayPayEligible",
  "displayOrder",
  "isActive",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById"
)
SELECT
  gen_random_uuid(),
  c."id",
  ec."code",
  ec."name",
  ec."description",
  ec."standardHoursPerDay",
  ec."standardDaysPerWeek",
  ec."isOvertimeEligible",
  ec."isHolidayPayEligible",
  ec."displayOrder",
  ec."isActive",
  ec."createdAt",
  ec."updatedAt",
  ec."createdById",
  ec."updatedById"
FROM "Company" c
CROSS JOIN "EmploymentClass" ec
WHERE ec."companyId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "EmploymentClass" ec_existing
    WHERE ec_existing."companyId" = c."id"
      AND ec_existing."code" = ec."code"
  );

UPDATE "Employee" e
SET "employmentStatusId" = (
  SELECT es_new."id"
  FROM "EmploymentStatus" es_old
  JOIN "EmploymentStatus" es_new
    ON es_new."companyId" = e."companyId"
   AND es_new."code" = es_old."code"
  WHERE es_old."id" = e."employmentStatusId"
    AND es_old."companyId" IS NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "EmploymentStatus" es_old
  WHERE es_old."id" = e."employmentStatusId"
    AND es_old."companyId" IS NULL
);

UPDATE "Employee" e
SET "employmentTypeId" = (
  SELECT et_new."id"
  FROM "EmploymentType" et_old
  JOIN "EmploymentType" et_new
    ON et_new."companyId" = e."companyId"
   AND et_new."code" = et_old."code"
  WHERE et_old."id" = e."employmentTypeId"
    AND et_old."companyId" IS NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "EmploymentType" et_old
  WHERE et_old."id" = e."employmentTypeId"
    AND et_old."companyId" IS NULL
);

UPDATE "Employee" e
SET "employmentClassId" = (
  SELECT ec_new."id"
  FROM "EmploymentClass" ec_old
  JOIN "EmploymentClass" ec_new
    ON ec_new."companyId" = e."companyId"
   AND ec_new."code" = ec_old."code"
  WHERE ec_old."id" = e."employmentClassId"
    AND ec_old."companyId" IS NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "EmploymentClass" ec_old
  WHERE ec_old."id" = e."employmentClassId"
    AND ec_old."companyId" IS NULL
);

UPDATE "LeavePolicy" lp
SET "employmentStatusId" = (
  SELECT es_new."id"
  FROM "EmploymentStatus" es_old
  JOIN "LeaveType" lt
    ON lt."id" = lp."leaveTypeId"
  JOIN "EmploymentStatus" es_new
    ON es_new."companyId" = lt."companyId"
   AND es_new."code" = es_old."code"
  WHERE es_old."id" = lp."employmentStatusId"
    AND es_old."companyId" IS NULL
    AND lt."companyId" IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "EmploymentStatus" es_old
  JOIN "LeaveType" lt
    ON lt."id" = lp."leaveTypeId"
  WHERE es_old."id" = lp."employmentStatusId"
    AND es_old."companyId" IS NULL
    AND lt."companyId" IS NOT NULL
);

DELETE FROM "EmploymentStatus" es
WHERE es."companyId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."employmentStatusId" = es."id")
  AND NOT EXISTS (SELECT 1 FROM "LeavePolicy" lp WHERE lp."employmentStatusId" = es."id");

DELETE FROM "EmploymentType" et
WHERE et."companyId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."employmentTypeId" = et."id");

DELETE FROM "EmploymentClass" ec
WHERE ec."companyId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."employmentClassId" = ec."id");

ALTER TABLE "EmploymentStatus" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "EmploymentType" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "EmploymentClass" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "EmploymentStatus"
  ADD CONSTRAINT "EmploymentStatus_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmploymentType"
  ADD CONSTRAINT "EmploymentType_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmploymentClass"
  ADD CONSTRAINT "EmploymentClass_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EmploymentStatus_companyId_code_key" ON "EmploymentStatus"("companyId", "code");
CREATE UNIQUE INDEX "EmploymentType_companyId_code_key" ON "EmploymentType"("companyId", "code");
CREATE UNIQUE INDEX "EmploymentClass_companyId_code_key" ON "EmploymentClass"("companyId", "code");

CREATE INDEX "EmploymentStatus_companyId_idx" ON "EmploymentStatus"("companyId");
CREATE INDEX "EmploymentType_companyId_idx" ON "EmploymentType"("companyId");
CREATE INDEX "EmploymentClass_companyId_idx" ON "EmploymentClass"("companyId");
