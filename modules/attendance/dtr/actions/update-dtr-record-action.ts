"use server"

import { revalidatePath } from "next/cache"

import { DtrSource, type Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  updateDtrRecordInputSchema,
  type UpdateDtrRecordInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import {
  createWallClockDateTime,
  ensureEndAfterStart,
  formatWallClockTime,
  isHalfDayRemarks,
  normalizeHalfDayToken,
  parsePhDateInput,
} from "@/modules/attendance/dtr/utils/wall-clock"

type UpdateDtrRecordActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

type DayOverride = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const

const toDateTimeOnAttendanceDate = (attendanceDate: Date, value: string | undefined): Date | null => {
  if (!value) return null
  return createWallClockDateTime(attendanceDate, value)
}

const parseTimeOnAttendanceDate = (attendanceDate: Date, value: Date): Date => {
  const parsed = createWallClockDateTime(attendanceDate, formatWallClockTime(value))
  if (!parsed) {
    throw new Error("Invalid work schedule time.")
  }
  return parsed
}

const parseTimeStringOnAttendanceDate = (attendanceDate: Date, value: string): Date => {
  const parsed = createWallClockDateTime(attendanceDate, value)
  if (!parsed) {
    throw new Error("Invalid work schedule override time.")
  }
  return parsed
}

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const calculateNightDiffHours = (timeIn: Date, timeOut: Date): number => {
  if (timeOut <= timeIn) return 0

  let totalMs = 0
  const startDay = new Date(timeIn)
  startDay.setUTCHours(0, 0, 0, 0)

  const endDay = new Date(timeOut)
  endDay.setUTCHours(0, 0, 0, 0)

  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const ndStart = new Date(cursor)
    ndStart.setUTCHours(22, 0, 0, 0)

    const ndEnd = new Date(cursor)
    ndEnd.setUTCDate(ndEnd.getUTCDate() + 1)
    ndEnd.setUTCHours(6, 0, 0, 0)

    const overlapStart = Math.max(timeIn.getTime(), ndStart.getTime())
    const overlapEnd = Math.min(timeOut.getTime(), ndEnd.getTime())

    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return totalMs / (1000 * 60 * 60)
}

const getScheduleTimes = (
  attendanceDate: Date,
  workSchedule: {
    workStartTime: Date
    workEndTime: Date
    dayOverrides: unknown
  } | null
): { scheduledIn: Date | null; scheduledOut: Date | null } => {
  if (!workSchedule) {
    return { scheduledIn: null, scheduledOut: null }
  }

  const dayOfWeek = new Date(attendanceDate).getUTCDay()
  const dayName = DAY_NAMES[dayOfWeek]
  const overrides =
    workSchedule.dayOverrides && typeof workSchedule.dayOverrides === "object" && !Array.isArray(workSchedule.dayOverrides)
      ? (workSchedule.dayOverrides as Record<string, DayOverride>)
      : null
  const dayOverride = overrides?.[dayName]

  if (dayOverride?.isWorkingDay === false) {
    return { scheduledIn: null, scheduledOut: null }
  }

  if (dayOverride?.timeIn && dayOverride?.timeOut) {
    const scheduledIn = parseTimeStringOnAttendanceDate(attendanceDate, dayOverride.timeIn)
    const scheduledOut = parseTimeStringOnAttendanceDate(attendanceDate, dayOverride.timeOut)
    return {
      scheduledIn,
      scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut),
    }
  }

  const scheduledIn = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workStartTime)
  const scheduledOut = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workEndTime)
  return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
}

export async function updateDtrRecordAction(input: UpdateDtrRecordInput): Promise<UpdateDtrRecordActionResult> {
  const parsed = updateDtrRecordInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid DTR update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasModuleAccess(companyRole, "attendance")) {
    return { ok: false, error: "You do not have permission to update DTR records." }
  }

  const canManuallyApproveDtr =
    companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || companyRole === "PAYROLL_ADMIN" || isSuperAdmin
  if (!canManuallyApproveDtr) {
    return { ok: false, error: "Only Company Admin, HR Admin, Payroll Admin, or Super Admin can manually modify DTR records." }
  }

  const attendanceDate = parsePhDateInput(payload.attendanceDate)
  if (!attendanceDate) {
    return { ok: false, error: "Invalid attendance date." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    include: {
      workSchedule: {
        select: {
          workStartTime: true,
          workEndTime: true,
          dayOverrides: true,
          breakDurationMins: true,
          gracePeriodMins: true,
        },
      },
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  let record: {
    id: string
    actualTimeIn: Date | null
    actualTimeOut: Date | null
    attendanceStatus: string
    remarks: string | null
    hoursWorked: Prisma.Decimal | null
    tardinessMins: number
    undertimeMins: number
    overtimeHours: Prisma.Decimal | null
    nightDiffHours: Prisma.Decimal | null
    approvalStatusCode: string
  } | null = null

  if (payload.dtrId) {
    record = await db.dailyTimeRecord.findFirst({
      where: {
        id: payload.dtrId,
        employee: { companyId: context.companyId },
      },
      select: {
        id: true,
        actualTimeIn: true,
        actualTimeOut: true,
        attendanceStatus: true,
        remarks: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        approvalStatusCode: true,
      },
    })
  }

  if (!record) {
    record = await db.dailyTimeRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: payload.employeeId,
          attendanceDate,
        },
      },
      select: {
        id: true,
        actualTimeIn: true,
        actualTimeOut: true,
        attendanceStatus: true,
        remarks: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        approvalStatusCode: true,
      },
    })
  }

  const actualTimeIn = toDateTimeOnAttendanceDate(attendanceDate, payload.actualTimeIn || undefined)
  const rawActualTimeOut = toDateTimeOnAttendanceDate(attendanceDate, payload.actualTimeOut || undefined)

  if ((actualTimeIn && !rawActualTimeOut) || (!actualTimeIn && rawActualTimeOut)) {
    return { ok: false, error: "Both time in and time out are required when providing attendance time." }
  }

  const actualTimeOut = actualTimeIn && rawActualTimeOut ? ensureEndAfterStart(actualTimeIn, rawActualTimeOut) : rawActualTimeOut

  if (payload.attendanceStatus === "PRESENT" && (!actualTimeIn || !actualTimeOut)) {
    return { ok: false, error: "Present status requires both time in and time out." }
  }

  let hoursWorked = 0
  let overtimeHours = 0
  let nightDiffHours = 0
  let tardinessMins = 0
  let undertimeMins = 0

  if (actualTimeIn && actualTimeOut) {
    const breakMins = employee.workSchedule?.breakDurationMins ?? 60
    const totalMs = actualTimeOut.getTime() - actualTimeIn.getTime()
    hoursWorked = Math.max(0, (totalMs - breakMins * 60 * 1000) / (1000 * 60 * 60))
    nightDiffHours = calculateNightDiffHours(actualTimeIn, actualTimeOut)

    const scheduleTimes = getScheduleTimes(attendanceDate, employee.workSchedule)

    if (scheduleTimes.scheduledIn && scheduleTimes.scheduledOut) {
      const gracePeriod = employee.workSchedule?.gracePeriodMins ?? 0
      const lateBy = (actualTimeIn.getTime() - scheduleTimes.scheduledIn.getTime()) / (1000 * 60)
      if (lateBy > gracePeriod) {
        tardinessMins = Math.round(lateBy - gracePeriod)
      }

      const earlyBy = (scheduleTimes.scheduledOut.getTime() - actualTimeOut.getTime()) / (1000 * 60)
      if (earlyBy > 0) {
        undertimeMins = Math.round(earlyBy)
      }

      const overtimeMins = (actualTimeOut.getTime() - scheduleTimes.scheduledOut.getTime()) / (1000 * 60)
      if (overtimeMins > 0) {
        overtimeHours = overtimeMins / 60
      }
    }
  }

  const resolvedDayFraction: "FULL" | "HALF" =
    payload.dayFraction ??
    (isHalfDayRemarks(payload.remarks) || isHalfDayRemarks(record?.remarks) ? "HALF" : "FULL")
  const remarks = normalizeHalfDayToken(payload.remarks?.trim() || null, resolvedDayFraction)

  const updated = record
    ? await db.dailyTimeRecord.update({
        where: { id: record.id },
        data: {
          actualTimeIn,
          actualTimeOut,
          attendanceStatus: payload.attendanceStatus,
          remarks,
          hoursWorked,
          tardinessMins,
          undertimeMins,
          overtimeHours,
          nightDiffHours,
          approvalStatusCode: "APPROVED",
          approvedById: context.userId,
          approvedAt: new Date(),
          timeInSourceCode: actualTimeIn ? DtrSource.MANUAL : null,
          timeOutSourceCode: actualTimeOut ? DtrSource.MANUAL : null,
        },
      })
    : await db.dailyTimeRecord.create({
        data: {
          employeeId: payload.employeeId,
          attendanceDate,
          actualTimeIn,
          actualTimeOut,
          attendanceStatus: payload.attendanceStatus,
          remarks,
          hoursWorked,
          tardinessMins,
          undertimeMins,
          overtimeHours,
          nightDiffHours,
          approvalStatusCode: "APPROVED",
          approvedById: context.userId,
          approvedAt: new Date(),
          timeInSourceCode: actualTimeIn ? DtrSource.MANUAL : null,
          timeOutSourceCode: actualTimeOut ? DtrSource.MANUAL : null,
        },
      })

  const changes = [
    { fieldName: "actualTimeIn", oldValue: record?.actualTimeIn ?? null, newValue: updated.actualTimeIn },
    { fieldName: "actualTimeOut", oldValue: record?.actualTimeOut ?? null, newValue: updated.actualTimeOut },
    { fieldName: "attendanceStatus", oldValue: record?.attendanceStatus ?? null, newValue: updated.attendanceStatus },
    { fieldName: "remarks", oldValue: record?.remarks ?? null, newValue: updated.remarks },
    { fieldName: "hoursWorked", oldValue: toNumber(record?.hoursWorked ?? null), newValue: toNumber(updated.hoursWorked) },
    { fieldName: "tardinessMins", oldValue: record?.tardinessMins ?? 0, newValue: updated.tardinessMins },
    { fieldName: "undertimeMins", oldValue: record?.undertimeMins ?? 0, newValue: updated.undertimeMins },
    { fieldName: "overtimeHours", oldValue: toNumber(record?.overtimeHours ?? null), newValue: toNumber(updated.overtimeHours) },
    { fieldName: "nightDiffHours", oldValue: toNumber(record?.nightDiffHours ?? null), newValue: toNumber(updated.nightDiffHours) },
    {
      fieldName: "approvalStatusCode",
      oldValue: record?.approvalStatusCode ?? null,
      newValue: updated.approvalStatusCode,
    },
  ].filter((change) => JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue))

  await createAuditLog({
    tableName: "DailyTimeRecord",
    recordId: updated.id,
    action: record ? "UPDATE" : "CREATE",
    userId: context.userId,
    reason: record ? "DTR_RECORD_MANUAL_CORRECTION" : "DTR_RECORD_MANUAL_CREATION",
    changes,
  })

  revalidatePath(`/${context.companyId}/attendance/dtr`)
  revalidatePath(`/${context.companyId}/attendance/sync-biometrics`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    message: record
      ? "DTR record updated and approved."
      : "DTR record created and approved.",
  }
}
