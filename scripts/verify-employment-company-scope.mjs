import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const toCount = (value) => Number(value ?? 0)

const printSection = (title) => {
  console.log(`\n${title}`)
}

const printCount = (label, value) => {
  console.log(`- ${label}: ${value}`)
}

const main = async () => {
  const nullCompanyRows = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "EmploymentStatus" WHERE "companyId" IS NULL) AS status_null_company,
      (SELECT COUNT(*)::int FROM "EmploymentType" WHERE "companyId" IS NULL) AS type_null_company,
      (SELECT COUNT(*)::int FROM "EmploymentClass" WHERE "companyId" IS NULL) AS class_null_company
  `

  const nullCompany = nullCompanyRows[0] ?? {
    status_null_company: 0,
    type_null_company: 0,
    class_null_company: 0,
  }

  const statusNullCompany = toCount(nullCompany.status_null_company)
  const typeNullCompany = toCount(nullCompany.type_null_company)
  const classNullCompany = toCount(nullCompany.class_null_company)

  const employeeCrossCompanyRows = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE e."employmentStatusId" IS NOT NULL AND es."companyId" <> e."companyId")::int AS status_mismatch,
      COUNT(*) FILTER (WHERE e."employmentTypeId" IS NOT NULL AND et."companyId" <> e."companyId")::int AS type_mismatch,
      COUNT(*) FILTER (WHERE e."employmentClassId" IS NOT NULL AND ec."companyId" <> e."companyId")::int AS class_mismatch
    FROM "Employee" e
    LEFT JOIN "EmploymentStatus" es ON es."id" = e."employmentStatusId"
    LEFT JOIN "EmploymentType" et ON et."id" = e."employmentTypeId"
    LEFT JOIN "EmploymentClass" ec ON ec."id" = e."employmentClassId"
    WHERE e."deletedAt" IS NULL
  `

  const leavePolicyMismatchRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS mismatch_count
    FROM "LeavePolicy" lp
    JOIN "LeaveType" lt ON lt."id" = lp."leaveTypeId"
    JOIN "EmploymentStatus" es ON es."id" = lp."employmentStatusId"
    WHERE lt."companyId" IS NOT NULL
      AND es."companyId" <> lt."companyId"
  `

  const perCompanyRows = await prisma.$queryRaw`
    SELECT
      c."id" AS company_id,
      c."code" AS company_code,
      c."name" AS company_name,
      (SELECT COUNT(*)::int FROM "EmploymentStatus" es WHERE es."companyId" = c."id") AS status_count,
      (SELECT COUNT(*)::int FROM "EmploymentType" et WHERE et."companyId" = c."id") AS type_count,
      (SELECT COUNT(*)::int FROM "EmploymentClass" ec WHERE ec."companyId" = c."id") AS class_count
    FROM "Company" c
    ORDER BY c."name" ASC
  `

  const employeeCrossCompany = employeeCrossCompanyRows[0] ?? {
    status_mismatch: 0,
    type_mismatch: 0,
    class_mismatch: 0,
  }

  const leavePolicyMismatch = leavePolicyMismatchRows[0] ?? { mismatch_count: 0 }

  const failures = [
    { label: "EmploymentStatus rows with null companyId", count: statusNullCompany },
    { label: "EmploymentType rows with null companyId", count: typeNullCompany },
    { label: "EmploymentClass rows with null companyId", count: classNullCompany },
    { label: "Employees with cross-company employmentStatusId", count: toCount(employeeCrossCompany.status_mismatch) },
    { label: "Employees with cross-company employmentTypeId", count: toCount(employeeCrossCompany.type_mismatch) },
    { label: "Employees with cross-company employmentClassId", count: toCount(employeeCrossCompany.class_mismatch) },
    { label: "LeavePolicy cross-company status mismatch", count: toCount(leavePolicyMismatch.mismatch_count) },
  ]

  printSection("Employment Scope Verification")
  failures.forEach((item) => printCount(item.label, item.count))

  printSection("Per-company Coverage")
  if (perCompanyRows.length === 0) {
    console.log("- No companies found")
  } else {
    for (const row of perCompanyRows) {
      console.log(
        `- ${row.company_name} (${row.company_code}): statuses=${toCount(row.status_count)}, types=${toCount(row.type_count)}, classes=${toCount(row.class_count)}`
      )
    }
  }

  const failing = failures.filter((item) => item.count > 0)
  if (failing.length > 0) {
    printSection("Result")
    console.log("FAILED: Detected tenant scope issues.")
    process.exit(1)
  }

  printSection("Result")
  console.log("PASS: Employment classifications are company-scoped and consistent.")
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
