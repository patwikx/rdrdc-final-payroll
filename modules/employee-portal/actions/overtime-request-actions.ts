"use server"

import { revalidatePath } from "next/cache"

import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  calculateOvertimeDurationHours,
  generateOvertimeRequestNumber,
  parseOvertimeDateInput,
  parseOvertimeTimeInput,
} from "@/modules/overtime/utils/overtime-domain"
import {
  cancelOvertimeRequestInputSchema,
  createOvertimeRequestInputSchema,
  updateOvertimeRequestInputSchema,
  type CancelOvertimeRequestInput,
  type CreateOvertimeRequestInput,
  type UpdateOvertimeRequestInput,
} from "@/modules/employee-portal/schemas/overtime-request-actions-schema"
import { sendSupervisorRequestSubmissionEmail } from "@/modules/notifications/utils/request-approval-email"

type OvertimeRequestActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const overtimeDateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const overtimeTimeLabel = new Intl.DateTimeFormat("en-PH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
})

const formatOvertimeClock = (value: string): string => {
  const [hour, minute] = value.split(":").map((part) => Number(part))
  return overtimeTimeLabel.format(new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0)))
}

export async function createOvertimeRequestAction(
  input: CreateOvertimeRequestInput
): Promise<OvertimeRequestActionResult> {
  const parsed = createOvertimeRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid overtime request payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can submit overtime requests in this portal." }
  }

  const employee = await db.employee.findFirst({
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
  })

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  const hours = calculateOvertimeDurationHours(payload.startTime, payload.endTime)
  if (hours <= 0) {
    return { ok: false, error: "End time must be later than start time." }
  }

  if (hours < 1) {
    return { ok: false, error: "Overtime requests must be at least 1 hour." }
  }

  const requestNumber = await generateOvertimeRequestNumber()
  const overtimeDate = parseOvertimeDateInput(payload.overtimeDate)
  if (!overtimeDate) {
    return { ok: false, error: "Overtime date is invalid." }
  }

  const created = await db.overtimeRequest.create({
    data: {
      requestNumber,
      employeeId: employee.id,
      overtimeDate,
      startTime: parseOvertimeTimeInput(payload.startTime),
      endTime: parseOvertimeTimeInput(payload.endTime),
      hours,
      reason: payload.reason?.trim() || null,
      statusCode: RequestStatus.PENDING,
      supervisorApproverId: employee.reportingManagerId ?? null,
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      hours: true,
    },
  })

  await createAuditLog({
    tableName: "OvertimeRequest",
    recordId: created.id,
    action: "CREATE",
    userId: context.userId,
    reason: "EMPLOYEE_SUBMIT_OVERTIME_REQUEST",
    changes: [
      { fieldName: "requestNumber", newValue: created.requestNumber },
      { fieldName: "statusCode", newValue: created.statusCode },
      { fieldName: "hours", newValue: Number(created.hours) },
    ],
  })

  revalidatePath(`/${context.companyId}/employee-portal`)
  revalidatePath(`/${context.companyId}/employee-portal/overtime`)
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
    requestTypeLabel: "Overtime Request",
    requestNumber: created.requestNumber,
    companyName: context.companyName,
    approvalPath: `/${context.companyId}/employee-portal/overtime-approvals`,
    detailLines: [
      `Overtime date: ${overtimeDateLabel.format(overtimeDate)}`,
      `Time range: ${formatOvertimeClock(payload.startTime)} to ${formatOvertimeClock(payload.endTime)}`,
      `Total hours: ${hours.toFixed(2)} hour(s)`,
      payload.reason?.trim() ? `Reason: ${payload.reason.trim()}` : "",
    ],
  })

  if (!notification.ok) {
    console.error("[createOvertimeRequestAction] Supervisor notification email failed", {
      companyId: context.companyId,
      requestId: created.id,
      requestNumber: created.requestNumber,
      error: notification.error,
    })
  }

  return { ok: true, message: `Overtime request ${created.requestNumber} submitted.` }
}

export async function cancelOvertimeRequestAction(
  input: CancelOvertimeRequestInput
): Promise<OvertimeRequestActionResult> {
  const parsed = cancelOvertimeRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancellation payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can cancel overtime requests in this portal." }
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

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      employeeId: employee.id,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Overtime request not found." }
  }

  if (request.statusCode !== RequestStatus.PENDING) {
    return { ok: false, error: "Only pending overtime requests can be cancelled." }
  }

  const updated = await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.CANCELLED,
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
    },
  })

  await createAuditLog({
    tableName: "OvertimeRequest",
    recordId: updated.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "EMPLOYEE_CANCEL_OVERTIME_REQUEST",
    changes: [
      { fieldName: "statusCode", oldValue: request.statusCode, newValue: updated.statusCode },
      { fieldName: "employeeCancellationReason", newValue: payload.reason?.trim() || "Cancelled by employee" },
    ],
  })

  revalidatePath(`/${context.companyId}/employee-portal`)
  revalidatePath(`/${context.companyId}/employee-portal/overtime`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return { ok: true, message: `Overtime request ${updated.requestNumber} cancelled.` }
}

export async function updateOvertimeRequestAction(
  input: UpdateOvertimeRequestInput
): Promise<OvertimeRequestActionResult> {
  const parsed = updateOvertimeRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can update overtime requests in this portal." }
  }

  const employee = await db.employee.findFirst({
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
  })

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      employeeId: employee.id,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      statusCode: true,
      overtimeDate: true,
      startTime: true,
      endTime: true,
      hours: true,
      reason: true,
      supervisorApproverId: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Overtime request not found." }
  }

  if (request.statusCode !== RequestStatus.PENDING) {
    return { ok: false, error: "Only pending overtime requests can be edited." }
  }

  const hours = calculateOvertimeDurationHours(payload.startTime, payload.endTime)
  if (hours <= 0) {
    return { ok: false, error: "End time must be later than start time." }
  }

  if (hours < 1) {
    return { ok: false, error: "Overtime requests must be at least 1 hour." }
  }

  const nextOvertimeDate = parseOvertimeDateInput(payload.overtimeDate)
  if (!nextOvertimeDate) {
    return { ok: false, error: "Overtime date is invalid." }
  }
  const nextStartTime = parseOvertimeTimeInput(payload.startTime)
  const nextEndTime = parseOvertimeTimeInput(payload.endTime)
  const nextReason = payload.reason?.trim() || null

  const updated = await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      overtimeDate: nextOvertimeDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      hours,
      reason: nextReason,
      supervisorApproverId: employee.reportingManagerId ?? request.supervisorApproverId,
    },
    select: {
      id: true,
      requestNumber: true,
    },
  })

  await createAuditLog({
    tableName: "OvertimeRequest",
    recordId: updated.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "EMPLOYEE_UPDATE_OVERTIME_REQUEST",
    changes: [
      { fieldName: "overtimeDate", oldValue: request.overtimeDate.toISOString(), newValue: nextOvertimeDate.toISOString() },
      { fieldName: "startTime", oldValue: request.startTime.toISOString(), newValue: nextStartTime.toISOString() },
      { fieldName: "endTime", oldValue: request.endTime.toISOString(), newValue: nextEndTime.toISOString() },
      { fieldName: "hours", oldValue: Number(request.hours), newValue: hours },
      { fieldName: "reason", oldValue: request.reason, newValue: nextReason },
    ],
  })

  revalidatePath(`/${context.companyId}/employee-portal`)
  revalidatePath(`/${context.companyId}/employee-portal/overtime`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return { ok: true, message: `Overtime request ${updated.requestNumber} updated.` }
}
