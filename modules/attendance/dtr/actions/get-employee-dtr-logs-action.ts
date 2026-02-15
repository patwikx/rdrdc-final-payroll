"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { dtrEmployeeDateRangeInputSchema, type DtrEmployeeDateRangeInput } from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import type { DtrLogItem } from "@/modules/attendance/dtr/types"
import { createWallClockDateTime, ensureEndAfterStart, formatWallClockTime } from "@/modules/attendance/dtr/utils/wall-clock"

type GetEmployeeDtrLogsActionResult =
  | { ok: true; data: DtrLogItem[] }
  | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const

type WorkScheduleSnapshot = {
  workStartTime: Date
  workEndTime: Date
  gracePeriodMins: number
  dayOverrides: unknown
} | null

type DayOverride = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

const parseTimeOnAttendanceDate = (attendanceDate: Date, value: Date): Date | null => {
  const hhmm = formatWallClockTime(value)
  return hhmm ? createWallClockDateTime(attendanceDate, hhmm) : null
}

const getScheduleTimes = (
  attendanceDate: Date,
  workSchedule: WorkScheduleSnapshot
): { scheduledIn: Date | null; scheduledOut: Date | null } => {
  if (!workSchedule) {
    return { scheduledIn: null, scheduledOut: null }
  }

  const dayName = DAY_NAMES[new Date(attendanceDate).getUTCDay()]
  const overrides =
    workSchedule.dayOverrides && typeof workSchedule.dayOverrides === "object" && !Array.isArray(workSchedule.dayOverrides)
      ? (workSchedule.dayOverrides as Record<string, DayOverride>)
      : null
  const dayOverride = overrides?.[dayName]

  if (dayOverride?.isWorkingDay === false) {
    return { scheduledIn: null, scheduledOut: null }
  }

  if (dayOverride?.timeIn && dayOverride?.timeOut) {
    const scheduledIn = createWallClockDateTime(attendanceDate, dayOverride.timeIn)
    const scheduledOut = createWallClockDateTime(attendanceDate, dayOverride.timeOut)
    if (!scheduledIn || !scheduledOut) {
      return { scheduledIn: null, scheduledOut: null }
    }
    return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
  }

  const scheduledIn = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workStartTime)
  const scheduledOut = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workEndTime)
  if (!scheduledIn || !scheduledOut) {
    return { scheduledIn: null, scheduledOut: null }
  }
  return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
}

const computeScheduleBasedAttendanceMetrics = (log: {
  attendanceDate: Date
  actualTimeIn: Date | null
  actualTimeOut: Date | null
  scheduledTimeIn: Date | null
  scheduledTimeOut: Date | null
  tardinessMins: number
  undertimeMins: number
  overtimeHours: number
  workSchedule: WorkScheduleSnapshot
}): { tardinessMins: number; undertimeMins: number; overtimeHours: number } => {
  if (!log.actualTimeIn && !log.actualTimeOut) {
    return { tardinessMins: 0, undertimeMins: 0, overtimeHours: 0 }
  }

  let scheduledIn: Date | null = null
  let scheduledOut: Date | null = null

  if (log.scheduledTimeIn && log.scheduledTimeOut) {
    scheduledIn = parseTimeOnAttendanceDate(log.attendanceDate, log.scheduledTimeIn)
    scheduledOut = parseTimeOnAttendanceDate(log.attendanceDate, log.scheduledTimeOut)
    if (scheduledIn && scheduledOut) {
      scheduledOut = ensureEndAfterStart(scheduledIn, scheduledOut)
    }
  } else {
    const fromSchedule = getScheduleTimes(log.attendanceDate, log.workSchedule)
    scheduledIn = fromSchedule.scheduledIn
    scheduledOut = fromSchedule.scheduledOut
  }

  if (!scheduledIn && !scheduledOut) {
    return {
      tardinessMins: log.tardinessMins,
      undertimeMins: log.undertimeMins,
      overtimeHours: log.overtimeHours,
    }
  }

  const normalizedActualOut = log.actualTimeIn && log.actualTimeOut
    ? ensureEndAfterStart(log.actualTimeIn, log.actualTimeOut)
    : log.actualTimeOut
  const gracePeriodMins = log.workSchedule?.gracePeriodMins ?? 0

  const tardinessMins = scheduledIn && log.actualTimeIn
    ? Math.max(0, Math.round((log.actualTimeIn.getTime() - scheduledIn.getTime()) / (1000 * 60) - gracePeriodMins))
    : log.tardinessMins

  const undertimeMins = scheduledOut && normalizedActualOut
    ? Math.max(0, Math.round((scheduledOut.getTime() - normalizedActualOut.getTime()) / (1000 * 60)))
    : log.undertimeMins

  if (!scheduledOut || !normalizedActualOut) {
    return {
      tardinessMins,
      undertimeMins,
      overtimeHours: log.overtimeHours,
    }
  }

  const overtimeMinutes = (normalizedActualOut.getTime() - scheduledOut.getTime()) / (1000 * 60)
  const overtimeHours = overtimeMinutes > 0 ? Number((overtimeMinutes / 60).toFixed(2)) : 0

  return { tardinessMins, undertimeMins, overtimeHours }
}

export async function getEmployeeDtrLogsAction(params: {
  companyId: string
  employeeId: string
  startDate: string
  endDate: string
}): Promise<GetEmployeeDtrLogsActionResult> {
  const parsed = dtrEmployeeDateRangeInputSchema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid DTR filters." }
  }

  const payload: DtrEmployeeDateRangeInput = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to view DTR logs." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      workSchedule: {
        select: {
          workStartTime: true,
          workEndTime: true,
          gracePeriodMins: true,
          dayOverrides: true,
        },
      },
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  const logs = await db.dailyTimeRecord.findMany({
    where: {
      employeeId: payload.employeeId,
      attendanceDate: {
        gte: toPhDate(payload.startDate),
        lte: toPhDate(payload.endDate),
      },
    },
    orderBy: [{ attendanceDate: "asc" }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          photoUrl: true,
        },
      },
    },
  })

  return {
    ok: true,
    data: logs.map((log) => {
      const computedMetrics = computeScheduleBasedAttendanceMetrics({
        attendanceDate: log.attendanceDate,
        actualTimeIn: log.actualTimeIn,
        actualTimeOut: log.actualTimeOut,
        scheduledTimeIn: log.scheduledTimeIn,
        scheduledTimeOut: log.scheduledTimeOut,
        tardinessMins: log.tardinessMins,
        undertimeMins: log.undertimeMins,
        overtimeHours: Number(log.overtimeHours ?? 0),
        workSchedule: employee.workSchedule,
      })

      return {
        id: log.id,
        employeeId: log.employeeId,
        attendanceDate: log.attendanceDate.toISOString(),
        scheduledTimeIn: log.scheduledTimeIn ? log.scheduledTimeIn.toISOString() : null,
        scheduledTimeOut: log.scheduledTimeOut ? log.scheduledTimeOut.toISOString() : null,
        actualTimeIn: log.actualTimeIn ? log.actualTimeIn.toISOString() : null,
        actualTimeOut: log.actualTimeOut ? log.actualTimeOut.toISOString() : null,
        hoursWorked: Number(log.hoursWorked ?? 0),
        tardinessMins: computedMetrics.tardinessMins,
        undertimeMins: computedMetrics.undertimeMins,
        overtimeHours: computedMetrics.overtimeHours,
        nightDiffHours: Number(log.nightDiffHours ?? 0),
        attendanceStatus: log.attendanceStatus,
        approvalStatusCode: log.approvalStatusCode,
        remarks: log.remarks,
        employee: {
          id: log.employee.id,
          firstName: log.employee.firstName,
          lastName: log.employee.lastName,
          employeeNumber: log.employee.employeeNumber,
          photoUrl: log.employee.photoUrl,
        },
      }
    }),
  }
}
