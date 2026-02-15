"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  dtrEmployeeScheduleInputSchema,
  type DtrEmployeeScheduleInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import { formatWallClockTime, parsePhDateInput } from "@/modules/attendance/dtr/utils/wall-clock"

type GetEmployeeScheduleActionResult =
  | { ok: true; data: { timeIn: string; timeOut: string; name: string } }
  | { ok: false; error: string }

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const

const getPhDayIndex = (value: Date): number => {
  const dayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .toUpperCase()
  return DAY_NAMES.indexOf(dayName as (typeof DAY_NAMES)[number])
}

const timeString = (value: Date): string => formatWallClockTime(value)

export async function getEmployeeScheduleAction(params: {
  companyId: string
  employeeId: string
  attendanceDate: string
}): Promise<GetEmployeeScheduleActionResult> {
  const parsed = dtrEmployeeScheduleInputSchema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule request." }
  }

  const payload: DtrEmployeeScheduleInput = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to view work schedules." }
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
          name: true,
          workStartTime: true,
          workEndTime: true,
          dayOverrides: true,
        },
      },
    },
  })

  if (!employee?.workSchedule) {
    return { ok: false, error: "No work schedule assigned." }
  }

  const attendanceDate = parsePhDateInput(payload.attendanceDate)
  if (!attendanceDate) {
    return { ok: false, error: "Invalid attendance date." }
  }

  const dayIndex = getPhDayIndex(attendanceDate)
  const dayName = DAY_NAMES[Math.max(0, dayIndex)]
  const overrides =
    employee.workSchedule.dayOverrides &&
    typeof employee.workSchedule.dayOverrides === "object" &&
    !Array.isArray(employee.workSchedule.dayOverrides)
      ? (employee.workSchedule.dayOverrides as Record<string, { timeIn?: string; timeOut?: string; isWorkingDay?: boolean }>)
      : null

  const dayOverride = overrides?.[dayName]
  if (dayOverride?.isWorkingDay === false) {
    return { ok: false, error: "Selected day is configured as rest day." }
  }

  return {
    ok: true,
    data: {
      timeIn: dayOverride?.timeIn ?? timeString(employee.workSchedule.workStartTime),
      timeOut: dayOverride?.timeOut ?? timeString(employee.workSchedule.workEndTime),
      name: employee.workSchedule.name,
    },
  }
}
