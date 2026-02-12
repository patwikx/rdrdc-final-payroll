"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { dtrDateRangeInputSchema, type DtrDateRangeInput } from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import { formatWallClockTime } from "@/modules/attendance/dtr/utils/wall-clock"

type ExportDtrCsvActionResult =
  | { ok: true; fileName: string; content: string }
  | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const formatDate = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const formatTime = (value: Date | null): string => {
  return formatWallClockTime(value)
}

const toNumber = (value: { toString(): string } | null): string => {
  if (!value) return "0"
  return Number(value.toString()).toFixed(2)
}

const escapeCsv = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

export async function exportDtrCsvAction(input: DtrDateRangeInput): Promise<ExportDtrCsvActionResult> {
  const parsed = dtrDateRangeInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid export filters." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    return { ok: false, error: "You do not have permission to export DTR logs." }
  }

  const startDate = toPhDate(payload.startDate)
  const endDate = toPhDate(payload.endDate)

  const records = await db.dailyTimeRecord.findMany({
    where: {
      employee: { companyId: context.companyId },
      attendanceDate: { gte: startDate, lte: endDate },
    },
    orderBy: [{ attendanceDate: "desc" }, { employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    select: {
      attendanceDate: true,
      actualTimeIn: true,
      actualTimeOut: true,
      hoursWorked: true,
      tardinessMins: true,
      undertimeMins: true,
      overtimeHours: true,
      nightDiffHours: true,
      attendanceStatus: true,
      approvalStatusCode: true,
      remarks: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  })

  const header = [
    "Date",
    "Employee Number",
    "Employee Name",
    "Department",
    "Position",
    "Time In",
    "Time Out",
    "Hours Worked",
    "Tardiness Mins",
    "Undertime Mins",
    "Overtime Hours",
    "Night Diff Hours",
    "Attendance Status",
    "Approval Status",
    "Remarks",
  ]

  const rows = records.map((record) => {
    const values = [
      formatDate(record.attendanceDate),
      record.employee.employeeNumber,
      `${record.employee.lastName}, ${record.employee.firstName}`,
      record.employee.department?.name ?? "",
      record.employee.position?.name ?? "",
      formatTime(record.actualTimeIn),
      formatTime(record.actualTimeOut),
      toNumber(record.hoursWorked),
      String(record.tardinessMins),
      String(record.undertimeMins),
      toNumber(record.overtimeHours),
      toNumber(record.nightDiffHours),
      record.attendanceStatus,
      record.approvalStatusCode,
      record.remarks ?? "",
    ]

    return values.map(escapeCsv).join(",")
  })

  return {
    ok: true,
    fileName: `dtr-${context.companyCode.toLowerCase()}-${payload.startDate}-to-${payload.endDate}.csv`,
    content: [header.join(","), ...rows].join("\n"),
  }
}
