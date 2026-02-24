import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "@/lib/ph-time"
import { overtimeDateInputSchema, overtimeTimeInputSchema } from "@/modules/overtime/schemas/overtime-domain-schemas"
import type {
  EmployeePortalOvertimeApprovalDepartmentOption,
  EmployeePortalOvertimeApprovalHistoryDetail,
  EmployeePortalOvertimeApprovalHistoryPage,
  EmployeePortalOvertimeApprovalHistoryRow,
  EmployeePortalOvertimeApprovalQueuePage,
  EmployeePortalOvertimeApprovalRow,
  EmployeePortalOvertimeApprovalTrailStep,
  EmployeePortalOvertimeRequestRow,
} from "@/modules/overtime/types/overtime-domain-types"

export const parseOvertimeDateInput = (value: string): Date | null => {
  const parsed = overtimeDateInputSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  const converted = parsePhDateInputToUtcDateOnly(parsed.data)
  return converted
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

const dateInputLabel = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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
type OvertimeApprovalQueueStatusFilter = "ALL" | "PENDING" | "SUPERVISOR_APPROVED"

const getDirectReportCountByManagerId = async (companyIds: string[], managerIds: string[]): Promise<Map<string, number>> => {
  const directReportCounts =
    companyIds.length > 0 && managerIds.length > 0
      ? await db.employee.groupBy({
          by: ["reportingManagerId"],
          where: {
            companyId: {
              in: companyIds,
            },
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
      companyId: string
      company: {
        name: string
      } | null
      firstName: string
      lastName: string
      employeeNumber: string
      isOvertimeEligible: boolean
      photoUrl: string | null
      departmentId: string | null
      department: {
        name: string
      } | null
    }
  },
  directReportCountByManagerId: Map<string, number>
): EmployeePortalOvertimeApprovalRow => {
  return {
    id: item.id,
    companyId: item.employee.companyId,
    companyName: item.employee.company?.name ?? "Unknown Company",
    requestNumber: item.requestNumber,
    overtimeDate: dateLabel.format(item.overtimeDate),
    hours: Number(item.hours),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    employeePhotoUrl: item.employee.photoUrl,
    departmentId: item.employee.departmentId,
    departmentName: item.employee.department?.name ?? "Unassigned",
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
      companyId: string
      company: {
        name: string
      } | null
      firstName: string
      lastName: string
      employeeNumber: string
      isOvertimeEligible: boolean
      photoUrl: string | null
      departmentId: string | null
      department: {
        name: string
      } | null
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

const buildOvertimeApprovalQueueWhere = (params: {
  companyIds: string[]
  isHR: boolean
  approverUserId: string
  search: string
  status: OvertimeApprovalQueueStatusFilter
  filterCompanyId?: string
  departmentId?: string
}): Prisma.OvertimeRequestWhereInput => {
  const where: Prisma.OvertimeRequestWhereInput = params.isHR
    ? {
        employee: {
          companyId: {
            in: params.companyIds,
          },
        },
        statusCode: RequestStatus.SUPERVISOR_APPROVED,
      }
    : {
        employee: {
          companyId: {
            in: params.companyIds,
          },
        },
        supervisorApprover: {
          is: {
            userId: params.approverUserId,
            deletedAt: null,
            isActive: true,
          },
        },
        statusCode: RequestStatus.PENDING,
      }

  if (params.status !== "ALL") {
    where.statusCode = params.status
  }

  const andFilters: Prisma.OvertimeRequestWhereInput[] = []

  if (params.filterCompanyId) {
    andFilters.push({
      employee: {
        companyId: params.filterCompanyId,
      },
    })
  }

  if (params.departmentId) {
    andFilters.push({
      employee: {
        departmentId: params.departmentId,
      },
    })
  }

  const query = params.search.trim()
  if (query.length > 0) {
    andFilters.push({
      OR: [
        {
          requestNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          employee: {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            employeeNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          employee: {
            department: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          reason: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  return where
}

export async function getEmployeePortalOvertimeApprovalQueuePageReadModel(params: {
  companyIds: string[]
  isHR: boolean
  approverUserId: string
  page: number
  pageSize: number
  search: string
  status: OvertimeApprovalQueueStatusFilter
  filterCompanyId?: string
  departmentId?: string
}): Promise<EmployeePortalOvertimeApprovalQueuePage> {
  const where = buildOvertimeApprovalQueueWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, requests] = await db.$transaction([
    db.overtimeRequest.count({ where }),
    db.overtimeRequest.findMany({
      where,
      orderBy: params.isHR ? [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }] : [{ createdAt: "asc" }],
      skip,
      take: params.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            company: {
              select: {
                name: true,
              },
            },
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
            photoUrl: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ])

  const directReportCountByManagerId = await getDirectReportCountByManagerId(
    params.companyIds,
    requests.map((item) => item.employee.id)
  )

  return {
    rows: requests.map((item) => toOvertimeApprovalRow(item, directReportCountByManagerId)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

const buildOvertimeApprovalHistoryWhere = (params: {
  companyIds: string[]
  isHR: boolean
  approverUserId: string
  search: string
  status: OvertimeApprovalHistoryStatusFilter
  departmentId?: string
  fromDate: string
  toDate: string
  filterCompanyId?: string
}): Prisma.OvertimeRequestWhereInput => {
  const where: Prisma.OvertimeRequestWhereInput = params.isHR
    ? {
        employee: {
          companyId: {
            in: params.companyIds,
          },
        },
        statusCode: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
        hrApprover: {
          is: {
            userId: params.approverUserId,
            deletedAt: null,
            isActive: true,
          },
        },
      }
    : {
        employee: {
          companyId: {
            in: params.companyIds,
          },
        },
        supervisorApprover: {
          is: {
            userId: params.approverUserId,
            deletedAt: null,
            isActive: true,
          },
        },
        statusCode: {
          in: [RequestStatus.SUPERVISOR_APPROVED, RequestStatus.APPROVED, RequestStatus.REJECTED],
        },
      }

  if (params.status !== "ALL") {
    where.statusCode = params.status
  }

  const search = params.search.trim()
  const andFilters: Prisma.OvertimeRequestWhereInput[] = []

  if (params.filterCompanyId) {
    andFilters.push({
      employee: {
        companyId: params.filterCompanyId,
      },
    })
  }

  if (params.departmentId) {
    andFilters.push({
      employee: {
        departmentId: params.departmentId,
      },
    })
  }

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
          employee: {
            department: {
              name: {
                contains: search,
                mode: "insensitive",
              },
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
  companyIds: string[]
  isHR: boolean
  approverUserId: string
  page: number
  pageSize: number
  search: string
  status: OvertimeApprovalHistoryStatusFilter
  departmentId?: string
  fromDate: string
  toDate: string
  filterCompanyId?: string
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
            companyId: true,
            company: {
              select: {
                name: true,
              },
            },
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
            photoUrl: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ])

  const directReportCountByManagerId = await getDirectReportCountByManagerId(
    params.companyIds,
    historyRequests.map((item) => item.employee.id)
  )

  return {
    rows: historyRequests.map((item) => toOvertimeApprovalHistoryRow(item, params.isHR, directReportCountByManagerId)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalOvertimeApprovalHistoryDetailReadModel(params: {
  companyId: string
  isHR: boolean
  approverUserId: string
  requestId: string
}): Promise<EmployeePortalOvertimeApprovalHistoryDetail | null> {
  const where: Prisma.OvertimeRequestWhereInput = params.isHR
    ? {
        id: params.requestId,
        employee: { companyId: params.companyId },
        statusCode: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
        hrApprover: {
          is: {
            userId: params.approverUserId,
            deletedAt: null,
            isActive: true,
          },
        },
      }
    : {
        id: params.requestId,
        employee: { companyId: params.companyId },
        supervisorApprover: {
          is: {
            userId: params.approverUserId,
            deletedAt: null,
            isActive: true,
          },
        },
        statusCode: {
          in: [RequestStatus.SUPERVISOR_APPROVED, RequestStatus.APPROVED, RequestStatus.REJECTED],
        },
      }

  const request = await db.overtimeRequest.findFirst({
    where,
    select: {
      id: true,
      requestNumber: true,
      overtimeDate: true,
      hours: true,
      reason: true,
      statusCode: true,
      updatedAt: true,
      approvedAt: true,
      rejectedAt: true,
      rejectionReason: true,
      supervisorApprovedAt: true,
      supervisorApprovalRemarks: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          isOvertimeEligible: true,
          photoUrl: true,
          department: {
            select: {
              name: true,
            },
          },
        },
      },
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

  if (!request) {
    return null
  }

  const directReportCountByManagerId = await getDirectReportCountByManagerId([params.companyId], [request.employee.id])
  const ctoConversionPreview =
    !request.employee.isOvertimeEligible || (directReportCountByManagerId.get(request.employee.id) ?? 0) > 0

  const decidedAt = params.isHR
    ? request.hrApprovedAt ?? request.hrRejectedAt ?? request.approvedAt ?? request.rejectedAt ?? request.updatedAt
    : request.supervisorApprovedAt ?? request.rejectedAt ?? request.updatedAt

  const wasRejectedBeforeHr = Boolean(request.rejectedAt && !request.hrRejectedAt && !request.supervisorApprovedAt)

  const supervisorStageStatus: EmployeePortalOvertimeApprovalTrailStep["statusCode"] = request.supervisorApprovedAt
    ? "APPROVED"
    : wasRejectedBeforeHr
      ? "REJECTED"
      : request.statusCode === RequestStatus.SUPERVISOR_APPROVED || request.statusCode === RequestStatus.APPROVED
        ? "APPROVED"
        : "PENDING"

  const hrStageStatus: EmployeePortalOvertimeApprovalTrailStep["statusCode"] = request.hrApprovedAt
    ? "APPROVED"
    : request.hrRejectedAt
      ? "REJECTED"
      : wasRejectedBeforeHr
        ? "NOT_REACHED"
        : request.statusCode === RequestStatus.SUPERVISOR_APPROVED
          ? "PENDING"
          : request.statusCode === RequestStatus.APPROVED
            ? "APPROVED"
            : "PENDING"

  const supervisorApproverName = request.supervisorApprover
    ? `${request.supervisorApprover.firstName} ${request.supervisorApprover.lastName}`
    : null
  const hrApproverName = request.hrApprover
    ? `${request.hrApprover.firstName} ${request.hrApprover.lastName}`
    : null

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    statusCode: request.statusCode,
    overtimeDateLabel: dateLabel.format(request.overtimeDate),
    hours: Number(request.hours),
    reason: request.reason,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    employeeNumber: request.employee.employeeNumber,
    employeePhotoUrl: request.employee.photoUrl,
    departmentName: request.employee.department?.name ?? "Unassigned",
    ctoConversionPreview,
    decidedAtLabel: dateTimeLabel.format(decidedAt),
    approvalTrail: [
      {
        id: `${request.id}-supervisor`,
        stageLabel: "Supervisor Review",
        approverName: supervisorApproverName,
        statusCode: supervisorStageStatus,
        actedAtLabel: request.supervisorApprovedAt
          ? dateTimeLabel.format(request.supervisorApprovedAt)
          : wasRejectedBeforeHr && request.rejectedAt
            ? dateTimeLabel.format(request.rejectedAt)
            : null,
        remarks: request.supervisorApprovedAt
          ? request.supervisorApprovalRemarks
          : wasRejectedBeforeHr
            ? request.rejectionReason
            : null,
      },
      {
        id: `${request.id}-hr`,
        stageLabel: "HR Final Review",
        approverName: hrApproverName,
        statusCode: hrStageStatus,
        actedAtLabel: request.hrApprovedAt
          ? dateTimeLabel.format(request.hrApprovedAt)
          : request.hrRejectedAt
            ? dateTimeLabel.format(request.hrRejectedAt)
            : null,
        remarks: request.hrApprovedAt
          ? request.hrApprovalRemarks
          : request.hrRejectedAt
            ? request.hrRejectionReason ?? request.rejectionReason
            : null,
      },
    ],
  }
}

export async function getEmployeePortalOvertimeRequestsReadModel(params: {
  employeeId: string
}): Promise<EmployeePortalOvertimeRequestRow[]> {
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
    overtimeDateInput: dateInputLabel.format(item.overtimeDate),
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
  companyIds: string[]
  isHR: boolean
  approverUserId: string
}) {
  const [queuePage, historyPage] = await Promise.all([
    getEmployeePortalOvertimeApprovalQueuePageReadModel({
      companyIds: params.companyIds,
      isHR: params.isHR,
      approverUserId: params.approverUserId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      filterCompanyId: undefined,
      departmentId: undefined,
    }),
    getEmployeePortalOvertimeApprovalHistoryPageReadModel({
      companyIds: params.companyIds,
      isHR: params.isHR,
      approverUserId: params.approverUserId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      fromDate: "",
      toDate: "",
      filterCompanyId: undefined,
      departmentId: undefined,
    }),
  ])

  return {
    rows: queuePage.rows,
    queueTotal: queuePage.total,
    queuePage: queuePage.page,
    queuePageSize: queuePage.pageSize,
    historyRows: historyPage.rows,
    historyTotal: historyPage.total,
    historyPage: historyPage.page,
    historyPageSize: historyPage.pageSize,
  }
}

export async function getEmployeePortalOvertimeApprovalDepartmentOptions(params: {
  companyId?: string
  companyIds?: string[]
}): Promise<EmployeePortalOvertimeApprovalDepartmentOption[]> {
  const normalizedCompanyIds = (
    params.companyIds?.length ? params.companyIds : params.companyId ? [params.companyId] : []
  ).filter((companyId) => companyId.trim().length > 0)

  if (normalizedCompanyIds.length === 0) {
    return []
  }

  return db.department.findMany({
    where: {
      companyId: {
        in: normalizedCompanyIds,
      },
    },
    orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      companyId: true,
      name: true,
      isActive: true,
    },
  })
}
