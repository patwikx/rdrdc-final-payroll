import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "@/lib/ph-time"
import { overtimeDateInputSchema, overtimeTimeInputSchema } from "@/modules/overtime/schemas/overtime-domain-schemas"
import type {
  EmployeePortalOvertimeApprovalHistoryPage,
  EmployeePortalOvertimeApprovalHistoryRow,
  EmployeePortalOvertimeApprovalRow,
} from "@/modules/overtime/types/overtime-domain-types"

export const parseOvertimeDateInput = (value: string): Date => {
  const parsed = overtimeDateInputSchema.parse(value)
  const [year, month, day] = parsed.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

export const parseOvertimeTimeInput = (value: string): Date => {
  const parsed = overtimeTimeInputSchema.parse(value)
  const [hour, minute] = parsed.split(":").map((part) => Number(part))
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0))
}

export const calculateOvertimeDurationHours = (start: string, end: string): number => {
  const parsedStart = overtimeTimeInputSchema.parse(start)
  const parsedEnd = overtimeTimeInputSchema.parse(end)
  const [startHour, startMinute] = parsedStart.split(":").map((part) => Number(part))
  const [endHour, endMinute] = parsedEnd.split(":").map((part) => Number(part))
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  return (endMinutes - startMinutes) / 60
}

export const generateOvertimeRequestNumber = async (): Promise<string> => {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(new Date())
    .replace(/-/g, "")

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")
    const candidate = `OT-${stamp}-${suffix}`
    const exists = await db.overtimeRequest.findUnique({ where: { requestNumber: candidate }, select: { id: true } })
    if (!exists) return candidate
  }

  throw new Error("REQUEST_NUMBER_GENERATION_FAILED")
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const dateTimeLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

type OvertimeApprovalHistoryStatusFilter = "ALL" | "APPROVED" | "REJECTED" | "SUPERVISOR_APPROVED"

const getDirectReportCountByManagerId = async (companyId: string, managerIds: string[]): Promise<Map<string, number>> => {
  const directReportCounts =
    managerIds.length > 0
      ? await db.employee.groupBy({
          by: ["reportingManagerId"],
          where: {
            companyId,
            deletedAt: null,
            isActive: true,
            reportingManagerId: { in: managerIds },
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

  return directReportCountByManagerId
}

const toOvertimeApprovalRow = (
  item: {
    id: string
    requestNumber: string
    overtimeDate: Date
    hours: { toString(): string }
    reason: string | null
    statusCode: RequestStatus
    employee: {
      id: string
      firstName: string
      lastName: string
      employeeNumber: string
      isOvertimeEligible: boolean
    }
  },
  directReportCountByManagerId: Map<string, number>
): EmployeePortalOvertimeApprovalRow => {
  return {
    id: item.id,
    requestNumber: item.requestNumber,
    overtimeDate: dateLabel.format(item.overtimeDate),
    hours: Number(item.hours),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    ctoConversionPreview:
      !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
  }
}

const toOvertimeApprovalHistoryRow = (
  item: {
    id: string
    requestNumber: string
    overtimeDate: Date
    hours: { toString(): string }
    reason: string | null
    statusCode: RequestStatus
    updatedAt: Date
    approvedAt: Date | null
    rejectedAt: Date | null
    supervisorApprovedAt: Date | null
    hrApprovedAt: Date | null
    hrRejectedAt: Date | null
    employee: {
      id: string
      firstName: string
      lastName: string
      employeeNumber: string
      isOvertimeEligible: boolean
    }
  },
  isHR: boolean,
  directReportCountByManagerId: Map<string, number>
): EmployeePortalOvertimeApprovalHistoryRow => {
  const decidedAt = isHR
    ? item.hrApprovedAt ?? item.hrRejectedAt ?? item.approvedAt ?? item.rejectedAt ?? item.updatedAt
    : item.supervisorApprovedAt ?? item.rejectedAt ?? item.updatedAt

  return {
    ...toOvertimeApprovalRow(item, directReportCountByManagerId),
    decidedAtIso: decidedAt.toISOString(),
    decidedAtLabel: dateTimeLabel.format(decidedAt),
  }
}

const buildOvertimeApprovalHistoryWhere = (params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  search: string
  status: OvertimeApprovalHistoryStatusFilter
  fromDate: string
  toDate: string
}): Prisma.OvertimeRequestWhereInput => {
  const where: Prisma.OvertimeRequestWhereInput = params.isHR
    ? {
        employee: { companyId: params.companyId },
        statusCode: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
        ...(params.approverEmployeeId ? { hrApproverId: params.approverEmployeeId } : {}),
      }
    : {
        employee: { companyId: params.companyId },
        supervisorApproverId: params.approverEmployeeId,
        statusCode: {
          in: [RequestStatus.SUPERVISOR_APPROVED, RequestStatus.APPROVED, RequestStatus.REJECTED],
        },
      }

  if (params.status !== "ALL") {
    where.statusCode = params.status
  }

  const search = params.search.trim()
  const andFilters: Prisma.OvertimeRequestWhereInput[] = []
  if (search.length > 0) {
    andFilters.push({
      OR: [
        {
          requestNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          employee: {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            employeeNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          reason: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    })
  }

  const fromInstant = params.fromDate ? toPhDayStartUtcInstant(params.fromDate) : null
  const toInstant = params.toDate ? toPhDayEndUtcInstant(params.toDate) : null
  if (fromInstant || toInstant) {
    const range: Prisma.DateTimeFilter = {}
    if (fromInstant) {
      range.gte = fromInstant
    }
    if (toInstant) {
      range.lte = toInstant
    }

    andFilters.push({
      OR: params.isHR
        ? [
            { hrApprovedAt: range },
            { hrRejectedAt: range },
            { approvedAt: range },
            { rejectedAt: range },
            { updatedAt: range },
          ]
        : [{ supervisorApprovedAt: range }, { rejectedAt: range }, { updatedAt: range }],
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  return where
}

export async function getEmployeePortalOvertimeApprovalHistoryPageReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  page: number
  pageSize: number
  search: string
  status: OvertimeApprovalHistoryStatusFilter
  fromDate: string
  toDate: string
}): Promise<EmployeePortalOvertimeApprovalHistoryPage> {
  const where = buildOvertimeApprovalHistoryWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, historyRequests] = await db.$transaction([
    db.overtimeRequest.count({ where }),
    db.overtimeRequest.findMany({
      where,
      orderBy: params.isHR ? [{ hrApprovedAt: "desc" }, { hrRejectedAt: "desc" }] : [{ updatedAt: "desc" }],
      skip,
      take: params.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
          },
        },
      },
    }),
  ])

  const directReportCountByManagerId = await getDirectReportCountByManagerId(
    params.companyId,
    historyRequests.map((item) => item.employee.id)
  )

  return {
    rows: historyRequests.map((item) => toOvertimeApprovalHistoryRow(item, params.isHR, directReportCountByManagerId)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalOvertimeRequestsReadModel(params: {
  employeeId: string
}) {
  const requests = await db.overtimeRequest.findMany({
    where: { employeeId: params.employeeId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      requestNumber: true,
      overtimeDate: true,
      startTime: true,
      endTime: true,
      hours: true,
      reason: true,
      statusCode: true,
      supervisorApprovedAt: true,
      supervisorApprovalRemarks: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
      supervisorApprover: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      hrApprover: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return requests.map((item) => ({
    id: item.id,
    requestNumber: item.requestNumber,
    overtimeDate: dateLabel.format(item.overtimeDate),
    startTime: item.startTime.toISOString(),
    endTime: item.endTime.toISOString(),
    hours: Number(item.hours),
    reason: item.reason,
    statusCode: item.statusCode,
    supervisorApproverName: item.supervisorApprover ? `${item.supervisorApprover.firstName} ${item.supervisorApprover.lastName}` : null,
    supervisorApprovedAt: item.supervisorApprovedAt ? dateLabel.format(item.supervisorApprovedAt) : null,
    supervisorApprovalRemarks: item.supervisorApprovalRemarks,
    hrApproverName: item.hrApprover ? `${item.hrApprover.firstName} ${item.hrApprover.lastName}` : null,
    hrApprovedAt: item.hrApprovedAt ? dateLabel.format(item.hrApprovedAt) : null,
    hrApprovalRemarks: item.hrApprovalRemarks,
    hrRejectedAt: item.hrRejectedAt ? dateLabel.format(item.hrRejectedAt) : null,
    hrRejectionReason: item.hrRejectionReason,
  }))
}

export async function getEmployeePortalOvertimeApprovalReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
}) {
  const [requests, historyPage] = await Promise.all([
    db.overtimeRequest.findMany({
      where: params.isHR
        ? {
            statusCode: RequestStatus.SUPERVISOR_APPROVED,
            employee: { companyId: params.companyId },
          }
        : {
            statusCode: RequestStatus.PENDING,
            supervisorApproverId: params.approverEmployeeId,
            employee: { companyId: params.companyId },
          },
      orderBy: params.isHR ? [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }] : [{ createdAt: "asc" }],
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
          },
        },
      },
      take: 100,
    }),
    getEmployeePortalOvertimeApprovalHistoryPageReadModel({
      companyId: params.companyId,
      isHR: params.isHR,
      approverEmployeeId: params.approverEmployeeId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      fromDate: "",
      toDate: "",
    }),
  ])

  const directReportCountByManagerId = await getDirectReportCountByManagerId(
    params.companyId,
    requests.map((item) => item.employee.id)
  )

  return {
    rows: requests.map((item) => toOvertimeApprovalRow(item, directReportCountByManagerId)),
    historyRows: historyPage.rows,
    historyTotal: historyPage.total,
    historyPage: historyPage.page,
    historyPageSize: historyPage.pageSize,
  }
}
