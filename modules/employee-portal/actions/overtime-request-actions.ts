"use server"

import { revalidatePath } from "next/cache"

import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  cancelOvertimeRequestInputSchema,
  createOvertimeRequestInputSchema,
  type CancelOvertimeRequestInput,
  type CreateOvertimeRequestInput,
} from "@/modules/employee-portal/schemas/overtime-request-actions-schema"

type OvertimeRequestActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const parseTimeInput = (value: string): Date => {
  const [hour, minute] = value.split(":").map((part) => Number(part))
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0))
}

const durationHours = (start: string, end: string): number => {
  const [startHour, startMinute] = start.split(":").map((part) => Number(part))
  const [endHour, endMinute] = end.split(":").map((part) => Number(part))
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  return (endMinutes - startMinutes) / 60
}

const generateOvertimeRequestNumber = async (): Promise<string> => {
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
      reportingManagerId: true,
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee profile not found for the active company." }
  }

  const hours = durationHours(payload.startTime, payload.endTime)
  if (hours <= 0) {
    return { ok: false, error: "End time must be later than start time." }
  }

  if (hours < 1) {
    return { ok: false, error: "Overtime requests must be at least 1 hour." }
  }

  const requestNumber = await generateOvertimeRequestNumber()

  const created = await db.overtimeRequest.create({
    data: {
      requestNumber,
      employeeId: employee.id,
      overtimeDate: parseDateInput(payload.overtimeDate),
      startTime: parseTimeInput(payload.startTime),
      endTime: parseTimeInput(payload.endTime),
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
