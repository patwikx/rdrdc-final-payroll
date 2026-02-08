import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

type DateRangeInput = {
  startDate?: string
  endDate?: string
}

export type AttendanceExceptionRow = {
  id: string
  attendanceDate: string
  employeeName: string
  employeeNumber: string
  issue: string
  attendanceStatus: string
  approvalStatus: string
  tardinessMins: number
  undertimeMins: number
}

export type AttendanceExceptionsViewModel = {
  companyName: string
  filters: {
    startDate: string
    endDate: string
  }
  summary: {
    totalExceptions: number
    absences: number
    withLate: number
    withUndertime: number
    pendingApprovals: number
  }
  rows: AttendanceExceptionRow[]
}

const toDateInputValue = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toPhDateOnlyUtc = (value: Date = new Date()): Date => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970")
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01")
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01")

  return new Date(Date.UTC(year, month - 1, day))
}

const toPhDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const resolveDateRange = (input?: DateRangeInput): { startDate: Date; endDate: Date; startLabel: string; endLabel: string } => {
  const endDate = input?.endDate ? toPhDate(input.endDate) ?? toPhDateOnlyUtc() : toPhDateOnlyUtc()
  const startDate = input?.startDate ? toPhDate(input.startDate) ?? new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000) : new Date(endDate.getTime() - 14 * 24 * 60 * 60 * 1000)

  if (startDate.getTime() <= endDate.getTime()) {
    return {
      startDate,
      endDate,
      startLabel: toDateInputValue(startDate),
      endLabel: toDateInputValue(endDate),
    }
  }

  return {
    startDate: endDate,
    endDate: startDate,
    startLabel: toDateInputValue(endDate),
    endLabel: toDateInputValue(startDate),
  }
}

const resolveIssue = (row: { attendanceStatus: string; tardinessMins: number; undertimeMins: number; approvalStatusCode: string }): string => {
  if (row.attendanceStatus === "ABSENT") {
    return "Absent"
  }

  if (row.tardinessMins > 0) {
    return `Late (${row.tardinessMins} mins)`
  }

  if (row.undertimeMins > 0) {
    return `Undertime (${row.undertimeMins} mins)`
  }

  if (row.approvalStatusCode === "PENDING") {
    return "Pending approval"
  }

  return "Attendance exception"
}

export async function getAttendanceExceptionsViewModel(
  companyId: string,
  range?: DateRangeInput
): Promise<AttendanceExceptionsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    throw new Error("ACCESS_DENIED")
  }

  const { startDate, endDate, startLabel, endLabel } = resolveDateRange(range)

  const rows = await db.dailyTimeRecord.findMany({
    where: {
      employee: { companyId: context.companyId },
      attendanceDate: { gte: startDate, lte: endDate },
      OR: [
        { attendanceStatus: "ABSENT" },
        { tardinessMins: { gt: 0 } },
        { undertimeMins: { gt: 0 } },
        { approvalStatusCode: "PENDING" },
      ],
    },
    orderBy: [{ attendanceDate: "desc" }, { employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    select: {
      id: true,
      attendanceDate: true,
      attendanceStatus: true,
      approvalStatusCode: true,
      tardinessMins: true,
      undertimeMins: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
    },
  })

  const mappedRows = rows.map((row) => ({
    id: row.id,
    attendanceDate: toDateLabel(row.attendanceDate),
    employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
    employeeNumber: row.employee.employeeNumber,
    issue: resolveIssue(row),
    attendanceStatus: row.attendanceStatus,
    approvalStatus: row.approvalStatusCode,
    tardinessMins: row.tardinessMins,
    undertimeMins: row.undertimeMins,
  }))

  return {
    companyName: context.companyName,
    filters: {
      startDate: startLabel,
      endDate: endLabel,
    },
    summary: {
      totalExceptions: mappedRows.length,
      absences: mappedRows.filter((row) => row.attendanceStatus === "ABSENT").length,
      withLate: mappedRows.filter((row) => row.tardinessMins > 0).length,
      withUndertime: mappedRows.filter((row) => row.undertimeMins > 0).length,
      pendingApprovals: mappedRows.filter((row) => row.approvalStatus === "PENDING").length,
    },
    rows: mappedRows,
  }
}
