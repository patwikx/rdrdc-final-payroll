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
import type { EmployeePortalLeaveApprovalHistoryPage } from "@/modules/leave/types/employee-portal-leave-types"
import { getEmployeePortalLeaveApprovalHistoryPageReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"

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
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
})

const hasHrPrivileges = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const findActorEmployee = async (userId: string, companyId: string): Promise<{ id: string } | null> => {
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
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false as const, error: "Employee profile not found." }

  const where = {
    supervisorApproverId: actor.id,
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
  const actor = await findActorEmployee(context.userId, context.companyId)

  if (!isHR && !actor) {
    return { ok: false, error: "Employee profile not found." }
  }

  const historyPage = await getEmployeePortalLeaveApprovalHistoryPageReadModel({
    companyId: context.companyId,
    isHR,
    approverEmployeeId: actor?.id,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  })

  return {
    ok: true,
    data: historyPage,
  }
}

export async function approveLeaveBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<LeaveActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false, error: "Employee profile not found." }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApproverId: actor.id,
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true },
  })

  if (!request) return { ok: false, error: "Leave request not found or no longer pending." }

  await db.leaveRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      supervisorApprovedAt: new Date(),
      supervisorApprovalRemarks: payload.remarks?.trim() || null,
      approverId: actor.id,
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
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false, error: "Employee profile not found." }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApproverId: actor.id,
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      startDate: true,
      leaveType: { select: { isPaid: true } },
    },
  })

  if (!request) return { ok: false, error: "Leave request not found or no longer pending." }

  try {
    await db.$transaction(async (tx) => {
      if (request.leaveType.isPaid) {
        const released = await releaseReservedLeaveBalanceForRequest(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          requestStartDate: request.startDate,
          numberOfDays: Number(request.numberOfDays),
          processedById: context.userId,
        })

        if (!released.ok) {
          throw new Error(released.error)
        }
      }

      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.REJECTED,
          approverId: actor.id,
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

  const actor = await findActorEmployee(context.userId, context.companyId)
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
      startDate: true,
      leaveType: { select: { isPaid: true } },
    },
  })
  if (!request) return { ok: false, error: "Leave request not found or no longer eligible." }

  try {
    await db.$transaction(async (tx) => {
      if (request.leaveType.isPaid) {
        const consumed = await consumeReservedLeaveBalanceForRequest(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          requestStartDate: request.startDate,
          numberOfDays: Number(request.numberOfDays),
          processedById: context.userId,
        })

        if (!consumed.ok) {
          throw new Error(consumed.error)
        }
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

  const actor = await findActorEmployee(context.userId, context.companyId)
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
      startDate: true,
      leaveType: { select: { isPaid: true } },
    },
  })
  if (!request) return { ok: false, error: "Leave request not found or no longer eligible." }

  try {
    await db.$transaction(async (tx) => {
      if (request.leaveType.isPaid) {
        const released = await releaseReservedLeaveBalanceForRequest(tx, {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          requestStartDate: request.startDate,
          numberOfDays: Number(request.numberOfDays),
          processedById: context.userId,
        })

        if (!released.ok) {
          throw new Error(released.error)
        }
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
