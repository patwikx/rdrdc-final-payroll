import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "@/lib/ph-time"
import type {
  EmployeePortalLeaveApprovalDepartmentOption,
  EmployeePortalLeaveApprovalHistoryDetail,
  EmployeePortalLeaveApprovalHistoryPage,
  EmployeePortalLeaveApprovalHistoryRow,
  EmployeePortalLeaveApprovalQueuePage,
  EmployeePortalLeaveApprovalRow,
  EmployeePortalLeaveApprovalTrailStep,
  EmployeePortalLeaveRequestsReadModel,
} from "@/modules/leave/types/employee-portal-leave-types"

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

export async function getEmployeePortalLeaveRequestsReadModel(params: {
  companyId: string
  employeeId: string
  year: number
}): Promise<EmployeePortalLeaveRequestsReadModel> {
  const [leaveRequests, leaveBalances, leaveTypes] = await Promise.all([
    db.leaveRequest.findMany({
      where: {
        employeeId: params.employeeId,
        employee: {
          companyId: params.companyId,
        },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        requestNumber: true,
        leaveTypeId: true,
        isHalfDay: true,
        halfDayPeriod: true,
        startDate: true,
        endDate: true,
        numberOfDays: true,
        reason: true,
        statusCode: true,
        submittedAt: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
        hrApprovedAt: true,
        hrApprovalRemarks: true,
        hrRejectedAt: true,
        hrRejectionReason: true,
        approver: { select: { firstName: true, lastName: true } },
        supervisorApprover: { select: { firstName: true, lastName: true } },
        hrApprover: { select: { firstName: true, lastName: true } },
        rejectionReason: true,
        leaveType: { select: { name: true } },
      },
    }),
    db.leaveBalance.findMany({
      where: {
        employeeId: params.employeeId,
        year: params.year,
        employee: {
          companyId: params.companyId,
        },
      },
      orderBy: { leaveType: { name: "asc" } },
      select: {
        id: true,
        leaveTypeId: true,
        currentBalance: true,
        availableBalance: true,
        creditsEarned: true,
        creditsUsed: true,
        leaveType: { select: { name: true } },
      },
    }),
    db.leaveType.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: params.companyId }, { companyId: null }],
      },
      orderBy: [{ companyId: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isPaid: true,
        requiresApproval: true,
      },
    }),
  ])

  return {
    leaveTypes: leaveTypes.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      isPaid: item.isPaid,
      requiresApproval: item.requiresApproval,
    })),
    leaveBalances: leaveBalances.map((item) => ({
      id: item.id,
      leaveTypeId: item.leaveTypeId,
      leaveTypeName: item.leaveType.name,
      currentBalance: Number(item.currentBalance),
      availableBalance: Number(item.availableBalance),
      creditsEarned: Number(item.creditsEarned),
      creditsUsed: Number(item.creditsUsed),
    })),
    requests: leaveRequests.map((item) => ({
      id: item.id,
      requestNumber: item.requestNumber,
      leaveTypeId: item.leaveTypeId,
      isHalfDay: item.isHalfDay,
      halfDayPeriod: item.halfDayPeriod,
      startDate: dateLabel.format(item.startDate),
      startDateInput: dateInputLabel.format(item.startDate),
      endDate: dateLabel.format(item.endDate),
      endDateInput: dateInputLabel.format(item.endDate),
      numberOfDays: Number(item.numberOfDays),
      reason: item.reason,
      statusCode: item.statusCode,
      leaveTypeName: item.leaveType.name,
      supervisorApproverName: item.supervisorApprover ? `${item.supervisorApprover.firstName} ${item.supervisorApprover.lastName}` : null,
      supervisorApprovedAt: item.supervisorApprovedAt ? dateLabel.format(item.supervisorApprovedAt) : null,
      supervisorApprovalRemarks: item.supervisorApprovalRemarks,
      hrApproverName: item.hrApprover ? `${item.hrApprover.firstName} ${item.hrApprover.lastName}` : null,
      hrApprovedAt: item.hrApprovedAt ? dateLabel.format(item.hrApprovedAt) : null,
      hrApprovalRemarks: item.hrApprovalRemarks,
      hrRejectedAt: item.hrRejectedAt ? dateLabel.format(item.hrRejectedAt) : null,
      hrRejectionReason: item.hrRejectionReason,
      approverName: item.approver ? `${item.approver.firstName} ${item.approver.lastName}` : null,
      rejectionReason: item.rejectionReason,
    })),
  }
}

type LeaveApprovalHistoryStatusFilter = "ALL" | "APPROVED" | "REJECTED" | "SUPERVISOR_APPROVED"
type LeaveApprovalQueueStatusFilter = "ALL" | "PENDING" | "SUPERVISOR_APPROVED"

const toLeaveApprovalRow = (item: {
  id: string
  requestNumber: string
  startDate: Date
  endDate: Date
  numberOfDays: { toString(): string }
  reason: string | null
  statusCode: RequestStatus
  employee: {
    firstName: string
    lastName: string
    employeeNumber: string
    photoUrl: string | null
    departmentId: string | null
    department: {
      name: string
    } | null
  }
  leaveType: {
    name: string
  }
}): EmployeePortalLeaveApprovalRow => {
  return {
    id: item.id,
    requestNumber: item.requestNumber,
    startDate: dateLabel.format(item.startDate),
    endDate: dateLabel.format(item.endDate),
    numberOfDays: Number(item.numberOfDays),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    employeePhotoUrl: item.employee.photoUrl,
    departmentId: item.employee.departmentId,
    departmentName: item.employee.department?.name ?? "Unassigned",
    leaveTypeName: item.leaveType.name,
  }
}

const toLeaveApprovalHistoryRow = (
  item: {
    id: string
    requestNumber: string
    startDate: Date
    endDate: Date
    numberOfDays: { toString(): string }
    reason: string | null
    statusCode: RequestStatus
    updatedAt: Date
    approvedAt: Date | null
    rejectedAt: Date | null
    supervisorApprovedAt: Date | null
    hrApprovedAt: Date | null
    hrRejectedAt: Date | null
    employee: {
      firstName: string
      lastName: string
      employeeNumber: string
      photoUrl: string | null
      departmentId: string | null
      department: {
        name: string
      } | null
    }
    leaveType: {
      name: string
    }
  },
  isHR: boolean
): EmployeePortalLeaveApprovalHistoryRow => {
  const decidedAt = isHR
    ? item.hrApprovedAt ?? item.hrRejectedAt ?? item.approvedAt ?? item.rejectedAt ?? item.updatedAt
    : item.supervisorApprovedAt ?? item.rejectedAt ?? item.updatedAt

  return {
    id: item.id,
    requestNumber: item.requestNumber,
    startDate: dateLabel.format(item.startDate),
    endDate: dateLabel.format(item.endDate),
    numberOfDays: Number(item.numberOfDays),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    employeePhotoUrl: item.employee.photoUrl,
    departmentId: item.employee.departmentId,
    departmentName: item.employee.department?.name ?? "Unassigned",
    leaveTypeName: item.leaveType.name,
    decidedAtIso: decidedAt.toISOString(),
    decidedAtLabel: dateTimeLabel.format(decidedAt),
  }
}

const buildLeaveApprovalQueueWhere = (params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  search: string
  status: LeaveApprovalQueueStatusFilter
  departmentId?: string
}): Prisma.LeaveRequestWhereInput => {
  const where: Prisma.LeaveRequestWhereInput = params.isHR
    ? {
        employee: { companyId: params.companyId },
        statusCode: RequestStatus.SUPERVISOR_APPROVED,
      }
    : {
        employee: { companyId: params.companyId },
        supervisorApproverId: params.approverEmployeeId,
        statusCode: RequestStatus.PENDING,
      }

  if (params.status !== "ALL") {
    where.statusCode = params.status
  }

  const andFilters: Prisma.LeaveRequestWhereInput[] = []

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
          leaveType: {
            name: {
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

export async function getEmployeePortalLeaveApprovalQueuePageReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  page: number
  pageSize: number
  search: string
  status: LeaveApprovalQueueStatusFilter
  departmentId?: string
}): Promise<EmployeePortalLeaveApprovalQueuePage> {
  const where = buildLeaveApprovalQueueWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, requests] = await db.$transaction([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      orderBy: params.isHR ? [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }] : [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: params.pageSize,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  return {
    rows: requests.map((item) => toLeaveApprovalRow(item)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

const buildLeaveApprovalHistoryWhere = (params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  search: string
  status: LeaveApprovalHistoryStatusFilter
  fromDate: string
  toDate: string
  departmentId?: string
}): Prisma.LeaveRequestWhereInput => {
  const where: Prisma.LeaveRequestWhereInput = params.isHR
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
  const andFilters: Prisma.LeaveRequestWhereInput[] = []

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
          leaveType: {
            name: {
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

export async function getEmployeePortalLeaveApprovalHistoryPageReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  page: number
  pageSize: number
  search: string
  status: LeaveApprovalHistoryStatusFilter
  fromDate: string
  toDate: string
  departmentId?: string
}): Promise<EmployeePortalLeaveApprovalHistoryPage> {
  const where = buildLeaveApprovalHistoryWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, historyRequests] = await db.$transaction([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      orderBy: params.isHR ? [{ hrApprovedAt: "desc" }, { hrRejectedAt: "desc" }] : [{ updatedAt: "desc" }],
      skip,
      take: params.pageSize,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
            departmentId: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  return {
    rows: historyRequests.map((item) => toLeaveApprovalHistoryRow(item, params.isHR)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalLeaveApprovalHistoryDetailReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
  requestId: string
}): Promise<EmployeePortalLeaveApprovalHistoryDetail | null> {
  const where: Prisma.LeaveRequestWhereInput = params.isHR
    ? {
        id: params.requestId,
        employee: { companyId: params.companyId },
        statusCode: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
        ...(params.approverEmployeeId ? { hrApproverId: params.approverEmployeeId } : {}),
      }
    : {
        id: params.requestId,
        employee: { companyId: params.companyId },
        supervisorApproverId: params.approverEmployeeId,
        statusCode: {
          in: [RequestStatus.SUPERVISOR_APPROVED, RequestStatus.APPROVED, RequestStatus.REJECTED],
        },
      }

  const request = await db.leaveRequest.findFirst({
    where,
    select: {
      id: true,
      requestNumber: true,
      startDate: true,
      endDate: true,
      numberOfDays: true,
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
          firstName: true,
          lastName: true,
          employeeNumber: true,
          photoUrl: true,
          department: {
            select: {
              name: true,
            },
          },
        },
      },
      leaveType: {
        select: {
          name: true,
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

  const decidedAt = params.isHR
    ? request.hrApprovedAt ?? request.hrRejectedAt ?? request.approvedAt ?? request.rejectedAt ?? request.updatedAt
    : request.supervisorApprovedAt ?? request.rejectedAt ?? request.updatedAt

  const wasRejectedBeforeHr = Boolean(request.rejectedAt && !request.hrRejectedAt && !request.supervisorApprovedAt)

  const supervisorStageStatus: EmployeePortalLeaveApprovalTrailStep["statusCode"] = request.supervisorApprovedAt
    ? "APPROVED"
    : wasRejectedBeforeHr
      ? "REJECTED"
      : request.statusCode === RequestStatus.SUPERVISOR_APPROVED || request.statusCode === RequestStatus.APPROVED
        ? "APPROVED"
        : "PENDING"

  const hrStageStatus: EmployeePortalLeaveApprovalTrailStep["statusCode"] = request.hrApprovedAt
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
    leaveTypeName: request.leaveType.name,
    startDateLabel: dateLabel.format(request.startDate),
    endDateLabel: dateLabel.format(request.endDate),
    numberOfDays: Number(request.numberOfDays),
    reason: request.reason,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    employeeNumber: request.employee.employeeNumber,
    employeePhotoUrl: request.employee.photoUrl,
    departmentName: request.employee.department?.name ?? "Unassigned",
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

export async function getEmployeePortalLeaveApprovalReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
}) {
  const [queuePage, historyPage] = await Promise.all([
    getEmployeePortalLeaveApprovalQueuePageReadModel({
      companyId: params.companyId,
      isHR: params.isHR,
      approverEmployeeId: params.approverEmployeeId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      departmentId: undefined,
    }),
    getEmployeePortalLeaveApprovalHistoryPageReadModel({
      companyId: params.companyId,
      isHR: params.isHR,
      approverEmployeeId: params.approverEmployeeId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      fromDate: "",
      toDate: "",
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

export async function getEmployeePortalLeaveApprovalDepartmentOptions(params: {
  companyId: string
}): Promise<EmployeePortalLeaveApprovalDepartmentOption[]> {
  return db.department.findMany({
    where: {
      companyId: params.companyId,
    },
    orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  })
}
