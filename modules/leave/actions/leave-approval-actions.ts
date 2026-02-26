"use server"

import { RequestStatus } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  consumeReservedLeaveBalanceForRequest,
  releaseReservedLeaveBalanceForRequest,
} from "@/modules/leave/utils/leave-balance-ledger"
import type { LeaveActionDataResult, LeaveActionResult } from "@/modules/leave/types/leave-action-result"
import type {
  EmployeePortalLeaveApprovalHistoryPage,
  EmployeePortalLeaveApprovalQueuePage,
} from "@/modules/leave/types/employee-portal-leave-types"
import {
  getEmployeePortalLeaveApprovalHistoryPageReadModel,
  getEmployeePortalLeaveApprovalQueuePageReadModel,
} from "@/modules/leave/utils/employee-portal-leave-read-models"

const pagingSchema = z.object({
  companyId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
})

const decisionSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  remarks: z.string().trim().max(1000).optional(),
})

const historyPageSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "APPROVED", "REJECTED", "SUPERVISOR_APPROVED"]).default("ALL"),
  filterCompanyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
})

const queuePageSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "PENDING", "SUPERVISOR_APPROVED"]).default("ALL"),
  filterCompanyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
})

const hasHrPrivileges = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const getActiveCompanyScopesForUser = async (userId: string): Promise<Array<{ companyId: string; role: string }>> => {
  const accessRows = await db.userCompanyAccess.findMany({
    where: {
      userId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    select: {
      companyId: true,
      role: true,
    },
  })

  const uniqueByCompanyId = new Map<string, { companyId: string; role: string }>()
  for (const row of accessRows) {
    if (!uniqueByCompanyId.has(row.companyId)) {
      uniqueByCompanyId.set(row.companyId, { companyId: row.companyId, role: row.role })
    }
  }

  return Array.from(uniqueByCompanyId.values())
}

const findActorEmployeeInCompany = async (userId: string, companyId: string): Promise<{ id: string } | null> => {
  return db.employee.findFirst({
    where: {
      userId,
      companyId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  })
}

export async function getLeaveRequestsForApprovalAction(input: z.input<typeof pagingSchema>) {
  const parsed = pagingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const where = {
    supervisorApprover: {
      is: {
        userId: context.userId,
        deletedAt: null,
        isActive: true,
      },
    },
    statusCode: RequestStatus.PENDING,
    employee: { companyId: context.companyId },
  }

  const [total, data] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (payload.page - 1) * payload.pageSize,
      take: payload.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
            isPaid: true,
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
    }),
  ])

  return { ok: true as const, data: { data, total } }
}

export async function getLeaveRequestsForHrApprovalAction(input: z.input<typeof pagingSchema>) {
  const parsed = pagingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false as const, error: "Only HR or admins can access this queue." }
  }

  const where = {
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
    employee: { companyId: context.companyId },
  }

  const [total, data] = await Promise.all([
    db.leaveRequest.count({ where }),
    db.leaveRequest.findMany({
      where,
      orderBy: [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }],
      skip: (payload.page - 1) * payload.pageSize,
      take: payload.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
            isPaid: true,
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
    }),
  ])

  return { ok: true as const, data: { data, total } }
}

export async function getLeaveApprovalHistoryPageAction(
  input: z.input<typeof historyPageSchema>
): Promise<LeaveActionDataResult<EmployeePortalLeaveApprovalHistoryPage>> {
  const parsed = historyPageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid approval history payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const isHR = hasHrPrivileges(context.companyRole as CompanyRole)
  const companyScopes = await getActiveCompanyScopesForUser(context.userId)
  const approverCompanyIds = companyScopes.map((scope) => scope.companyId)
  const hrCompanyIds = companyScopes
    .filter((scope) => hasHrPrivileges(scope.role as CompanyRole))
    .map((scope) => scope.companyId)
  const scopedCompanyIds = isHR ? hrCompanyIds : approverCompanyIds

  if (payload.filterCompanyId && !scopedCompanyIds.includes(payload.filterCompanyId)) {
    return { ok: false, error: "Invalid company filter for this approver context." }
  }

  const historyPage = await getEmployeePortalLeaveApprovalHistoryPageReadModel({
    companyIds: scopedCompanyIds,
    isHR,
    approverUserId: context.userId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    filterCompanyId: payload.filterCompanyId,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    departmentId: payload.departmentId,
  })

  return {
    ok: true,
    data: historyPage,
  }
}

export async function getLeaveApprovalQueuePageAction(
  input: z.input<typeof queuePageSchema>
): Promise<LeaveActionDataResult<EmployeePortalLeaveApprovalQueuePage>> {
  const parsed = queuePageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid approval queue payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const isHR = hasHrPrivileges(context.companyRole as CompanyRole)
  const companyScopes = await getActiveCompanyScopesForUser(context.userId)
  const approverCompanyIds = companyScopes.map((scope) => scope.companyId)
  const hrCompanyIds = companyScopes
    .filter((scope) => hasHrPrivileges(scope.role as CompanyRole))
    .map((scope) => scope.companyId)
  const scopedCompanyIds = isHR ? hrCompanyIds : approverCompanyIds

  if (payload.filterCompanyId && !scopedCompanyIds.includes(payload.filterCompanyId)) {
    return { ok: false, error: "Invalid company filter for this approver context." }
  }

  const queuePage = await getEmployeePortalLeaveApprovalQueuePageReadModel({
    companyIds: scopedCompanyIds,
    isHR,
    approverUserId: context.userId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    filterCompanyId: payload.filterCompanyId,
    departmentId: payload.departmentId,
  })

  return {
    ok: true,
    data: queuePage,
  }
}

export async function approveLeaveBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<LeaveActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApprover: {
        is: {
          userId: context.userId,
          deletedAt: null,
          isActive: true,
        },
      },
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true, supervisorApproverId: true },
  })

  if (!request) return { ok: false, error: "Leave request not found or no longer pending." }

  await db.leaveRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      supervisorApprovedAt: new Date(),
      supervisorApprovalRemarks: payload.remarks?.trim() || null,
      approverId: request.supervisorApproverId ?? null,
      approvedAt: new Date(),
      approvalRemarks: payload.remarks?.trim() || null,
    },
  })

  return { ok: true, message: "Leave request approved." }
}

export async function rejectLeaveBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<LeaveActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApprover: {
        is: {
          userId: context.userId,
          deletedAt: null,
          isActive: true,
        },
      },
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      supervisorApproverId: true,
      requestNumber: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      numberOfHours: true,
      startDate: true,
    },
  })

  if (!request) return { ok: false, error: "Leave request not found or no longer pending." }

  try {
    await db.$transaction(async (tx) => {
      const released = await releaseReservedLeaveBalanceForRequest(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        requestId: request.id,
        requestNumber: request.requestNumber,
        requestStartDate: request.startDate,
        numberOfDays: Number(request.numberOfDays),
        numberOfHours: request.numberOfHours ? Number(request.numberOfHours) : null,
        processedById: context.userId,
      })

      if (!released.ok) {
        throw new Error(released.error)
      }

      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.REJECTED,
          approverId: request.supervisorApproverId ?? null,
          rejectedAt: new Date(),
          rejectionReason: payload.remarks?.trim() || "Rejected by supervisor",
        },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reject leave request: ${message}` }
  }

  return { ok: true, message: "Leave request rejected." }
}

export async function approveLeaveByHrAction(input: z.input<typeof decisionSchema>): Promise<LeaveActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false, error: "Only HR or admins can approve this request." }
  }

  const actor = await findActorEmployeeInCompany(context.userId, context.companyId)
  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      numberOfHours: true,
      startDate: true,
    },
  })
  if (!request) return { ok: false, error: "Leave request not found or no longer eligible." }

  try {
    await db.$transaction(async (tx) => {
      const consumed = await consumeReservedLeaveBalanceForRequest(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        requestId: request.id,
        requestNumber: request.requestNumber,
        requestStartDate: request.startDate,
        numberOfDays: Number(request.numberOfDays),
        numberOfHours: request.numberOfHours ? Number(request.numberOfHours) : null,
        processedById: context.userId,
      })

      if (!consumed.ok) {
        throw new Error(consumed.error)
      }

      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.APPROVED,
          hrApproverId: actor?.id ?? null,
          hrApprovedAt: new Date(),
          hrApprovalRemarks: payload.remarks?.trim() || null,
          approverId: actor?.id ?? null,
          approvedAt: new Date(),
          approvalRemarks: payload.remarks?.trim() || null,
        },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to approve leave request: ${message}` }
  }

  return { ok: true, message: "Leave request approved." }
}

export async function rejectLeaveByHrAction(input: z.input<typeof decisionSchema>): Promise<LeaveActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false, error: "Only HR or admins can reject this request." }
  }

  const actor = await findActorEmployeeInCompany(context.userId, context.companyId)
  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      numberOfHours: true,
      startDate: true,
    },
  })
  if (!request) return { ok: false, error: "Leave request not found or no longer eligible." }

  try {
    await db.$transaction(async (tx) => {
      const released = await releaseReservedLeaveBalanceForRequest(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        requestId: request.id,
        requestNumber: request.requestNumber,
        requestStartDate: request.startDate,
        numberOfDays: Number(request.numberOfDays),
        numberOfHours: request.numberOfHours ? Number(request.numberOfHours) : null,
        processedById: context.userId,
      })

      if (!released.ok) {
        throw new Error(released.error)
      }

      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.REJECTED,
          hrApproverId: actor?.id ?? null,
          hrRejectedAt: new Date(),
          hrRejectionReason: payload.remarks?.trim() || "Rejected by approver",
          rejectedAt: new Date(),
          rejectionReason: payload.remarks?.trim() || "Rejected by approver",
        },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reject leave request: ${message}` }
  }

  return { ok: true, message: "Leave request rejected." }
}
