import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  WORK_SCHEDULE_DAY_OPTIONS,
  type AttendanceRulesInput,
} from "@/modules/settings/attendance/schemas/attendance-rules-schema"

export type AttendanceRulesViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  schedules: Array<{
    id: string
    code: string
    name: string
    scheduleTypeCode: AttendanceRulesInput["scheduleTypeCode"]
    workStartTime: string
    workEndTime: string
    isActive: boolean
  }>
  form: AttendanceRulesInput
}

const toDateInputValue = (value: Date | null | undefined): string => {
  if (!value) {
    return ""
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toTimeInputValue = (value: Date | null | undefined): string => {
  if (!value) {
    return ""
  }

  const hour = String(value.getUTCHours()).padStart(2, "0")
  const minute = String(value.getUTCMinutes()).padStart(2, "0")
  return `${hour}:${minute}`
}

const getValidRestDays = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) {
    return new Set(["SATURDAY", "SUNDAY"])
  }

  const options = new Set(WORK_SCHEDULE_DAY_OPTIONS)
  const parsed = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toUpperCase())
    .filter((item): item is AttendanceRulesInput["daySchedules"][number]["dayOfWeek"] =>
      options.has(item as AttendanceRulesInput["daySchedules"][number]["dayOfWeek"])
    )

  return parsed.length > 0 ? new Set(parsed) : new Set(["SATURDAY", "SUNDAY"])
}

type DayOverrideRow = {
  timeIn?: string
  timeOut?: string
  isWorkingDay?: boolean
}

const getDayOverrides = (value: unknown): Partial<Record<AttendanceRulesInput["daySchedules"][number]["dayOfWeek"], DayOverrideRow>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const parsed = value as Record<string, unknown>
  const mapped: Partial<Record<AttendanceRulesInput["daySchedules"][number]["dayOfWeek"], DayOverrideRow>> = {}

  for (const day of WORK_SCHEDULE_DAY_OPTIONS) {
    const row = parsed[day]
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue
    }

    const rowObject = row as Record<string, unknown>
    mapped[day] = {
      timeIn: typeof rowObject.timeIn === "string" ? rowObject.timeIn : undefined,
      timeOut: typeof rowObject.timeOut === "string" ? rowObject.timeOut : undefined,
      isWorkingDay: typeof rowObject.isWorkingDay === "boolean" ? rowObject.isWorkingDay : undefined,
    }
  }

  return mapped
}

export async function getAttendanceRulesViewModel(companyId: string, selectedScheduleId?: string): Promise<AttendanceRulesViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const schedules = await db.workSchedule.findMany({
    where: { companyId: context.companyId },
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  })

  const schedule = selectedScheduleId
    ? schedules.find((item) => item.id === selectedScheduleId) ?? null
    : null
  const restDays = getValidRestDays(schedule?.restDays)
  const dayOverrides = getDayOverrides(schedule?.dayOverrides)
  const defaultTimeIn = toTimeInputValue(schedule?.workStartTime) || "08:00"
  const defaultTimeOut = toTimeInputValue(schedule?.workEndTime) || "17:00"
  const daySchedules: AttendanceRulesInput["daySchedules"] = WORK_SCHEDULE_DAY_OPTIONS.map((day) => {
    const override = dayOverrides[day]
    const isRestDay = restDays.has(day)

    return {
      dayOfWeek: day,
      isWorkingDay: override?.isWorkingDay ?? !isRestDay,
      timeIn: override?.timeIn ?? (isRestDay ? undefined : defaultTimeIn),
      timeOut: override?.timeOut ?? (isRestDay ? undefined : defaultTimeOut),
    }
  })

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    schedules: schedules.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      scheduleTypeCode: item.scheduleTypeCode,
      workStartTime: toTimeInputValue(item.workStartTime),
      workEndTime: toTimeInputValue(item.workEndTime),
      isActive: item.isActive,
    })),
    form: {
      companyId: context.companyId,
      workScheduleId: schedule?.id,
      code: schedule?.code ?? "",
      name: schedule?.name ?? "",
      description: schedule?.description ?? "",
      scheduleTypeCode: schedule?.scheduleTypeCode ?? "FIXED",
      breakStartTime: toTimeInputValue(schedule?.breakStartTime),
      breakEndTime: toTimeInputValue(schedule?.breakEndTime),
      breakDurationMins: schedule?.breakDurationMins ?? 60,
      gracePeriodMins: schedule?.gracePeriodMins ?? 10,
      requiredHoursPerDay: Number(schedule?.requiredHoursPerDay ?? 8),
      daySchedules,
      effectiveFrom: toDateInputValue(schedule?.effectiveFrom) || toDateInputValue(new Date()),
      effectiveTo: toDateInputValue(schedule?.effectiveTo),
      isActive: schedule?.isActive ?? true,
    },
  }
}
