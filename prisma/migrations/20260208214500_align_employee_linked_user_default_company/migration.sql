UPDATE "UserCompanyAccess"
SET "isDefault" = FALSE
WHERE "userId" IN (
  SELECT "userId"
  FROM "Employee"
  WHERE "userId" IS NOT NULL
);

UPDATE "UserCompanyAccess" AS uca
SET "isDefault" = TRUE,
    "isActive" = TRUE
FROM "Employee" AS e
WHERE e."userId" = uca."userId"
  AND e."companyId" = uca."companyId"
  AND e."userId" IS NOT NULL;

UPDATE "User" AS u
SET "selectedCompanyId" = e."companyId",
    "lastCompanySwitchedAt" = NOW()
FROM "Employee" AS e
WHERE e."userId" = u."id";
