BEGIN;

ALTER TABLE "PayrollRun"
ADD COLUMN "isTrialRun" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PayrollRun"
SET
  "isTrialRun" = true,
  "runTypeCode" = CASE
    WHEN COALESCE("remarks", '') ~ '"baseRunType"\s*:\s*"THIRTEENTH_MONTH"'
      THEN 'THIRTEENTH_MONTH'::"PayrollRunType"
    WHEN COALESCE("remarks", '') ~ '"baseRunType"\s*:\s*"MID_YEAR_BONUS"'
      THEN 'MID_YEAR_BONUS'::"PayrollRunType"
    WHEN COALESCE("remarks", '') ~ '"baseRunType"\s*:\s*"SPECIAL"'
      THEN 'SPECIAL'::"PayrollRunType"
    ELSE 'REGULAR'::"PayrollRunType"
  END
WHERE "runTypeCode" = 'TRIAL_RUN';

CREATE INDEX "PayrollRun_isTrialRun_idx" ON "PayrollRun"("isTrialRun");

COMMIT;
