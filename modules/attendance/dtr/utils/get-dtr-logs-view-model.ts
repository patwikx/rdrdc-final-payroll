import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type DateRangeInput = {
  startDate?: string
  endDate?: string
}

export type DtrLogRow = {
  id: string
  attendanceDate: string
  attendanceDateValue: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  department: string
  position: string
  timeIn: string
  timeOut: string
  timeInValue: string
  timeOutValue: string
  hoursWorked: number
  tardinessMins: number
  undertimeMins: number
  overtimeHours: number
  nightDiffHours: number
  attendanceStatus: string
  approvalStatus: string
  remarks: string
}

export type DtrLogsViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  filters: {
    startDate: string
    endDate: string
  }
  summary: {
    activeEmployees: number
    presentToday: number
    absentToday: number
    recordsInRange: number
    pendingApprovals: number
    withLate: number
    withUndertime: number
    missingLogsEstimate: number
  }
  rows: DtrLogRow[]
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

const toDateInputValue = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toPhDateFromInput = (value: string): Date | null => {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (!year || !month || !day) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

const formatDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const formatTimeLabel = (value: Date | null): string => {
  if (!value) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(value)
}

const toTimeInputValue = (value: Date | null): string => {
  if (!value) return ""

  const formatted = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Manila",
  }).format(value)

  return formatted.slice(0, 5)
}

const toNumeric = (value: Prisma.Decimal | null): number => {
  if (!value) return 0
  return Number(value)
}

const toFullName = (firstName: string, lastName: string): string => `${lastName}, ${firstName}`

const resolveDateRange = (input?: DateRangeInput): { startDate: Date; endDate: Date; startLabel: string; endLabel: string } => {
  const todayPh = toPhDateOnlyUtc()
  const defaultStart = new Date(todayPh.getTime() - 30 * 24 * 60 * 60 * 1000)

  const parsedStart = input?.startDate ? toPhDateFromInput(input.startDate) : null
  const parsedEnd = input?.endDate ? toPhDateFromInput(input.endDate) : null

  const startDate = parsedStart ?? defaultStart
  const endDate = parsedEnd ?? todayPh

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

const countDaysInclusive = (startDate: Date, endDate: Date): number => {
  if (endDate.getTime() < startDate.getTime()) return 0

  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1
}

export async function getDtrLogsViewModel(companyId: string, range?: DateRangeInput): Promise<DtrLogsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    throw new Error("ACCESS_DENIED")
  }

  const { startDate, endDate, startLabel, endLabel } = resolveDateRange(range)
  const todayPh = toPhDateOnlyUtc()
  const daysCovered = countDaysInclusive(startDate, endDate)

  const [activeEmployees, presentToday, logs] = await Promise.all([
    db.employee.count({
      where: {
        companyId: context.companyId,
        isActive: true,
        deletedAt: null,
      },
    }),
    db.dailyTimeRecord.count({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: todayPh,
        attendanceStatus: "PRESENT",
      },
    }),
    db.dailyTimeRecord.findMany({
      where: {
        employee: { companyId: context.companyId },
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ attendanceDate: "desc" }, { employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      select: {
        id: true,
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
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const rows: DtrLogRow[] = logs.map((log) => ({
    id: log.id,
    attendanceDate: formatDateLabel(log.attendanceDate),
    attendanceDateValue: toDateInputValue(log.attendanceDate),
    employeeId: log.employee.id,
    employeeNumber: log.employee.employeeNumber,
    employeeName: toFullName(log.employee.firstName, log.employee.lastName),
    department: log.employee.department?.name ?? "-",
    position: log.employee.position?.name ?? "-",
    timeIn: formatTimeLabel(log.actualTimeIn),
    timeOut: formatTimeLabel(log.actualTimeOut),
    timeInValue: toTimeInputValue(log.actualTimeIn),
    timeOutValue: toTimeInputValue(log.actualTimeOut),
    hoursWorked: toNumeric(log.hoursWorked),
    tardinessMins: log.tardinessMins,
    undertimeMins: log.undertimeMins,
    overtimeHours: toNumeric(log.overtimeHours),
    nightDiffHours: toNumeric(log.nightDiffHours),
    attendanceStatus: log.attendanceStatus,
    approvalStatus: log.approvalStatusCode,
    remarks: log.remarks ?? "",
  }))

  const pendingApprovals = rows.filter((row) => row.approvalStatus === "PENDING").length
  const withLate = rows.filter((row) => row.tardinessMins > 0).length
  const withUndertime = rows.filter((row) => row.undertimeMins > 0).length
  const recordsInRange = rows.length
  const expectedSlots = activeEmployees * daysCovered

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    filters: {
      startDate: startLabel,
      endDate: endLabel,
    },
    summary: {
      activeEmployees,
      presentToday,
      absentToday: Math.max(0, activeEmployees - presentToday),
      recordsInRange,
      pendingApprovals,
      withLate,
      withUndertime,
      missingLogsEstimate: Math.max(0, expectedSlots - recordsInRange),
    },
    rows,
  }
}
