UPDATE "UserCompanyAccess" AS uca
SET "isDefault" = TRUE
FROM "Employee" AS e
WHERE e."userId" = uca."userId"
  AND e."companyId" = uca."companyId"
  AND uca."isActive" = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM "UserCompanyAccess" AS d
    WHERE d."userId" = uca."userId"
      AND d."isDefault" = TRUE
      AND d."isActive" = TRUE
  );
