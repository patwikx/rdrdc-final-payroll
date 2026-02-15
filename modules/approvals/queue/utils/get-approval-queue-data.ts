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

type PriorityBucket = "HIGH" | "MEDIUM" | "LOW"
type SegmentKind = "LEAVE" | "OVERTIME"

type SegmentDefinition = {
  kind: SegmentKind
  priority: PriorityBucket
  count: number
}

type SegmentWindow = SegmentDefinition & {
  index: number
  skip: number
  take: number
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

const buildPriorityWhere = (
  priority: PriorityBucket,
  stale72Hours: Date,
  stale24Hours: Date
): Prisma.LeaveRequestWhereInput => {
  if (priority === "HIGH") {
    return {
      supervisorApprovedAt: { lte: stale72Hours },
    }
  }

  if (priority === "MEDIUM") {
    return {
      OR: [
        { supervisorApprovedAt: null },
        {
          AND: [
            { supervisorApprovedAt: { gt: stale72Hours } },
            { supervisorApprovedAt: { lte: stale24Hours } },
          ],
        },
      ],
    }
  }

  return {
    supervisorApprovedAt: { gt: stale24Hours },
  }
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

  const leaveBaseWhere: Prisma.LeaveRequestWhereInput = {
    employee: { companyId: context.companyId },
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
  }

  const overtimeBaseWhere: Prisma.OvertimeRequestWhereInput = {
    employee: { companyId: context.companyId },
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
  }

  const leaveSearchWhere: Prisma.LeaveRequestWhereInput = query
    ? {
        OR: [
          { requestNumber: { contains: query, mode: "insensitive" } },
          { employee: { firstName: { contains: query, mode: "insensitive" } } },
          { employee: { lastName: { contains: query, mode: "insensitive" } } },
          { employee: { employeeNumber: { contains: query, mode: "insensitive" } } },
          { employee: { department: { is: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      }
    : {}

  const overtimeSearchWhere: Prisma.OvertimeRequestWhereInput = query
    ? {
        OR: [
          { requestNumber: { contains: query, mode: "insensitive" } },
          { employee: { firstName: { contains: query, mode: "insensitive" } } },
          { employee: { lastName: { contains: query, mode: "insensitive" } } },
          { employee: { employeeNumber: { contains: query, mode: "insensitive" } } },
          { employee: { department: { is: { name: { contains: query, mode: "insensitive" } } } } },
        ],
      }
    : {}

  const stale72Hours = new Date(Date.now() - 72 * 60 * 60 * 1000)
  const stale24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    summaryLeaveCount,
    summaryOvertimeCount,
    summaryHighLeaveCount,
    summaryHighOvertimeCount,
    leaveHighCount,
    leaveMediumCount,
    leaveLowCount,
    overtimeHighCount,
    overtimeMediumCount,
    overtimeLowCount,
  ] = await Promise.all([
    hasLeaveAccess ? db.leaveRequest.count({ where: leaveBaseWhere }) : Promise.resolve(0),
    hasOvertimeAccess ? db.overtimeRequest.count({ where: overtimeBaseWhere }) : Promise.resolve(0),
    hasLeaveAccess
      ? db.leaveRequest.count({
          where: {
            ...leaveBaseWhere,
            supervisorApprovedAt: { lte: stale72Hours },
          },
        })
      : Promise.resolve(0),
    hasOvertimeAccess
      ? db.overtimeRequest.count({
          where: {
            ...overtimeBaseWhere,
            supervisorApprovedAt: { lte: stale72Hours },
          },
        })
      : Promise.resolve(0),
    leaveFilterEnabled
      ? db.leaveRequest.count({
          where: {
            ...leaveBaseWhere,
            ...leaveSearchWhere,
            ...buildPriorityWhere("HIGH", stale72Hours, stale24Hours),
          },
        })
      : Promise.resolve(0),
    leaveFilterEnabled
      ? db.leaveRequest.count({
          where: {
            ...leaveBaseWhere,
            ...leaveSearchWhere,
            ...buildPriorityWhere("MEDIUM", stale72Hours, stale24Hours),
          },
        })
      : Promise.resolve(0),
    leaveFilterEnabled
      ? db.leaveRequest.count({
          where: {
            ...leaveBaseWhere,
            ...leaveSearchWhere,
            ...buildPriorityWhere("LOW", stale72Hours, stale24Hours),
          },
        })
      : Promise.resolve(0),
    overtimeFilterEnabled
      ? db.overtimeRequest.count({
          where: {
            ...overtimeBaseWhere,
            ...overtimeSearchWhere,
            ...(buildPriorityWhere("HIGH", stale72Hours, stale24Hours) as Prisma.OvertimeRequestWhereInput),
          },
        })
      : Promise.resolve(0),
    overtimeFilterEnabled
      ? db.overtimeRequest.count({
          where: {
            ...overtimeBaseWhere,
            ...overtimeSearchWhere,
            ...(buildPriorityWhere("MEDIUM", stale72Hours, stale24Hours) as Prisma.OvertimeRequestWhereInput),
          },
        })
      : Promise.resolve(0),
    overtimeFilterEnabled
      ? db.overtimeRequest.count({
          where: {
            ...overtimeBaseWhere,
            ...overtimeSearchWhere,
            ...(buildPriorityWhere("LOW", stale72Hours, stale24Hours) as Prisma.OvertimeRequestWhereInput),
          },
        })
      : Promise.resolve(0),
  ])

  const leaveCountsByPriority: Record<PriorityBucket, number> = {
    HIGH: leaveHighCount,
    MEDIUM: leaveMediumCount,
    LOW: leaveLowCount,
  }

  const overtimeCountsByPriority: Record<PriorityBucket, number> = {
    HIGH: overtimeHighCount,
    MEDIUM: overtimeMediumCount,
    LOW: overtimeLowCount,
  }

  const priorityOrder: PriorityBucket[] = ["HIGH", "MEDIUM", "LOW"]
  const segments: SegmentDefinition[] = []

  for (const priority of priorityOrder) {
    if (leaveFilterEnabled) {
      segments.push({ kind: "LEAVE", priority, count: leaveCountsByPriority[priority] })
    }
    if (overtimeFilterEnabled) {
      segments.push({ kind: "OVERTIME", priority, count: overtimeCountsByPriority[priority] })
    }
  }

  const totalItems = segments.reduce((sum, segment) => sum + segment.count, 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageEnd = pageStart + pageSize

  const segmentWindows: SegmentWindow[] = []
  let offset = 0
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const segmentStart = offset
    const segmentEnd = offset + segment.count

    const overlapStart = Math.max(pageStart, segmentStart)
    const overlapEnd = Math.min(pageEnd, segmentEnd)

    if (overlapEnd > overlapStart) {
      segmentWindows.push({
        ...segment,
        index,
        skip: overlapStart - segmentStart,
        take: overlapEnd - overlapStart,
      })
    }

    offset = segmentEnd
  }

  const leaveWindows = segmentWindows.filter((window) => window.kind === "LEAVE")
  const overtimeWindows = segmentWindows.filter((window) => window.kind === "OVERTIME")

  const [leaveWindowResults, overtimeWindowResults] = await Promise.all([
    Promise.all(
      leaveWindows.map(async (window) => {
        const rows = await db.leaveRequest.findMany({
          where: {
            ...leaveBaseWhere,
            ...leaveSearchWhere,
            ...buildPriorityWhere(window.priority, stale72Hours, stale24Hours),
          },
          orderBy: [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }],
          skip: window.skip,
          take: window.take,
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

        return { index: window.index, rows }
      })
    ),
    Promise.all(
      overtimeWindows.map(async (window) => {
        const rows = await db.overtimeRequest.findMany({
          where: {
            ...overtimeBaseWhere,
            ...overtimeSearchWhere,
            ...(buildPriorityWhere(window.priority, stale72Hours, stale24Hours) as Prisma.OvertimeRequestWhereInput),
          },
          orderBy: [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }],
          skip: window.skip,
          take: window.take,
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

        return { index: window.index, rows }
      })
    ),
  ])

  const leaveRowsBySegmentIndex = new Map(leaveWindowResults.map((entry) => [entry.index, entry.rows]))
  const overtimeRowsBySegmentIndex = new Map(overtimeWindowResults.map((entry) => [entry.index, entry.rows]))

  const overtimeEmployeeIds = Array.from(
    new Set(overtimeWindowResults.flatMap((entry) => entry.rows.map((row) => row.employee.id)))
  )

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

  const items: ApprovalQueueItem[] = []
  for (const window of segmentWindows) {
    if (window.kind === "LEAVE") {
      const rows = leaveRowsBySegmentIndex.get(window.index) ?? []
      for (const item of rows) {
        items.push({
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
          priority: window.priority,
          ctoConversionPreview: false,
        })
      }
      continue
    }

    const rows = overtimeRowsBySegmentIndex.get(window.index) ?? []
    for (const item of rows) {
      items.push({
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
        priority: window.priority,
        ctoConversionPreview:
          !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
      })
    }
  }

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
