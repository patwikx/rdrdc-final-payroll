BEGIN;

UPDATE "PayrollRun"
SET "runTypeCode" = 'SPECIAL'
WHERE "runTypeCode" = 'FINAL_PAY';

ALTER TYPE "PayrollRunType" RENAME TO "PayrollRunType_old";

CREATE TYPE "PayrollRunType" AS ENUM (
  'REGULAR',
  'THIRTEENTH_MONTH',
  'MID_YEAR_BONUS',
  'TRIAL_RUN',
  'SPECIAL'
);

ALTER TABLE "PayrollRun"
ALTER COLUMN "runTypeCode" DROP DEFAULT;

ALTER TABLE "PayrollRun"
ALTER COLUMN "runTypeCode" TYPE "PayrollRunType"
USING ("runTypeCode"::text::"PayrollRunType");

ALTER TABLE "PayrollRun"
ALTER COLUMN "runTypeCode" SET DEFAULT 'REGULAR';

DROP TYPE "PayrollRunType_old";

COMMIT;
