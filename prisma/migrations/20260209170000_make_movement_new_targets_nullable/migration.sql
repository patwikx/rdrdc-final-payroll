ALTER TABLE "EmployeeStatusHistory"
  ALTER COLUMN "newStatusId" DROP NOT NULL;

ALTER TABLE "EmployeePositionHistory"
  ALTER COLUMN "newPositionId" DROP NOT NULL;

ALTER TABLE "EmployeeRankHistory"
  ALTER COLUMN "newRankId" DROP NOT NULL;
