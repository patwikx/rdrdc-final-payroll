import { z } from "zod"

import { parsePhDateInputToUtcDateOnly, toPhDateInputValue } from "../../../../lib/ph-time.ts"

const MIN_REPORT_YEAR = 2000
const MAX_REPORT_YEAR = 2100

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalUuidSchema = z.preprocess(trimToUndefined, z.string().uuid().optional())
const optionalDateInputSchema = z.preprocess(
  trimToUndefined,
  z
    .string()
    .refine((value) => parseDateInput(value) !== null, "Invalid date input.")
    .optional()
)

const parseDateInput = (value: string): Date | null => {
  const parsed = parsePhDateInputToUtcDateOnly(value)
  if (!parsed) return null
  return toPhDateInputValue(parsed) === value ? parsed : null
}

const validateDateRange = (
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: z.RefinementCtx
): void => {
  if (!startDate || !endDate) return

  const parsedStart = parseDateInput(startDate)
  const parsedEnd = parseDateInput(endDate)
  if (!parsedStart || !parsedEnd) return

  if (parsedStart.getTime() > parsedEnd.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must not be earlier than start date.",
    })
  }
}

const validateYearMonth = (
  year: number | undefined,
  month: number | undefined,
  ctx: z.RefinementCtx
): void => {
  if (month !== undefined && year === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["year"],
      message: "Year is required when month is provided.",
    })
  }
}

export const reportBaseFilterSchema = z.object({
  companyId: z.string().uuid(),
  includeTrialRuns: z.coerce.boolean().default(false),
  topN: z.coerce.number().int().min(1).max(100).default(10),
})

export const reportQueryFilterSchema = reportBaseFilterSchema
  .extend({
    year: z.coerce.number().int().min(MIN_REPORT_YEAR).max(MAX_REPORT_YEAR).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    startDate: optionalDateInputSchema,
    endDate: optionalDateInputSchema,
    payPeriodId: optionalUuidSchema,
  })
  .superRefine((value, ctx) => {
    validateDateRange(value.startDate, value.endDate, ctx)
    validateYearMonth(value.year, value.month, ctx)
  })

export const reportDateRangeFilterSchema = reportBaseFilterSchema
  .extend({
    startDate: z.string().date(),
    endDate: z.string().date(),
    payPeriodId: optionalUuidSchema,
  })
  .superRefine((value, ctx) => {
    validateDateRange(value.startDate, value.endDate, ctx)
  })

export const reportMonthFilterSchema = reportBaseFilterSchema.extend({
  year: z.coerce.number().int().min(MIN_REPORT_YEAR).max(MAX_REPORT_YEAR),
  month: z.coerce.number().int().min(1).max(12),
})

export const reportPayPeriodFilterSchema = reportBaseFilterSchema.extend({
  payPeriodId: z.string().uuid(),
})

export type ReportBaseFilters = z.infer<typeof reportBaseFilterSchema>
export type ReportQueryFilters = z.infer<typeof reportQueryFilterSchema>
export type ReportDateRangeFilters = z.infer<typeof reportDateRangeFilterSchema>
export type ReportMonthFilters = z.infer<typeof reportMonthFilterSchema>
export type ReportPayPeriodFilters = z.infer<typeof reportPayPeriodFilterSchema>
