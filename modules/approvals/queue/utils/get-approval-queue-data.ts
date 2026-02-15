import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type ApprovalQueueItem = {
  id: string
  requestId: string
  kind: "LEAVE" | "OVERTIME"
  requestNumber: string
  leaveTypeName: string | null
  employeeId: string
  employeeName: string
  employeeNumber: string
  department: string
  filedAt: string
  scheduleLabel: string
  quantityLabel: string
  reason: string
  supervisorName: string
  supervisorApprovedAt: string
  supervisorRemarks: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  ctoConversionPreview: boolean
}

export type ApprovalQueueData = {
  companyId: string
  companyName: string
  items: ApprovalQueueItem[]
  filters: {
    query: string
    kind: ApprovalQueueKindFilter
  }
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  summary: {
    total: number
    leave: number
    overtime: number
    highPriority: number
  }
}

export type ApprovalQueueKindFilter = "ALL" | "LEAVE" | "OVERTIME"

export type ApprovalQueueQuery = {
  query?: string
  kind?: ApprovalQueueKindFilter
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateTimeLabel = (value: Date | null): string => {
  if (!value) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(value)
}

const toTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value)
}

const toNumeric = (value: Prisma.Decimal | null): number => {
  if (!value) return 0
  return Number(value)
}

const toEmployeeName = (firstName: string, lastName: string): string => `${lastName}, ${firstName}`

const getPriority = (approvedAt: Date | null): "HIGH" | "MEDIUM" | "LOW" => {
  if (!approvedAt) return "MEDIUM"

  const hoursOpen = (Date.now() - approvedAt.getTime()) / (1000 * 60 * 60)
  if (hoursOpen >= 72) return "HIGH"
  if (hoursOpen >= 24) return "MEDIUM"
  return "LOW"
}

const normalizePage = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 1
  const parsed = Math.floor(value as number)
  return parsed > 0 ? parsed : 1
}

const normalizePageSize = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE
  const parsed = Math.floor(value as number)
  if (parsed < 1) return DEFAULT_PAGE_SIZE
  return Math.min(parsed, MAX_PAGE_SIZE)
}

const normalizeKind = (value: ApprovalQueueQuery["kind"]): ApprovalQueueKindFilter => {
  if (value === "LEAVE" || value === "OVERTIME") return value
  return "ALL"
}

export async function getApprovalQueueData(companyId: string, options: ApprovalQueueQuery = {}): Promise<ApprovalQueueData> {
  const context = await getActiveCompanyContext({ companyId })
  const role = context.companyRole as CompanyRole

  const hasLeaveAccess = hasModuleAccess(role, "leave")
  const hasOvertimeAccess = hasModuleAccess(role, "overtime")

  if (!hasLeaveAccess && !hasOvertimeAccess) {
    throw new Error("ACCESS_DENIED")
  }

  const query = options.query?.trim() ?? ""
  const kind = normalizeKind(options.kind)
  const page = normalizePage(options.page)
  const pageSize = normalizePageSize(options.pageSize)

  const leaveFilterEnabled = hasLeaveAccess && (kind === "ALL" || kind === "LEAVE")
  const overtimeFilterEnabled = hasOvertimeAccess && (kind === "ALL" || kind === "OVERTIME")

  const leaveBaseWhere = {
    employee: { companyId: context.companyId },
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
  } as const

  const overtimeBaseWhere = {
    employee: { companyId: context.companyId },
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
  } as const

  const leaveSearchWhere = query
    ? {
        OR: [
          { requestNumber: { contains: query, mode: "insensitive" as const } },
          { employee: { firstName: { contains: query, mode: "insensitive" as const } } },
          { employee: { lastName: { contains: query, mode: "insensitive" as const } } },
          { employee: { employeeNumber: { contains: query, mode: "insensitive" as const } } },
          { employee: { department: { is: { name: { contains: query, mode: "insensitive" as const } } } } },
        ],
      }
    : {}

  const overtimeSearchWhere = query
    ? {
        OR: [
          { requestNumber: { contains: query, mode: "insensitive" as const } },
          { employee: { firstName: { contains: query, mode: "insensitive" as const } } },
          { employee: { lastName: { contains: query, mode: "insensitive" as const } } },
          { employee: { employeeNumber: { contains: query, mode: "insensitive" as const } } },
          { employee: { department: { is: { name: { contains: query, mode: "insensitive" as const } } } } },
        ],
      }
    : {}

  const staleThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000)

  const [summaryLeaveCount, summaryOvertimeCount, summaryHighLeaveCount, summaryHighOvertimeCount, leaveRequests, overtimeRequests] =
    await Promise.all([
      hasLeaveAccess
        ? db.leaveRequest.count({
            where: leaveBaseWhere,
          })
        : Promise.resolve(0),
      hasOvertimeAccess
        ? db.overtimeRequest.count({
            where: overtimeBaseWhere,
          })
        : Promise.resolve(0),
      hasLeaveAccess
        ? db.leaveRequest.count({
            where: {
              ...leaveBaseWhere,
              supervisorApprovedAt: { lte: staleThreshold },
            },
          })
        : Promise.resolve(0),
      hasOvertimeAccess
        ? db.overtimeRequest.count({
            where: {
              ...overtimeBaseWhere,
              supervisorApprovedAt: { lte: staleThreshold },
            },
          })
        : Promise.resolve(0),
      leaveFilterEnabled
        ? db.leaveRequest.findMany({
            where: {
              ...leaveBaseWhere,
              ...leaveSearchWhere,
            },
            orderBy: [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }],
            select: {
              id: true,
              requestNumber: true,
              leaveType: { select: { name: true } },
              startDate: true,
              endDate: true,
              numberOfDays: true,
              reason: true,
              submittedAt: true,
              supervisorApprovedAt: true,
              supervisorApprovalRemarks: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  department: { select: { name: true } },
                },
              },
              supervisorApprover: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      overtimeFilterEnabled
        ? db.overtimeRequest.findMany({
            where: {
              ...overtimeBaseWhere,
              ...overtimeSearchWhere,
            },
            orderBy: [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              requestNumber: true,
              overtimeDate: true,
              startTime: true,
              endTime: true,
              hours: true,
              reason: true,
              createdAt: true,
              supervisorApprovedAt: true,
              supervisorApprovalRemarks: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  isOvertimeEligible: true,
                  department: { select: { name: true } },
                },
              },
              supervisorApprover: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

  const leaveItems: ApprovalQueueItem[] = leaveRequests.map((item) => ({
    id: `LEAVE-${item.id}`,
    requestId: item.id,
    kind: "LEAVE",
    requestNumber: item.requestNumber,
    leaveTypeName: item.leaveType.name,
    employeeId: item.employee.id,
    employeeName: toEmployeeName(item.employee.firstName, item.employee.lastName),
    employeeNumber: item.employee.employeeNumber,
    department: item.employee.department?.name ?? "-",
    filedAt: toDateTimeLabel(item.submittedAt),
    scheduleLabel: `${toDateLabel(item.startDate)} - ${toDateLabel(item.endDate)}`,
    quantityLabel: `${toNumeric(item.numberOfDays).toFixed(2)} day(s)`,
    reason: item.reason ?? "-",
    supervisorName: item.supervisorApprover
      ? toEmployeeName(item.supervisorApprover.firstName, item.supervisorApprover.lastName)
      : "-",
    supervisorApprovedAt: toDateTimeLabel(item.supervisorApprovedAt),
    supervisorRemarks: item.supervisorApprovalRemarks ?? "-",
    priority: getPriority(item.supervisorApprovedAt),
    ctoConversionPreview: false,
  }))

  const overtimeEmployeeIds = Array.from(new Set(overtimeRequests.map((item) => item.employee.id)))
  const directReportCounts =
    overtimeEmployeeIds.length > 0
      ? await db.employee.groupBy({
          by: ["reportingManagerId"],
          where: {
            companyId: context.companyId,
            deletedAt: null,
            isActive: true,
            reportingManagerId: { in: overtimeEmployeeIds },
          },
          _count: { _all: true },
        })
      : []

  const directReportCountByManagerId = new Map<string, number>()
  for (const row of directReportCounts) {
    if (row.reportingManagerId) {
      directReportCountByManagerId.set(row.reportingManagerId, row._count._all)
    }
  }

  const overtimeItems: ApprovalQueueItem[] = overtimeRequests.map((item) => ({
    ctoConversionPreview:
      !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
    id: `OT-${item.id}`,
    requestId: item.id,
    kind: "OVERTIME",
    requestNumber: item.requestNumber,
    leaveTypeName: null,
    employeeId: item.employee.id,
    employeeName: toEmployeeName(item.employee.firstName, item.employee.lastName),
    employeeNumber: item.employee.employeeNumber,
    department: item.employee.department?.name ?? "-",
    filedAt: toDateTimeLabel(item.createdAt),
    scheduleLabel: `${toDateLabel(item.overtimeDate)} | ${toTimeLabel(item.startTime)} - ${toTimeLabel(item.endTime)}`,
    quantityLabel: `${toNumeric(item.hours).toFixed(2)} hour(s)`,
    reason: item.reason ?? "-",
    supervisorName: item.supervisorApprover
      ? toEmployeeName(item.supervisorApprover.firstName, item.supervisorApprover.lastName)
      : "-",
    supervisorApprovedAt: toDateTimeLabel(item.supervisorApprovedAt),
    supervisorRemarks: item.supervisorApprovalRemarks ?? "-",
    priority: getPriority(item.supervisorApprovedAt),
  }))

  const filteredItems = [...leaveItems, ...overtimeItems].sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    return rank[b.priority] - rank[a.priority]
  })

  const totalItems = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const items = filteredItems.slice(startIndex, startIndex + pageSize)

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    filters: {
      query,
      kind,
    },
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
    items,
    summary: {
      total: summaryLeaveCount + summaryOvertimeCount,
      leave: summaryLeaveCount,
      overtime: summaryOvertimeCount,
      highPriority: summaryHighLeaveCount + summaryHighOvertimeCount,
    },
  }
}
