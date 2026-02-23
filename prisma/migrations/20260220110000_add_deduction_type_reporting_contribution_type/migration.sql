ALTER TABLE "DeductionType"
ADD COLUMN "reportingContributionType" "ContributionType";

UPDATE "DeductionType"
SET "reportingContributionType" = CASE
  WHEN UPPER("code") = 'SSS' THEN 'SSS'::"ContributionType"
  WHEN UPPER("code") = 'PHILHEALTH' THEN 'PHILHEALTH'::"ContributionType"
  WHEN UPPER("code") = 'PAGIBIG' THEN 'PAGIBIG'::"ContributionType"
  WHEN UPPER("code") IN ('WTAX', 'WHTAX') THEN 'TAX'::"ContributionType"
  WHEN "code" ~* 'PAG[\\s_-]*IBIG' OR COALESCE("name", '') ~* 'PAG[\\s_-]*IBIG' THEN 'PAGIBIG'::"ContributionType"
  WHEN "code" ~* 'PHIL[\\s_-]*HEALTH' OR COALESCE("name", '') ~* 'PHIL[\\s_-]*HEALTH' THEN 'PHILHEALTH'::"ContributionType"
  WHEN "code" ~* '(WHTAX|WTAX|WITHHOLDING[\\s_-]*TAX)' OR COALESCE("name", '') ~* '(WHTAX|WTAX|WITHHOLDING[\\s_-]*TAX)' THEN 'TAX'::"ContributionType"
  ELSE NULL
END
WHERE "reportingContributionType" IS NULL;

CREATE INDEX "DeductionType_reportingContributionType_idx" ON "DeductionType"("reportingContributionType");
