import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())

const optionalDateString = z.preprocess(trimToUndefined, z.string().date().optional())

const optionalTimeString = z.preprocess(
  trimToUndefined,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional()
)

export const ATTENDANCE_SCHEDULE_TYPE_OPTIONS = [
  "FIXED",
  "FLEXIBLE",
  "SHIFTING",
  "COMPRESSED",
  "PART_TIME",
  "ON_CALL",
] as const

export const WORK_SCHEDULE_DAY_OPTIONS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const

const dayScheduleRowSchema = z
  .object({
    dayOfWeek: z.enum(WORK_SCHEDULE_DAY_OPTIONS),
    isWorkingDay: z.boolean(),
    timeIn: optionalTimeString,
    timeOut: optionalTimeString,
  })
  .superRefine((value, ctx) => {
    if (value.isWorkingDay && !value.timeIn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeIn"],
        message: "Time in is required for working days.",
      })
    }

    if (value.isWorkingDay && !value.timeOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeOut"],
        message: "Time out is required for working days.",
      })
    }
  })

export const attendanceRulesInputSchema = z.object({
  companyId: z.string().uuid(),
  workScheduleId: z.preprocess(trimToUndefined, z.string().uuid().optional()),
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  description: optionalText(300),
  scheduleTypeCode: z.enum(ATTENDANCE_SCHEDULE_TYPE_OPTIONS),
  breakStartTime: optionalTimeString,
  breakEndTime: optionalTimeString,
  breakDurationMins: z.coerce.number().int().min(0).max(240),
  gracePeriodMins: z.coerce.number().int().min(0).max(120),
  requiredHoursPerDay: z.coerce.number().min(1).max(24),
  daySchedules: z.array(dayScheduleRowSchema).length(7),
  effectiveFrom: z.string().date(),
  effectiveTo: optionalDateString,
  isActive: z.boolean(),
})

export type AttendanceRulesInput = z.infer<typeof attendanceRulesInputSchema>
