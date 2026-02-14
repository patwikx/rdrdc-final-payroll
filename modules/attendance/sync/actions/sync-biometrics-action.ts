"use server"

import { AttendanceStatus, DtrApprovalStatus, DtrSource } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createWallClockDateTime,
  ensureEndAfterStart,
  formatWallClockTime,
  parsePhDateInput,
} from "@/modules/attendance/dtr/utils/wall-clock"

type SyncResult = {
  ok: true
  data: {
    recordsProcessed: number
    recordsCreated: number
    recordsUpdated: number
    recordsSkipped: number
    parseErrors: Array<{ line: string; reason: string }>
    validationErrors: Array<{ employeeNumber: string; date: string; reason: string }>
  }
} | {
  ok: false
  error: string
}

type DayOverride = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
const syncBiometricsInputSchema = z.object({
  companyId: z.string().uuid(),
  fileContent: z.string().min(1, "Attendance file is empty."),
})

const parseDateValue = (value: string): Date | null => {
  return parsePhDateInput(value.replaceAll("/", "-"))
}

const buildDateTime = (attendanceDate: Date, hhmm: string): Date | null => {
  if (!/^\d{4}$/.test(hhmm)) {
    return null
  }

  const hour = Number(hhmm.slice(0, 2))
  const minute = Number(hhmm.slice(2, 4))
  if (hour > 23 || minute > 59) {
    return null
  }

  return createWallClockDateTime(attendanceDate, `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`)
}

const parseTimeString = (attendanceDate: Date, value: string): Date | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null
  }

  return createWallClockDateTime(attendanceDate, value)
}

const parseScheduleTime = (attendanceDate: Date, value: Date): Date => {
  const parsed = createWallClockDateTime(attendanceDate, formatWallClockTime(value))
  if (!parsed) {
    throw new Error("Invalid work schedule time.")
  }
  return parsed
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
    const scheduledIn = parseTimeString(attendanceDate, dayOverride.timeIn)
    const scheduledOut = parseTimeString(attendanceDate, dayOverride.timeOut)
    if (!scheduledIn || !scheduledOut) {
      return { scheduledIn: null, scheduledOut: null }
    }

    return {
      scheduledIn,
      scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut),
    }
  }

  const scheduledIn = parseScheduleTime(attendanceDate, workSchedule.workStartTime)
  const scheduledOut = parseScheduleTime(attendanceDate, workSchedule.workEndTime)
  return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
}

export async function syncBiometricsAction(params: { companyId: string; fileContent: string }): Promise<SyncResult> {
  const parsedInput = syncBiometricsInputSchema.safeParse(params)
  if (!parsedInput.success) {
    return { ok: false, error: parsedInput.error.issues[0]?.message ?? "Invalid biometrics sync input." }
  }

  const payload = parsedInput.data
  if (!payload.fileContent.trim()) {
    return { ok: false, error: "Attendance file is empty." }
  }

  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to sync biometrics." }
  }

  const lines = payload.fileContent.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const parseErrors: Array<{ line: string; reason: string }> = []
  const validationErrors: Array<{ employeeNumber: string; date: string; reason: string }> = []

  const grouped = new Map<
    string,
    { key: string; employeeNumber: string; dateText: string; attendanceDate: Date; in?: Date; out?: Date }
  >()

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) {
      parseErrors.push({ line, reason: "Invalid format. Expected employee/date/time/type." })
      continue
    }

    const employeeNumber = parts[0]
    const dateText = parts[1].replaceAll("/", "-")
    const timeText = parts[2]
    const typeCode = parts[3]

    const attendanceDate = parseDateValue(dateText)
    if (!attendanceDate) {
      parseErrors.push({ line, reason: "Invalid date format." })
      continue
    }

    const clockTime = buildDateTime(attendanceDate, timeText)
    if (!clockTime) {
      parseErrors.push({ line, reason: "Invalid time format." })
      continue
    }

    if (typeCode !== "0" && typeCode !== "1") {
      parseErrors.push({ line, reason: "Unknown type code. Use 0 for IN and 1 for OUT." })
      continue
    }

    const key = `${employeeNumber}_${dateText}`
    const current = grouped.get(key) ?? { key, employeeNumber, dateText, attendanceDate }

    if (typeCode === "0") {
      if (!current.in || clockTime < current.in) {
        current.in = clockTime
      }
    }

    if (typeCode === "1") {
      if (!current.out || clockTime > current.out) {
        current.out = clockTime
      }
    }

    grouped.set(key, current)
  }

  const sortedByEmployeeAndDate = Array.from(grouped.values()).sort((a, b) => {
    if (a.employeeNumber !== b.employeeNumber) {
      return a.employeeNumber.localeCompare(b.employeeNumber)
    }
    return a.attendanceDate.getTime() - b.attendanceDate.getTime()
  })

  for (let index = 0; index < sortedByEmployeeAndDate.length - 1; index += 1) {
    const current = sortedByEmployeeAndDate[index]
    if (!current.in || current.out) {
      continue
    }

    const next = sortedByEmployeeAndDate[index + 1]
    if (!next || next.employeeNumber !== current.employeeNumber || next.in || !next.out) {
      continue
    }

    const dayGap = Math.round((next.attendanceDate.getTime() - current.attendanceDate.getTime()) / (24 * 60 * 60 * 1000))
    if (dayGap !== 1) {
      continue
    }

    current.out = next.out
    grouped.set(current.key, current)
    grouped.delete(next.key)
  }

  const employeeNumbers = Array.from(new Set(Array.from(grouped.values()).map((item) => item.employeeNumber)))
  const employees = await db.employee.findMany({
    where: {
      companyId: context.companyId,
      employeeNumber: { in: employeeNumbers },
      deletedAt: null,
    },
    select: {
      id: true,
      employeeNumber: true,
      workSchedule: {
        select: {
          workStartTime: true,
          workEndTime: true,
          breakDurationMins: true,
          gracePeriodMins: true,
          dayOverrides: true,
        },
      },
    },
  })

  const employeeByNumber = new Map(employees.map((employee) => [employee.employeeNumber, employee]))

  let recordsProcessed = 0
  let recordsCreated = 0
  let recordsUpdated = 0
  let recordsSkipped = 0

  for (const item of grouped.values()) {
    const employee = employeeByNumber.get(item.employeeNumber)
    if (!employee) {
      recordsSkipped += 1
      validationErrors.push({
        employeeNumber: item.employeeNumber,
        date: item.dateText,
        reason: "Employee number not found in this company.",
      })
      continue
    }

    if (!item.in || !item.out) {
      recordsSkipped += 1
      validationErrors.push({
        employeeNumber: item.employeeNumber,
        date: item.dateText,
        reason: "Both IN and OUT logs are required.",
      })
      continue
    }

    const normalizedTimeOut = ensureEndAfterStart(item.in, item.out)

    const schedule = getScheduleTimes(item.attendanceDate, employee.workSchedule)
    const breakMins = employee.workSchedule?.breakDurationMins ?? 60
    const graceMins = employee.workSchedule?.gracePeriodMins ?? 0

    const durationMs = normalizedTimeOut.getTime() - item.in.getTime()
    const hoursWorked = Math.max(0, (durationMs - breakMins * 60 * 1000) / (1000 * 60 * 60))
    const nightDiffHours = calculateNightDiffHours(item.in, normalizedTimeOut)

    let tardinessMins = 0
    let undertimeMins = 0
    let overtimeHours = 0

    if (schedule.scheduledIn && schedule.scheduledOut) {
      const lateBy = (item.in.getTime() - schedule.scheduledIn.getTime()) / (1000 * 60)
      if (lateBy > graceMins) {
        tardinessMins = Math.round(lateBy - graceMins)
      }

      const earlyBy = (schedule.scheduledOut.getTime() - normalizedTimeOut.getTime()) / (1000 * 60)
      if (earlyBy > 0) {
        undertimeMins = Math.round(earlyBy)
      }

      const overtimeMins = (normalizedTimeOut.getTime() - schedule.scheduledOut.getTime()) / (1000 * 60)
      if (overtimeMins > 0) {
        overtimeHours = overtimeMins / 60
      }
    }

    const existing = await db.dailyTimeRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: item.attendanceDate,
        },
      },
      select: { id: true },
    })

    await db.dailyTimeRecord.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: item.attendanceDate,
        },
      },
      create: {
        employeeId: employee.id,
        attendanceDate: item.attendanceDate,
        scheduledTimeIn: schedule.scheduledIn,
        scheduledTimeOut: schedule.scheduledOut,
        actualTimeIn: item.in,
        actualTimeOut: normalizedTimeOut,
        timeInSourceCode: DtrSource.BIOMETRIC,
        timeOutSourceCode: DtrSource.BIOMETRIC,
        attendanceStatus: AttendanceStatus.PRESENT,
        hoursWorked,
        tardinessMins,
        undertimeMins,
        overtimeHours,
        nightDiffHours,
        approvalStatusCode: DtrApprovalStatus.APPROVED,
      },
      update: {
        scheduledTimeIn: schedule.scheduledIn,
        scheduledTimeOut: schedule.scheduledOut,
        actualTimeIn: item.in,
        actualTimeOut: normalizedTimeOut,
        timeInSourceCode: DtrSource.BIOMETRIC,
        timeOutSourceCode: DtrSource.BIOMETRIC,
        attendanceStatus: AttendanceStatus.PRESENT,
        hoursWorked,
        tardinessMins,
        undertimeMins,
        overtimeHours,
        nightDiffHours,
        approvalStatusCode: DtrApprovalStatus.APPROVED,
      },
    })

    recordsProcessed += 1
    if (existing) {
      recordsUpdated += 1
    } else {
      recordsCreated += 1
    }
  }

  revalidatePath(`/${context.companyId}/attendance/dtr`)
  revalidatePath(`/${context.companyId}/dashboard`)

  return {
    ok: true,
    data: {
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      parseErrors,
      validationErrors,
    },
  }
}
