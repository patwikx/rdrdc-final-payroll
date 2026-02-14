import { RequestStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDayEndUtcInstant, toPhDayStartUtcInstant } from "@/lib/ph-time"
import type {
  EmployeePortalLeaveApprovalHistoryPage,
  EmployeePortalLeaveApprovalHistoryRow,
  EmployeePortalLeaveApprovalRow,
  EmployeePortalLeaveRequestsReadModel,
} from "@/modules/leave/types/employee-portal-leave-types"

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
      isHalfDay: item.isHalfDay,
      halfDayPeriod: item.halfDayPeriod,
      startDate: dateLabel.format(item.startDate),
      endDate: dateLabel.format(item.endDate),
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
    leaveTypeName: item.leaveType.name,
    decidedAtIso: decidedAt.toISOString(),
    decidedAtLabel: dateTimeLabel.format(decidedAt),
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

export async function getEmployeePortalLeaveApprovalReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
}) {
  const [requests, historyPage] = await Promise.all([
    db.leaveRequest.findMany({
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
      orderBy: params.isHR ? [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }] : [{ submittedAt: "asc" }, { createdAt: "asc" }],
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
      take: 100,
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
    }),
  ])

  return {
    rows: requests.map((item) => toLeaveApprovalRow(item)),
    historyRows: historyPage.rows,
    historyTotal: historyPage.total,
    historyPage: historyPage.page,
    historyPageSize: historyPage.pageSize,
  }
}
