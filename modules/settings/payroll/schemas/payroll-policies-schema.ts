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

export const PAY_FREQUENCY_OPTIONS = ["MONTHLY", "SEMI_MONTHLY", "BI_WEEKLY", "WEEKLY"] as const
export const PAY_PERIOD_HALF_OPTIONS = ["FIRST", "SECOND"] as const
export const STATUTORY_DEDUCTION_TIMING_OPTIONS = ["FIRST_HALF", "SECOND_HALF", "EVERY_PERIOD", "DISABLED"] as const

const statutoryDeductionScheduleSchema = z.object({
  sss: z.enum(STATUTORY_DEDUCTION_TIMING_OPTIONS),
  philHealth: z.enum(STATUTORY_DEDUCTION_TIMING_OPTIONS),
  pagIbig: z.enum(STATUTORY_DEDUCTION_TIMING_OPTIONS),
  withholdingTax: z.enum(STATUTORY_DEDUCTION_TIMING_OPTIONS),
})

const payrollPeriodRowSchema = z.object({
  id: z.preprocess(trimToUndefined, z.string().uuid().optional()),
  year: z.coerce.number().int().min(2000).max(2100),
  periodNumber: z.coerce.number().int().min(1).max(366),
  periodHalf: z.enum(PAY_PERIOD_HALF_OPTIONS),
  cutoffStartDate: z.string().date(),
  cutoffEndDate: z.string().date(),
  paymentDate: z.string().date(),
  statusCode: z.enum(["OPEN", "PROCESSING", "CLOSED", "LOCKED"] as const),
  workingDays: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
    return value
  }, z.coerce.number().int().min(0).max(31).optional()),
})

export const payrollPoliciesInputSchema = z.object({
  companyId: z.string().uuid(),
  patternId: z.preprocess(trimToUndefined, z.string().uuid().optional()),
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  description: optionalText(300),
  payFrequencyCode: z.enum(PAY_FREQUENCY_OPTIONS),
  periodsPerYear: z.coerce.number().int().min(1).max(366),
  statutoryDeductionSchedule: statutoryDeductionScheduleSchema,
  periodYear: z.coerce.number().int().min(2000).max(2100),
  paymentDayOffset: z.coerce.number().int().min(0).max(31),
  effectiveFrom: z.string().date(),
  effectiveTo: optionalDateString,
  isActive: z.boolean(),
  periodRows: z.array(payrollPeriodRowSchema).min(1),
})

export type PayrollPoliciesInput = z.infer<typeof payrollPoliciesInputSchema>
