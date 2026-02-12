import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { getPhYear } from "@/lib/ph-time"
import { leaveDateRangeSchema, leaveYearSchema } from "@/modules/leave/schemas/leave-query-schemas"
import type {
  LeaveBalanceSummaryReportEmployeeRow,
  LeaveBalanceWorkspaceHistoryRow,
  LeaveBalanceWorkspaceRow,
  LeaveOverlayRecord,
} from "@/modules/leave/types/leave-domain-types"

const normalizeLeaveType = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const isMandatoryLeaveType = (value: string): boolean => {
  const key = normalizeLeaveType(value)
  return key.includes("mandatory") && key.includes("leave")
}

const isExcludedInBalanceSummaryReport = (value: string): boolean => {
  const key = normalizeLeaveType(value)
  if (key.includes("maternity")) return true
  if (key.includes("paternity")) return true
  if (key.includes("bereavement")) return true
  if (key.includes("emergency")) return true
  if (key.includes("compensatory") && key.includes("time") && key.includes("off")) return true
  if (key.includes("cto")) return true
  if (key.includes("leavewithoutpay")) return true
  if (key.includes("lwop")) return true
  return false
}

export const resolveLeaveYear = (input: number | undefined): number => {
  const currentYear = getPhYear()
  const parsed = typeof input === "number" ? leaveYearSchema.safeParse(input) : null
  if (parsed?.success) return parsed.data
  return currentYear
}

export async function getLeaveBalanceWorkspaceData(params: {
  companyId: string
  year: number
}): Promise<{
  years: number[]
  balanceRows: LeaveBalanceWorkspaceRow[]
  historyRows: LeaveBalanceWorkspaceHistoryRow[]
}> {
  const year = leaveYearSchema.parse(params.year)
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`)
  const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`)

  const [balanceRowsRaw, historyRowsRaw, yearRows] = await Promise.all([
    db.leaveBalance.findMany({
      where: {
        year,
        employee: {
          companyId: params.companyId,
          deletedAt: null,
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }, { leaveType: { displayOrder: "asc" } }],
      select: {
        employeeId: true,
        currentBalance: true,
        availableBalance: true,
        pendingRequests: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            department: { select: { name: true } },
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employee: {
          companyId: params.companyId,
          deletedAt: null,
        },
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        employeeId: true,
        requestNumber: true,
        statusCode: true,
        numberOfDays: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.leaveBalance.findMany({
      where: {
        employee: {
          companyId: params.companyId,
          deletedAt: null,
        },
      },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
      take: 8,
    }),
  ])

  const balanceRows: LeaveBalanceWorkspaceRow[] = balanceRowsRaw.map((row) => ({
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    employeeNumber: row.employee.employeeNumber,
    photoUrl: row.employee.photoUrl,
    departmentName: row.employee.department?.name ?? "Unassigned",
    leaveTypeName: row.leaveType.name,
    currentBalance: Number(row.currentBalance),
    availableBalance: Number(row.availableBalance),
    pendingRequests: Number(row.pendingRequests),
  }))

  const historyRows: LeaveBalanceWorkspaceHistoryRow[] = historyRowsRaw.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    requestNumber: row.requestNumber,
    leaveTypeName: row.leaveType.name,
    statusCode: row.statusCode,
    numberOfDays: Number(row.numberOfDays),
    startDateIso: row.startDate.toISOString(),
    endDateIso: row.endDate.toISOString(),
    createdAtIso: row.createdAt.toISOString(),
  }))

  const years = Array.from(new Set([year, ...yearRows.map((row) => row.year)])).sort((a, b) => b - a)

  return {
    years,
    balanceRows,
    historyRows,
  }
}

export async function getLeaveBalanceSummaryReportData(params: {
  companyId: string
  year: number
}): Promise<{
  leaveTypeColumns: string[]
  rows: LeaveBalanceSummaryReportEmployeeRow[]
}> {
  const year = leaveYearSchema.parse(params.year)
  const balances = await db.leaveBalance.findMany({
    where: {
      year,
      employee: {
        companyId: params.companyId,
        deletedAt: null,
      },
    },
    orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }, { leaveType: { displayOrder: "asc" } }],
    select: {
      availableBalance: true,
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const included = balances.filter((row) => !isExcludedInBalanceSummaryReport(row.leaveType.name))

  const leaveTypeColumns = Array.from(
    new Map(included.sort((a, b) => a.leaveType.name.localeCompare(b.leaveType.name)).map((row) => [row.leaveType.id, row.leaveType.name])).values()
  )

  if (!leaveTypeColumns.some((name) => isMandatoryLeaveType(name))) {
    leaveTypeColumns.push("Mandatory Leave")
  }

  const employeeMap = new Map<string, LeaveBalanceSummaryReportEmployeeRow>()

  for (const row of included) {
    const key = row.employee.employeeNumber
    const current = employeeMap.get(key) ?? {
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
      departmentName: row.employee.department?.name ?? "Unassigned",
      leaveBalances: {},
    }
    current.leaveBalances[row.leaveType.name] = Number(row.availableBalance)
    employeeMap.set(key, current)
  }

  return {
    leaveTypeColumns,
    rows: Array.from(employeeMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
  }
}

export async function getApprovedLeaveOverlaysForEmployee(params: {
  companyId: string
  employeeId: string
  startDate: Date
  endDate: Date
}): Promise<LeaveOverlayRecord[]> {
  const parsedRange = leaveDateRangeSchema.parse({ startDate: params.startDate, endDate: params.endDate })

  const leaves = await db.leaveRequest.findMany({
    where: {
      employeeId: params.employeeId,
      employee: {
        companyId: params.companyId,
        deletedAt: null,
      },
      statusCode: RequestStatus.APPROVED,
      startDate: { lte: parsedRange.endDate },
      endDate: { gte: parsedRange.startDate },
    },
    orderBy: [{ startDate: "asc" }],
    select: {
      id: true,
      employeeId: true,
      startDate: true,
      endDate: true,
      isHalfDay: true,
      halfDayPeriod: true,
      leaveType: { select: { name: true, code: true, isPaid: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          photoUrl: true,
        },
      },
    },
  })

  return leaves.map((leave) => ({
    id: leave.id,
    employeeId: leave.employeeId,
    startDate: leave.startDate.toISOString(),
    endDate: leave.endDate.toISOString(),
    isHalfDay: leave.isHalfDay,
    halfDayPeriod: leave.halfDayPeriod,
    leaveType: {
      name: leave.leaveType.name,
      code: leave.leaveType.code,
      isPaid: leave.leaveType.isPaid,
    },
    employee: {
      id: leave.employee.id,
      firstName: leave.employee.firstName,
      lastName: leave.employee.lastName,
      employeeNumber: leave.employee.employeeNumber,
      photoUrl: leave.employee.photoUrl,
    },
  }))
}
