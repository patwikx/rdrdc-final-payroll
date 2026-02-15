"use server"

import { revalidatePath } from "next/cache"

import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  releaseReservedLeaveBalanceForRequest,
  reserveLeaveBalanceForRequest,
} from "@/modules/leave/utils/leave-balance-ledger"
import {
  cancelLeaveRequestInputSchema,
  createLeaveRequestInputSchema,
  updateLeaveRequestInputSchema,
  type CancelLeaveRequestInput,
  type CreateLeaveRequestInput,
  type UpdateLeaveRequestInput,
} from "@/modules/leave/schemas/leave-request-actions-schema"
import type { LeaveActionResult } from "@/modules/leave/types/leave-action-result"
import { sendSupervisorRequestSubmissionEmail } from "@/modules/notifications/utils/request-approval-email"

const parseDateInput = (value: string): Date | null => parsePhDateInputToUtcDateOnly(value)

const leaveDateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const toDayCountLabel = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value} day(s)`
  }

  return `${value.toFixed(1)} day(s)`
}

const dayDiffInclusive = (start: Date, end: Date): number => {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

const generateLeaveRequestNumber = async (): Promise<string> => {
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
    const candidate = `LR-${stamp}-${suffix}`
    const exists = await db.leaveRequest.findUnique({ where: { requestNumber: candidate }, select: { id: true } })
    if (!exists) return candidate
  }

  throw new Error("REQUEST_NUMBER_GENERATION_FAILED")
}

export async function createLeaveRequestAction(input: CreateLeaveRequestInput): Promise<LeaveActionResult> {
  const parsed = createLeaveRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave request payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can submit leave requests in this portal." }
  }

  const [employee, leaveType] = await Promise.all([
    db.employee.findFirst({
      where: {
        userId: context.userId,
        companyId: context.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        reportingManagerId: true,
        reportingManager: {
          select: {
            firstName: true,
            lastName: true,
            user: {
              select: { email: true },
            },
            emails: {
              where: { isActive: true },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              select: { email: true },
            },
          },
        },
      },
    }),
    db.leaveType.findFirst({
      where: {
        id: payload.leaveTypeId,
        isActive: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      select: { id: true, name: true, isPaid: true },
    }),
  ])

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  if (!leaveType) {
    return { ok: false, error: "Leave type is not available for this company." }
  }

  const startDate = parseDateInput(payload.startDate)
  const endDate = parseDateInput(payload.endDate)
  if (!startDate || !endDate) {
    return { ok: false, error: "Leave date is invalid." }
  }
  const numberOfDays = payload.isHalfDay ? 0.5 : dayDiffInclusive(startDate, endDate)

  if (numberOfDays <= 0) {
    return { ok: false, error: "Invalid leave duration." }
  }

  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    return { ok: false, error: "Cross-year leave requests are not supported yet. Please submit separate requests per year." }
  }

  const requestNumber = await generateLeaveRequestNumber()
  const submittedAt = new Date()

  try {
    const created = await db.$transaction(async (tx) => {
      const createdRequest = await tx.leaveRequest.create({
        data: {
          requestNumber,
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          numberOfDays,
          isHalfDay: Boolean(payload.isHalfDay),
          halfDayPeriod: payload.isHalfDay ? payload.halfDayPeriod ?? null : null,
          reason: payload.reason?.trim() || null,
          statusCode: RequestStatus.PENDING,
          submittedAt,
          supervisorApproverId: employee.reportingManagerId ?? null,
        },
        select: {
          id: true,
          requestNumber: true,
          statusCode: true,
          employeeId: true,
          leaveTypeId: true,
          numberOfDays: true,
          startDate: true,
        },
      })

      if (leaveType.isPaid) {
        const reserveResult = await reserveLeaveBalanceForRequest(tx, {
          employeeId: createdRequest.employeeId,
          leaveTypeId: createdRequest.leaveTypeId,
          requestId: createdRequest.id,
          requestNumber: createdRequest.requestNumber,
          requestStartDate: createdRequest.startDate,
          numberOfDays: Number(createdRequest.numberOfDays),
          processedById: context.userId,
        })

        if (!reserveResult.ok) {
          throw new Error(reserveResult.error)
        }
      }

      await createAuditLog(
        {
          tableName: "LeaveRequest",
          recordId: createdRequest.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_SUBMIT_LEAVE_REQUEST",
          changes: [
            { fieldName: "requestNumber", newValue: createdRequest.requestNumber },
            { fieldName: "statusCode", newValue: createdRequest.statusCode },
            { fieldName: "startDate", newValue: startDate },
            { fieldName: "endDate", newValue: endDate },
            { fieldName: "numberOfDays", newValue: numberOfDays },
          ],
        },
        tx
      )

      return createdRequest
    })

    revalidatePath(`/${context.companyId}/employee-portal`)
    revalidatePath(`/${context.companyId}/employee-portal/leaves`)
    revalidatePath(`/${context.companyId}/dashboard`)

    const supervisorEmail =
      employee.reportingManager?.emails[0]?.email ?? employee.reportingManager?.user?.email ?? null
    const supervisorName = employee.reportingManager
      ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
      : null

    const notification = await sendSupervisorRequestSubmissionEmail({
      supervisorEmail,
      supervisorName,
      requesterName: `${employee.firstName} ${employee.lastName}`,
      requesterEmployeeNumber: employee.employeeNumber,
      requestTypeLabel: "Leave Request",
      requestNumber: created.requestNumber,
      companyName: context.companyName,
      approvalPath: `/${context.companyId}/employee-portal/leave-approvals`,
      detailLines: [
        `Leave type: ${leaveType.name}`,
        `Date range: ${leaveDateLabel.format(startDate)} to ${leaveDateLabel.format(endDate)}`,
        `Duration: ${toDayCountLabel(numberOfDays)}${payload.isHalfDay ? ` (${payload.halfDayPeriod ?? "HALF DAY"})` : ""}`,
        payload.reason?.trim() ? `Reason: ${payload.reason.trim()}` : "",
      ],
    })

    if (!notification.ok) {
      console.error("[createLeaveRequestAction] Supervisor notification email failed", {
        companyId: context.companyId,
        requestId: created.id,
        requestNumber: created.requestNumber,
        error: notification.error,
      })
    }

    return { ok: true, message: `Leave request ${created.requestNumber} submitted.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to submit leave request: ${message}` }
  }
}

export async function cancelLeaveRequestAction(input: CancelLeaveRequestInput): Promise<LeaveActionResult> {
  const parsed = cancelLeaveRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancellation payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can cancel leave requests in this portal." }
  }

  const employee = await db.employee.findFirst({
    where: {
      userId: context.userId,
      companyId: context.companyId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      employeeId: employee.id,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      employeeId: true,
      leaveTypeId: true,
      numberOfDays: true,
      startDate: true,
      statusCode: true,
      cancelledAt: true,
      cancellationReason: true,
      leaveType: { select: { isPaid: true } },
    },
  })

  if (!request) {
    return { ok: false, error: "Leave request not found." }
  }

  if (request.statusCode !== RequestStatus.PENDING) {
    return { ok: false, error: "Only pending leave requests can be cancelled." }
  }

  const cancelledAt = new Date()
  const cancellationReason = payload.reason?.trim() || "Cancelled by employee"

  try {
    const updated = await db.$transaction(async (tx) => {
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

      const updatedRequest = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.CANCELLED,
          cancelledAt,
          cancellationReason,
        },
        select: {
          id: true,
          requestNumber: true,
          statusCode: true,
          cancelledAt: true,
          cancellationReason: true,
        },
      })

      await createAuditLog(
        {
          tableName: "LeaveRequest",
          recordId: updatedRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_CANCEL_LEAVE_REQUEST",
          changes: [
            { fieldName: "statusCode", oldValue: request.statusCode, newValue: updatedRequest.statusCode },
            { fieldName: "cancelledAt", oldValue: request.cancelledAt, newValue: updatedRequest.cancelledAt },
            { fieldName: "cancellationReason", oldValue: request.cancellationReason, newValue: updatedRequest.cancellationReason },
          ],
        },
        tx
      )

      return updatedRequest
    })

    revalidatePath(`/${context.companyId}/employee-portal`)
    revalidatePath(`/${context.companyId}/employee-portal/leaves`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: `Leave request ${updated.requestNumber} cancelled.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to cancel leave request: ${message}` }
  }
}

export async function updateLeaveRequestAction(input: UpdateLeaveRequestInput): Promise<LeaveActionResult> {
  const parsed = updateLeaveRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can update leave requests in this portal." }
  }

  const [employee, leaveType] = await Promise.all([
    db.employee.findFirst({
      where: {
        userId: context.userId,
        companyId: context.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        reportingManagerId: true,
      },
    }),
    db.leaveType.findFirst({
      where: {
        id: payload.leaveTypeId,
        isActive: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      select: { id: true, isPaid: true },
    }),
  ])

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  if (!leaveType) {
    return { ok: false, error: "Leave type is not available for this company." }
  }

  const request = await db.leaveRequest.findFirst({
    where: {
      id: payload.requestId,
      employeeId: employee.id,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      leaveTypeId: true,
      startDate: true,
      endDate: true,
      numberOfDays: true,
      isHalfDay: true,
      halfDayPeriod: true,
      reason: true,
      statusCode: true,
      supervisorApproverId: true,
      leaveType: { select: { isPaid: true } },
    },
  })

  if (!request) {
    return { ok: false, error: "Leave request not found." }
  }

  if (request.statusCode !== RequestStatus.PENDING) {
    return { ok: false, error: "Only pending leave requests can be edited." }
  }

  const startDate = parseDateInput(payload.startDate)
  const endDate = parseDateInput(payload.endDate)
  if (!startDate || !endDate) {
    return { ok: false, error: "Leave date is invalid." }
  }
  const numberOfDays = payload.isHalfDay ? 0.5 : dayDiffInclusive(startDate, endDate)

  if (numberOfDays <= 0) {
    return { ok: false, error: "Invalid leave duration." }
  }

  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    return { ok: false, error: "Cross-year leave requests are not supported yet. Please submit separate requests per year." }
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      if (request.leaveType.isPaid) {
        const released = await releaseReservedLeaveBalanceForRequest(tx, {
          employeeId: employee.id,
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

      const updatedRequest = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          numberOfDays,
          isHalfDay: Boolean(payload.isHalfDay),
          halfDayPeriod: payload.isHalfDay ? payload.halfDayPeriod ?? null : null,
          reason: payload.reason?.trim() || null,
          supervisorApproverId: employee.reportingManagerId ?? request.supervisorApproverId,
        },
        select: {
          id: true,
          requestNumber: true,
          leaveTypeId: true,
          startDate: true,
          endDate: true,
          numberOfDays: true,
          isHalfDay: true,
          halfDayPeriod: true,
          reason: true,
          supervisorApproverId: true,
        },
      })

      if (leaveType.isPaid) {
        const reserveResult = await reserveLeaveBalanceForRequest(tx, {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          requestId: updatedRequest.id,
          requestNumber: updatedRequest.requestNumber,
          requestStartDate: updatedRequest.startDate,
          numberOfDays: Number(updatedRequest.numberOfDays),
          processedById: context.userId,
        })

        if (!reserveResult.ok) {
          throw new Error(reserveResult.error)
        }
      }

      await createAuditLog(
        {
          tableName: "LeaveRequest",
          recordId: updatedRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_UPDATE_LEAVE_REQUEST",
          changes: [
            { fieldName: "leaveTypeId", oldValue: request.leaveTypeId, newValue: updatedRequest.leaveTypeId },
            { fieldName: "startDate", oldValue: request.startDate, newValue: updatedRequest.startDate },
            { fieldName: "endDate", oldValue: request.endDate, newValue: updatedRequest.endDate },
            { fieldName: "numberOfDays", oldValue: Number(request.numberOfDays), newValue: Number(updatedRequest.numberOfDays) },
            { fieldName: "isHalfDay", oldValue: request.isHalfDay, newValue: updatedRequest.isHalfDay },
            { fieldName: "halfDayPeriod", oldValue: request.halfDayPeriod, newValue: updatedRequest.halfDayPeriod },
            { fieldName: "reason", oldValue: request.reason, newValue: updatedRequest.reason },
          ],
        },
        tx
      )

      return updatedRequest
    })

    revalidatePath(`/${context.companyId}/employee-portal`)
    revalidatePath(`/${context.companyId}/employee-portal/leaves`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: `Leave request ${updated.requestNumber} updated.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update leave request: ${message}` }
  }
}
