import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const WORK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const

type DayPreview = {
  day: (typeof WORK_DAYS)[number]
  isWorkingDay: boolean
  timeIn: string
  timeOut: string
}

export type AttendanceScheduleCard = {
  id: string
  code: string
  name: string
  scheduleType: string
  isActive: boolean
  breakDurationMins: number
  gracePeriodMins: number
  requiredHoursPerDay: number
  effectiveFrom: string
  effectiveTo: string
  dayPreview: DayPreview[]
}

export type AttendanceSchedulesViewModel = {
  companyName: string
  schedules: AttendanceScheduleCard[]
}

const formatDateLabel = (value: Date | null): string => {
  if (!value) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const formatTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value)
}

type DayOverrideRow = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

const getDayOverrides = (value: unknown): Partial<Record<(typeof WORK_DAYS)[number], DayOverrideRow>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const parsed = value as Record<string, unknown>
  const mapped: Partial<Record<(typeof WORK_DAYS)[number], DayOverrideRow>> = {}

  for (const day of WORK_DAYS) {
    const row = parsed[day]
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue
    }

    const rowObject = row as Record<string, unknown>
    mapped[day] = {
      isWorkingDay: typeof rowObject.isWorkingDay === "boolean" ? rowObject.isWorkingDay : undefined,
      timeIn: typeof rowObject.timeIn === "string" ? rowObject.timeIn : undefined,
      timeOut: typeof rowObject.timeOut === "string" ? rowObject.timeOut : undefined,
    }
  }

  return mapped
}

const getRestDays = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) {
    return new Set(["SATURDAY", "SUNDAY"])
  }

  const parsed = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toUpperCase())

  return new Set(parsed)
}

export async function getAttendanceSchedulesViewModel(companyId: string): Promise<AttendanceSchedulesViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
    throw new Error("ACCESS_DENIED")
  }

  const schedules = await db.workSchedule.findMany({
    where: { companyId: context.companyId },
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  })

  return {
    companyName: context.companyName,
    schedules: schedules.map((schedule) => {
      const restDays = getRestDays(schedule.restDays)
      const overrides = getDayOverrides(schedule.dayOverrides)
      const defaultTimeIn = formatTimeLabel(schedule.workStartTime)
      const defaultTimeOut = formatTimeLabel(schedule.workEndTime)

      const dayPreview: DayPreview[] = WORK_DAYS.map((day) => {
        const override = overrides[day]
        const isWorkingDay = override?.isWorkingDay ?? !restDays.has(day)

        return {
          day,
          isWorkingDay,
          timeIn: isWorkingDay ? (override?.timeIn ?? defaultTimeIn) : "-",
          timeOut: isWorkingDay ? (override?.timeOut ?? defaultTimeOut) : "-",
        }
      })

      return {
        id: schedule.id,
        code: schedule.code,
        name: schedule.name,
        scheduleType: schedule.scheduleTypeCode,
        isActive: schedule.isActive,
        breakDurationMins: schedule.breakDurationMins,
        gracePeriodMins: schedule.gracePeriodMins,
        requiredHoursPerDay: Number(schedule.requiredHoursPerDay),
        effectiveFrom: formatDateLabel(schedule.effectiveFrom),
        effectiveTo: formatDateLabel(schedule.effectiveTo),
        dayPreview,
      }
    }),
  }
}
