"use server"

import { revalidatePath } from "next/cache"

import { RequestStatus } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  overridePendingRequestApprovalInputSchema,
  type OverridePendingRequestApprovalInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import {
  approveLeaveRequestByHrAction,
  approveOvertimeRequestByHrAction,
  rejectLeaveRequestByHrAction,
  rejectOvertimeRequestByHrAction,
} from "@/modules/approvals/queue/actions/finalize-approval-queue-request-action"

type OverridePendingRequestApprovalActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const FINAL_HR_ROLES = new Set<CompanyRole>(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"])

const hasFinalHrApprovalAccess = (companyRole: CompanyRole, isSuperAdmin: boolean): boolean => {
  if (isSuperAdmin) return true
  return FINAL_HR_ROLES.has(companyRole)
}

const getActorEmployeeId = async (companyId: string, userId: string): Promise<string | null> => {
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

const toSupervisorOverrideRemarks = (
  decision: OverridePendingRequestApprovalInput["decision"],
  remarks: string
): string => {
  if (decision === "REJECT") {
    return `HR supervisor-stage override for rejection from DTR Workbench: ${remarks}`
  }

  return `HR supervisor-stage override for approval from DTR Workbench: ${remarks}`
}

const toFinalDecisionRemarks = (
  decision: OverridePendingRequestApprovalInput["decision"],
  remarks: string
): string => {
  if (decision === "REJECT") {
    return `HR final rejection via supervisor override: ${remarks}`
  }

  return `HR final approval via supervisor override: ${remarks}`
}

const toOverrideStateError = (
  kind: OverridePendingRequestApprovalInput["requestKind"],
  decision: OverridePendingRequestApprovalInput["decision"]
): string => {
  if (decision === "REJECT") {
    return kind === "LEAVE"
      ? "Leave request is no longer pending and cannot be override-rejected."
      : "Overtime request is no longer pending and cannot be override-rejected."
  }

  return kind === "LEAVE"
    ? "Leave request is no longer pending and cannot be override-approved."
    : "Overtime request is no longer pending and cannot be override-approved."
}

const rollbackLeaveSupervisorOverride = async (params: {
  requestId: string
  userId: string
  previousSupervisorApproverId: string | null
  previousSupervisorApprovedAt: Date | null
  previousSupervisorApprovalRemarks: string | null
}): Promise<void> => {
  await db.$transaction(async (tx) => {
    const current = await tx.leaveRequest.findFirst({
      where: { id: params.requestId, statusCode: RequestStatus.SUPERVISOR_APPROVED },
      select: {
        id: true,
        statusCode: true,
        supervisorApproverId: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
      },
    })

    if (!current) return

    const reverted = await tx.leaveRequest.update({
      where: { id: current.id },
      data: {
        statusCode: RequestStatus.PENDING,
        supervisorApproverId: params.previousSupervisorApproverId,
        supervisorApprovedAt: params.previousSupervisorApprovedAt,
        supervisorApprovalRemarks: params.previousSupervisorApprovalRemarks,
      },
      select: {
        id: true,
        statusCode: true,
        supervisorApproverId: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
      },
    })

    await createAuditLog(
      {
        tableName: "LeaveRequest",
        recordId: reverted.id,
        action: "UPDATE",
        userId: params.userId,
        reason: "HR_SUPERVISOR_OVERRIDE_ROLLBACK",
        changes: [
          { fieldName: "statusCode", oldValue: current.statusCode, newValue: reverted.statusCode },
          { fieldName: "supervisorApproverId", oldValue: current.supervisorApproverId, newValue: reverted.supervisorApproverId },
          { fieldName: "supervisorApprovedAt", oldValue: current.supervisorApprovedAt, newValue: reverted.supervisorApprovedAt },
          { fieldName: "supervisorApprovalRemarks", oldValue: current.supervisorApprovalRemarks, newValue: reverted.supervisorApprovalRemarks },
        ],
      },
      tx
    )
  })
}

const rollbackOvertimeSupervisorOverride = async (params: {
  requestId: string
  userId: string
  previousSupervisorApproverId: string | null
  previousSupervisorApprovedAt: Date | null
  previousSupervisorApprovalRemarks: string | null
}): Promise<void> => {
  await db.$transaction(async (tx) => {
    const current = await tx.overtimeRequest.findFirst({
      where: { id: params.requestId, statusCode: RequestStatus.SUPERVISOR_APPROVED },
      select: {
        id: true,
        statusCode: true,
        supervisorApproverId: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
      },
    })

    if (!current) return

    const reverted = await tx.overtimeRequest.update({
      where: { id: current.id },
      data: {
        statusCode: RequestStatus.PENDING,
        supervisorApproverId: params.previousSupervisorApproverId,
        supervisorApprovedAt: params.previousSupervisorApprovedAt,
        supervisorApprovalRemarks: params.previousSupervisorApprovalRemarks,
      },
      select: {
        id: true,
        statusCode: true,
        supervisorApproverId: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
      },
    })

    await createAuditLog(
      {
        tableName: "OvertimeRequest",
        recordId: reverted.id,
        action: "UPDATE",
        userId: params.userId,
        reason: "HR_SUPERVISOR_OVERRIDE_ROLLBACK",
        changes: [
          { fieldName: "statusCode", oldValue: current.statusCode, newValue: reverted.statusCode },
          { fieldName: "supervisorApproverId", oldValue: current.supervisorApproverId, newValue: reverted.supervisorApproverId },
          { fieldName: "supervisorApprovedAt", oldValue: current.supervisorApprovedAt, newValue: reverted.supervisorApprovedAt },
          { fieldName: "supervisorApprovalRemarks", oldValue: current.supervisorApprovalRemarks, newValue: reverted.supervisorApprovalRemarks },
        ],
      },
      tx
    )
  })
}

export async function overridePendingRequestApprovalAction(
  input: OverridePendingRequestApprovalInput
): Promise<OverridePendingRequestApprovalActionResult> {
  const parsed = overridePendingRequestApprovalInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid override payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasFinalHrApprovalAccess(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can override approvals." }
  }

  const actorEmployeeId = await getActorEmployeeId(context.companyId, context.userId)
  const overrideRemarks = toSupervisorOverrideRemarks(payload.decision, payload.remarks)
  const finalRemarks = toFinalDecisionRemarks(payload.decision, payload.remarks)

  if (payload.requestKind === "LEAVE") {
    const request = await db.leaveRequest.findFirst({
      where: {
        id: payload.requestId,
        employee: { companyId: context.companyId },
      },
      select: {
        id: true,
        requestNumber: true,
        statusCode: true,
        supervisorApproverId: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
      },
    })

    if (!request) {
      return { ok: false, error: "Leave request not found in the active company." }
    }

    if (request.statusCode !== RequestStatus.PENDING && request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
      return { ok: false, error: toOverrideStateError(payload.requestKind, payload.decision) }
    }

    const wasPendingBeforeOverride = request.statusCode === RequestStatus.PENDING

    if (wasPendingBeforeOverride) {
      const overrideAt = new Date()
      const nextSupervisorApproverId = request.supervisorApproverId ?? actorEmployeeId

      await db.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id: request.id },
          data: {
            statusCode: RequestStatus.SUPERVISOR_APPROVED,
            supervisorApproverId: nextSupervisorApproverId,
            supervisorApprovedAt: overrideAt,
            supervisorApprovalRemarks: overrideRemarks,
          },
          select: {
            id: true,
            statusCode: true,
            supervisorApproverId: true,
            supervisorApprovedAt: true,
            supervisorApprovalRemarks: true,
          },
        })

        await createAuditLog(
          {
            tableName: "LeaveRequest",
            recordId: updated.id,
            action: "UPDATE",
            userId: context.userId,
            reason: payload.decision === "REJECT" ? "HR_SUPERVISOR_OVERRIDE_REJECT" : "HR_SUPERVISOR_OVERRIDE_APPROVE",
            changes: [
              { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
              { fieldName: "supervisorApproverId", oldValue: request.supervisorApproverId, newValue: updated.supervisorApproverId },
              { fieldName: "supervisorApprovedAt", oldValue: request.supervisorApprovedAt, newValue: updated.supervisorApprovedAt },
              { fieldName: "supervisorApprovalRemarks", oldValue: request.supervisorApprovalRemarks, newValue: updated.supervisorApprovalRemarks },
            ],
          },
          tx
        )
      })
    }

    const result =
      payload.decision === "REJECT"
        ? await rejectLeaveRequestByHrAction({
            companyId: context.companyId,
            requestId: request.id,
            reason: finalRemarks,
          })
        : await approveLeaveRequestByHrAction({
            companyId: context.companyId,
            requestId: request.id,
            remarks: finalRemarks,
          })

    if (!result.ok) {
      if (wasPendingBeforeOverride) {
        try {
          await rollbackLeaveSupervisorOverride({
            requestId: request.id,
            userId: context.userId,
            previousSupervisorApproverId: request.supervisorApproverId,
            previousSupervisorApprovedAt: request.supervisorApprovedAt,
            previousSupervisorApprovalRemarks: request.supervisorApprovalRemarks,
          })
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : "Unknown rollback error"
          return { ok: false, error: `${result.error} (Rollback failed: ${rollbackMessage})` }
        }
      }
      return { ok: false, error: result.error }
    }

    revalidatePath(`/${context.companyId}/attendance/dtr`)

    return {
      ok: true,
      message:
        payload.decision === "REJECT"
          ? wasPendingBeforeOverride
            ? `Leave request ${request.requestNumber} rejected via supervisor override.`
            : `Leave request ${request.requestNumber} rejected.`
          : wasPendingBeforeOverride
            ? `Leave request ${request.requestNumber} approved via supervisor override.`
            : `Leave request ${request.requestNumber} approved.`,
    }
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
      supervisorApproverId: true,
      supervisorApprovedAt: true,
      supervisorApprovalRemarks: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Overtime request not found in the active company." }
  }

  if (request.statusCode !== RequestStatus.PENDING && request.statusCode !== RequestStatus.SUPERVISOR_APPROVED) {
    return { ok: false, error: toOverrideStateError(payload.requestKind, payload.decision) }
  }

  const wasPendingBeforeOverride = request.statusCode === RequestStatus.PENDING

  if (wasPendingBeforeOverride) {
    const overrideAt = new Date()
    const nextSupervisorApproverId = request.supervisorApproverId ?? actorEmployeeId

    await db.$transaction(async (tx) => {
      const updated = await tx.overtimeRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.SUPERVISOR_APPROVED,
          supervisorApproverId: nextSupervisorApproverId,
          supervisorApprovedAt: overrideAt,
          supervisorApprovalRemarks: overrideRemarks,
        },
        select: {
          id: true,
          statusCode: true,
          supervisorApproverId: true,
          supervisorApprovedAt: true,
          supervisorApprovalRemarks: true,
        },
      })

      await createAuditLog(
        {
          tableName: "OvertimeRequest",
          recordId: updated.id,
          action: "UPDATE",
          userId: context.userId,
          reason: payload.decision === "REJECT" ? "HR_SUPERVISOR_OVERRIDE_REJECT" : "HR_SUPERVISOR_OVERRIDE_APPROVE",
          changes: [
            { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
            { fieldName: "supervisorApproverId", oldValue: request.supervisorApproverId, newValue: updated.supervisorApproverId },
            { fieldName: "supervisorApprovedAt", oldValue: request.supervisorApprovedAt, newValue: updated.supervisorApprovedAt },
            { fieldName: "supervisorApprovalRemarks", oldValue: request.supervisorApprovalRemarks, newValue: updated.supervisorApprovalRemarks },
          ],
        },
        tx
      )
    })
  }

  const result =
    payload.decision === "REJECT"
      ? await rejectOvertimeRequestByHrAction({
          companyId: context.companyId,
          requestId: request.id,
          reason: finalRemarks,
        })
      : await approveOvertimeRequestByHrAction({
          companyId: context.companyId,
          requestId: request.id,
          remarks: finalRemarks,
        })

  if (!result.ok) {
    if (wasPendingBeforeOverride) {
      try {
        await rollbackOvertimeSupervisorOverride({
          requestId: request.id,
          userId: context.userId,
          previousSupervisorApproverId: request.supervisorApproverId,
          previousSupervisorApprovedAt: request.supervisorApprovedAt,
          previousSupervisorApprovalRemarks: request.supervisorApprovalRemarks,
        })
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : "Unknown rollback error"
        return { ok: false, error: `${result.error} (Rollback failed: ${rollbackMessage})` }
      }
    }
    return { ok: false, error: result.error }
  }

  revalidatePath(`/${context.companyId}/attendance/dtr`)

  return {
    ok: true,
    message:
      payload.decision === "REJECT"
        ? wasPendingBeforeOverride
          ? `Overtime request ${request.requestNumber} rejected via supervisor override.`
          : `Overtime request ${request.requestNumber} rejected.`
        : wasPendingBeforeOverride
          ? `Overtime request ${request.requestNumber} approved via supervisor override.`
          : `Overtime request ${request.requestNumber} approved.`,
  }
}
