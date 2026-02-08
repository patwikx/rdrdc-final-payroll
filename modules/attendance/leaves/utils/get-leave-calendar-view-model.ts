import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

type Input = {
  month?: string
}

export type LeaveCalendarEntry = {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  leaveType: string
  status: string
  startDate: string
  endDate: string
  isHalfDay: boolean
  halfDayPeriod: string | null
  reason: string | null
}

export type LeaveCalendarViewModel = {
  companyName: string
  selectedMonth: string
  range: {
    startDate: string
    endDate: string
  }
  leaves: LeaveCalendarEntry[]
}

const parseMonth = (value: string | undefined): { start: Date; end: Date; monthText: string } => {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map((part) => Number(part))
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0))
    return { start, end, monthText: value }
  }

  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970")
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01")

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  const monthText = `${year}-${String(month).padStart(2, "0")}`
  return { start, end, monthText }
}

const formatDate = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

export async function getLeaveCalendarViewModel(companyId: string, input?: Input): Promise<LeaveCalendarViewModel> {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    throw new Error("ACCESS_DENIED")
  }

  const month = parseMonth(input?.month)

  const leaves = await db.leaveRequest.findMany({
    where: {
      employee: { companyId: context.companyId },
      startDate: { lte: month.end },
      endDate: { gte: month.start },
    },
    orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      statusCode: true,
      reason: true,
      isHalfDay: true,
      halfDayPeriod: true,
      leaveType: { select: { name: true } },
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
  })

  return {
    companyName: context.companyName,
    selectedMonth: month.monthText,
    range: {
      startDate: formatDate(month.start),
      endDate: formatDate(month.end),
    },
    leaves: leaves.map((leave) => ({
      id: leave.id,
      employeeId: leave.employee.id,
      employeeName: `${leave.employee.lastName}, ${leave.employee.firstName}`,
      employeeNumber: leave.employee.employeeNumber,
      leaveType: leave.leaveType.name,
      status: leave.statusCode,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      isHalfDay: leave.isHalfDay,
      halfDayPeriod: leave.halfDayPeriod,
      reason: leave.reason,
    })),
  }
}
