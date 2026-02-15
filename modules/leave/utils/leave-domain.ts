import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { getPhYear, toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "@/lib/ph-time"
import { leaveDateRangeSchema, leaveYearSchema } from "@/modules/leave/schemas/leave-query-schemas"
import type {
  LeaveBalanceWorkspaceHistoryPage,
  LeaveBalanceWorkspaceHistoryMonth,
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
  statusCodes: RequestStatus[]
}> {
  const year = leaveYearSchema.parse(params.year)
  const yearStart = toPhDayStartUtcInstant(`${year}-01-01`)
  const yearEnd = toPhDayEndUtcInstant(`${year}-12-31`)

  if (!yearStart || !yearEnd) {
    throw new Error(`Invalid leave year range: ${year}`)
  }

  const [balanceRowsRaw, yearRows, statusRows] = await Promise.all([
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
    db.leaveRequest.findMany({
      where: {
        employee: {
          companyId: params.companyId,
          deletedAt: null,
        },
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      select: {
        statusCode: true,
      },
      distinct: ["statusCode"],
      orderBy: [{ statusCode: "asc" }],
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

  const years = Array.from(new Set([year, ...yearRows.map((row) => row.year)])).sort((a, b) => b - a)
  const statusCodes: RequestStatus[] = statusRows.map((row) => row.statusCode)

  return {
    years,
    balanceRows,
    statusCodes,
  }
}

export async function getLeaveBalanceEmployeeHistoryPageData(params: {
  companyId: string
  year: number
  employeeId: string
  leaveType?: string
  statusCode?: RequestStatus
  page: number
  pageSize: number
}): Promise<LeaveBalanceWorkspaceHistoryPage> {
  const year = leaveYearSchema.parse(params.year)
  const yearStart = toPhDayStartUtcInstant(`${year}-01-01`)
  const yearEnd = toPhDayEndUtcInstant(`${year}-12-31`)

  if (!yearStart || !yearEnd) {
    throw new Error(`Invalid leave year range: ${year}`)
  }

  const safePage = Math.max(1, params.page)
  const safePageSize = Math.max(1, Math.min(50, params.pageSize))

  const where: Prisma.LeaveRequestWhereInput = {
    employeeId: params.employeeId,
    employee: {
      companyId: params.companyId,
      deletedAt: null,
    },
    startDate: { lte: yearEnd },
    endDate: { gte: yearStart },
    ...(params.leaveType ? { leaveType: { name: params.leaveType } } : {}),
    ...(params.statusCode ? { statusCode: params.statusCode } : {}),
  }

  const [totalItems, rowsRaw, monthlyRaw] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
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
    db.leaveRequest.findMany({
      where,
      select: {
        startDate: true,
        statusCode: true,
        numberOfDays: true,
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
  const normalizedPage = Math.min(safePage, totalPages)
  const normalizedRowsRaw =
    normalizedPage === safePage
      ? rowsRaw
      : await db.leaveRequest.findMany({
          where,
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          skip: (normalizedPage - 1) * safePageSize,
          take: safePageSize,
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
        })

  const rows: LeaveBalanceWorkspaceHistoryRow[] = normalizedRowsRaw.map((row) => ({
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

  const monthMap = new Map<number, { filed: number; used: number }>()
  for (let month = 0; month < 12; month += 1) {
    monthMap.set(month, { filed: 0, used: 0 })
  }

  for (const row of monthlyRaw) {
    const monthIndex = row.startDate.getUTCMonth()
    const current = monthMap.get(monthIndex)
    if (!current) continue

    const numberOfDays = Number(row.numberOfDays)
    current.filed += numberOfDays
    if (row.statusCode === "APPROVED" || row.statusCode === "SUPERVISOR_APPROVED") {
      current.used += numberOfDays
    }
  }

  const monthlyTotals: LeaveBalanceWorkspaceHistoryMonth[] = Array.from(monthMap.entries()).map(([month, value]) => ({
    month,
    filed: value.filed,
    used: value.used,
  }))

  return {
    rows,
    page: normalizedPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    hasPrevPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    monthlyTotals,
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
