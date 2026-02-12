"use server"

import { revalidatePath } from "next/cache"

import { RequestStatus } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  consumeReservedLeaveBalanceForRequest,
  releaseReservedLeaveBalanceForRequest,
} from "@/modules/leave/utils/leave-balance-ledger"
import { applyCtoCreditForApprovedOvertime } from "@/modules/employee-portal/utils/cto-conversion"
import {
  approveApprovalQueueRequestInputSchema,
  rejectApprovalQueueRequestInputSchema,
  type ApproveApprovalQueueRequestInput,
  type RejectApprovalQueueRequestInput,
} from "@/modules/approvals/queue/schemas/approval-queue-actions-schema"

type FinalizeApprovalQueueRequestActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const FINAL_HR_ROLES = new Set<CompanyRole>(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"])

const hasFinalHrApprovalAccess = (companyRole: CompanyRole, isSuperAdmin: boolean): boolean => {
  if (isSuperAdmin) return true
  return FINAL_HR_ROLES.has(companyRole)
}

const getHrActorEmployeeId = async (companyId: string, userId: string): Promise<string | null> => {
  const employee = await db.employee.findFirst({
    where: {
      companyId,
      userId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  })

  return employee?.id ?? null
}

export async function approveLeaveRequestByHrAction(
  input: ApproveApprovalQueueRequestInput
): Promise<FinalizeApprovalQueueRequestActionResult> {
  const parsed = approveApprovalQueueRequestInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasFinalHrApprovalAccess(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can finalize requests." }
  }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      leaveTypeId: true,
      numberOfDays: true,
      startDate: true,
      leaveType: { select: { isPaid: true } },
      hrApproverId: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
      employeeId: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Leave request not found in the active company." }
  }

  if (request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
    return { ok: false, error: "Only supervisor-approved leave requests can be finalized." }
  }

  const hrApproverId = await getHrActorEmployeeId(context.companyId, context.userId)
  const approvedAt = new Date()

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

      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.APPROVED,
          hrApproverId,
          hrApprovedAt: approvedAt,
          hrApprovalRemarks: payload.remarks,
          hrRejectedAt: null,
          hrRejectionReason: null,
          approverId: hrApproverId,
          approvedAt,
          approvalRemarks: payload.remarks,
          rejectedAt: null,
          rejectionReason: null,
        },
        select: {
          id: true,
          statusCode: true,
          hrApproverId: true,
          hrApprovedAt: true,
          hrApprovalRemarks: true,
        },
      })

      await createAuditLog(
        {
          tableName: "LeaveRequest",
          recordId: updated.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "HR_FINAL_APPROVE",
          changes: [
            { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
            { fieldName: "hrApproverId", oldValue: request.hrApproverId, newValue: updated.hrApproverId },
            { fieldName: "hrApprovedAt", oldValue: request.hrApprovedAt, newValue: updated.hrApprovedAt },
            { fieldName: "hrApprovalRemarks", oldValue: request.hrApprovalRemarks, newValue: updated.hrApprovalRemarks },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to finalize leave approval: ${message}` }
  }

  revalidatePath(`/${context.companyId}/approvals`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: `Leave request ${request.requestNumber} approved and finalized by HR.`,
  }
}

export async function rejectLeaveRequestByHrAction(
  input: RejectApprovalQueueRequestInput
): Promise<FinalizeApprovalQueueRequestActionResult> {
  const parsed = rejectApprovalQueueRequestInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rejection payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasFinalHrApprovalAccess(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can finalize requests." }
  }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      startDate: true,
      leaveType: { select: { isPaid: true } },
      hrApproverId: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Leave request not found in the active company." }
  }

  if (request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
    return { ok: false, error: "Only supervisor-approved leave requests can be finalized." }
  }

  const hrApproverId = await getHrActorEmployeeId(context.companyId, context.userId)
  const rejectedAt = new Date()

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

      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.REJECTED,
          hrApproverId,
          hrRejectedAt: rejectedAt,
          hrRejectionReason: payload.reason,
          hrApprovedAt: null,
          hrApprovalRemarks: null,
          approverId: hrApproverId,
          approvedAt: null,
          approvalRemarks: null,
          rejectedAt,
          rejectionReason: payload.reason,
        },
        select: {
          id: true,
          statusCode: true,
          hrApproverId: true,
          hrRejectedAt: true,
          hrRejectionReason: true,
        },
      })

      await createAuditLog(
        {
          tableName: "LeaveRequest",
          recordId: updated.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "HR_FINAL_REJECT",
          changes: [
            { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
            { fieldName: "hrApproverId", oldValue: request.hrApproverId, newValue: updated.hrApproverId },
            { fieldName: "hrRejectedAt", oldValue: request.hrRejectedAt, newValue: updated.hrRejectedAt },
            { fieldName: "hrRejectionReason", oldValue: request.hrRejectionReason, newValue: updated.hrRejectionReason },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reject leave request: ${message}` }
  }

  revalidatePath(`/${context.companyId}/approvals`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: `Leave request ${request.requestNumber} rejected.`,
  }
}

export async function approveOvertimeRequestByHrAction(
  input: ApproveApprovalQueueRequestInput
): Promise<FinalizeApprovalQueueRequestActionResult> {
  const parsed = approveApprovalQueueRequestInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasFinalHrApprovalAccess(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can finalize requests." }
  }

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      employeeId: true,
      overtimeDate: true,
      hours: true,
      employee: {
        select: {
          isOvertimeEligible: true,
        },
      },
      hrApproverId: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Overtime request not found in the active company." }
  }

  if (request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
    return { ok: false, error: "Only supervisor-approved overtime requests can be finalized." }
  }

  const hrApproverId = await getHrActorEmployeeId(context.companyId, context.userId)
  const approvedAt = new Date()

  try {
    await db.$transaction(async (tx) => {
      const ctoResult = await applyCtoCreditForApprovedOvertime(tx, {
        companyId: context.companyId,
        employeeId: request.employeeId,
        overtimeRequestId: request.id,
        requestNumber: request.requestNumber,
        overtimeDate: request.overtimeDate,
        overtimeHours: Number(request.hours),
        isOvertimeEligible: request.employee.isOvertimeEligible,
        processedById: context.userId,
      })

      if (!ctoResult.ok) {
        throw new Error(ctoResult.error)
      }

      const updated = await tx.overtimeRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.APPROVED,
          hrApproverId,
          hrApprovedAt: approvedAt,
          hrApprovalRemarks: payload.remarks,
          hrRejectedAt: null,
          hrRejectionReason: null,
          approverId: hrApproverId,
          approvedAt,
          approvalRemarks: payload.remarks,
          rejectedAt: null,
          rejectionReason: null,
        },
        select: {
          id: true,
          statusCode: true,
          hrApproverId: true,
          hrApprovedAt: true,
          hrApprovalRemarks: true,
        },
      })

      await createAuditLog(
        {
          tableName: "OvertimeRequest",
          recordId: updated.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "HR_FINAL_APPROVE",
          changes: [
            { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
            { fieldName: "hrApproverId", oldValue: request.hrApproverId, newValue: updated.hrApproverId },
            { fieldName: "hrApprovedAt", oldValue: request.hrApprovedAt, newValue: updated.hrApprovedAt },
            { fieldName: "hrApprovalRemarks", oldValue: request.hrApprovalRemarks, newValue: updated.hrApprovalRemarks },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to finalize overtime approval: ${message}` }
  }

  revalidatePath(`/${context.companyId}/approvals`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: `Overtime request ${request.requestNumber} approved and finalized by HR.`,
  }
}

export async function rejectOvertimeRequestByHrAction(
  input: RejectApprovalQueueRequestInput
): Promise<FinalizeApprovalQueueRequestActionResult> {
  const parsed = rejectApprovalQueueRequestInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rejection payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasFinalHrApprovalAccess(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can finalize requests." }
  }

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      hrApproverId: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Overtime request not found in the active company." }
  }

  if (request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
    return { ok: false, error: "Only supervisor-approved overtime requests can be finalized." }
  }

  const hrApproverId = await getHrActorEmployeeId(context.companyId, context.userId)
  const rejectedAt = new Date()

  const updated = await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.REJECTED,
      hrApproverId,
      hrRejectedAt: rejectedAt,
      hrRejectionReason: payload.reason,
      hrApprovedAt: null,
      hrApprovalRemarks: null,
      approverId: hrApproverId,
      approvedAt: null,
      approvalRemarks: null,
      rejectedAt,
      rejectionReason: payload.reason,
    },
    select: {
      id: true,
      statusCode: true,
      hrApproverId: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
    },
  })

  await createAuditLog({
    tableName: "OvertimeRequest",
    recordId: updated.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "HR_FINAL_REJECT",
    changes: [
      { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
      { fieldName: "hrApproverId", oldValue: request.hrApproverId, newValue: updated.hrApproverId },
      { fieldName: "hrRejectedAt", oldValue: request.hrRejectedAt, newValue: updated.hrRejectedAt },
      { fieldName: "hrRejectionReason", oldValue: request.hrRejectionReason, newValue: updated.hrRejectionReason },
    ],
  })

  revalidatePath(`/${context.companyId}/approvals`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: `Overtime request ${request.requestNumber} rejected.`,
  }
}
