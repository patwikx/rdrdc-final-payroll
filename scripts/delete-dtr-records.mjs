import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const getArgValue = (args, name) => {
  const index = args.findIndex((item) => item === name)
  if (index < 0) return undefined
  return args[index + 1]
}

const hasFlag = (args, name) => args.includes(name)

const toSet = (value) => {
  if (!value) return new Set()
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  )
}

const parseDateOnlyToUtc = (value) => {
  if (!value) return null
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!match) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const printUsage = () => {
  console.log("Mass delete DailyTimeRecord rows (safe dry-run by default).")
  console.log("")
  console.log("Usage:")
  console.log(
    "  node scripts/delete-dtr-records.mjs [--company-id <id>] [--employee-ids <id1,id2,...>] [--date-from YYYY-MM-DD] [--date-to YYYY-MM-DD] [--status <status>] [--all] [--apply]"
  )
  console.log("")
  console.log("Examples:")
  console.log(
    "  node scripts/delete-dtr-records.mjs --company-id 2e42185b-309d-43e8-8d40-e4564eab0bf6 --date-from 2025-01-01 --date-to 2025-12-31"
  )
  console.log(
    "  node scripts/delete-dtr-records.mjs --employee-ids emp-1,emp-2 --date-from 2025-12-01 --date-to 2025-12-31 --apply"
  )
  console.log("  node scripts/delete-dtr-records.mjs --all --apply")
  console.log("")
  console.log("Notes:")
  console.log("- Dry-run is default. No deletion happens unless --apply is included.")
  console.log("- You must provide at least one filter, or explicitly pass --all.")
  console.log("- This operation is irreversible.")
}

const main = async () => {
  const args = process.argv.slice(2)
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printUsage()
    return
  }

  const companyId = getArgValue(args, "--company-id")?.trim() || undefined
  const employeeIds = Array.from(toSet(getArgValue(args, "--employee-ids")))
  const statusValue = getArgValue(args, "--status")?.trim() || undefined
  const dateFromValue = getArgValue(args, "--date-from")
  const dateToValue = getArgValue(args, "--date-to")
  const includeAll = hasFlag(args, "--all")
  const apply = hasFlag(args, "--apply")

  const dateFrom = parseDateOnlyToUtc(dateFromValue)
  const dateTo = parseDateOnlyToUtc(dateToValue)

  if (dateFromValue && !dateFrom) {
    console.error("Invalid --date-from. Expected format: YYYY-MM-DD")
    process.exit(1)
  }

  if (dateToValue && !dateTo) {
    console.error("Invalid --date-to. Expected format: YYYY-MM-DD")
    process.exit(1)
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    console.error("--date-from must be on or before --date-to.")
    process.exit(1)
  }

  const hasAnyFilter =
    Boolean(companyId) ||
    employeeIds.length > 0 ||
    Boolean(statusValue) ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  if (includeAll && hasAnyFilter) {
    console.error("Do not combine --all with other filters.")
    process.exit(1)
  }

  if (!includeAll && !hasAnyFilter) {
    printUsage()
    process.exit(1)
  }

  const where = includeAll
    ? {}
    : {
        ...(companyId ? { employee: { companyId } } : {}),
        ...(employeeIds.length > 0 ? { employeeId: { in: employeeIds } } : {}),
        ...(statusValue ? { attendanceStatus: statusValue } : {}),
        ...(dateFrom || dateTo
          ? {
              attendanceDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      }

  const [count, aggregate, previewRows] = await Promise.all([
    prisma.dailyTimeRecord.count({ where }),
    prisma.dailyTimeRecord.aggregate({
      where,
      _min: { attendanceDate: true },
      _max: { attendanceDate: true },
    }),
    prisma.dailyTimeRecord.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        attendanceStatus: true,
      },
      orderBy: [{ attendanceDate: "asc" }, { employeeId: "asc" }],
      take: 5,
    }),
  ])

  console.log("")
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log(`Scope: ${includeAll ? "ALL DailyTimeRecord rows" : "Filtered DailyTimeRecord rows"}`)
  if (!includeAll) {
    console.log(`- companyId: ${companyId ?? "(any)"}`)
    console.log(`- employeeIds: ${employeeIds.length > 0 ? employeeIds.join(", ") : "(any)"}`)
    console.log(`- attendanceStatus: ${statusValue ?? "(any)"}`)
    console.log(`- attendanceDate from: ${dateFromValue ?? "(none)"}`)
    console.log(`- attendanceDate to: ${dateToValue ?? "(none)"}`)
  }
  console.log(`Matched rows: ${count}`)

  if (aggregate._min.attendanceDate || aggregate._max.attendanceDate) {
    console.log(
      `Attendance date range: ${aggregate._min.attendanceDate?.toISOString().slice(0, 10) ?? "-"} -> ${aggregate._max.attendanceDate?.toISOString().slice(0, 10) ?? "-"}`
    )
  }

  if (previewRows.length > 0) {
    console.log("Preview (first 5):")
    previewRows.forEach((row) => {
      console.log(
        `- ${row.id} | employee=${row.employeeId} | date=${row.attendanceDate.toISOString().slice(0, 10)} | status=${row.attendanceStatus}`
      )
    })
  }

  if (!apply) {
    console.log("")
    console.log("Dry-run complete. Add --apply to delete matching records.")
    return
  }

  if (count === 0) {
    console.log("")
    console.log("No rows matched. Nothing deleted.")
    return
  }

  const result = await prisma.dailyTimeRecord.deleteMany({ where })
  console.log("")
  console.log(`Deleted DailyTimeRecord rows: ${result.count}`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
