import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())
const optionalUuid = z.preprocess(trimToUndefined, z.string().uuid().optional())

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined
  }

  return value
}, z.coerce.number().int().nonnegative().optional())

const optionalNonNegativeNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined
  }

  return value
}, z.coerce.number().nonnegative().optional())

const baseEntitySchema = z.object({
  id: optionalUuid,
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  description: optionalText(300),
  displayOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
})

const positionSchema = baseEntitySchema.extend({
  level: z.coerce.number().int().min(0).max(99),
  jobFamily: optionalText(80),
  jobGrade: optionalText(40),
  salaryGradeMin: optionalNonNegativeNumber,
  salaryGradeMax: optionalNonNegativeNumber,
  minExperienceYears: optionalNonNegativeInt,
  educationRequired: optionalText(120),
})

const employmentStatusSchema = baseEntitySchema.extend({
  allowsPayroll: z.boolean(),
  allowsLeave: z.boolean(),
  allowsLoans: z.boolean(),
  triggersOffboarding: z.boolean(),
})

const employmentTypeSchema = baseEntitySchema.extend({
  hasBenefits: z.boolean(),
  hasLeaveCredits: z.boolean(),
  has13thMonth: z.boolean(),
  hasMandatoryDeductions: z.boolean(),
  maxContractMonths: optionalNonNegativeInt,
})

const employmentClassSchema = baseEntitySchema.extend({
  standardHoursPerDay: z.coerce.number().positive().max(24),
  standardDaysPerWeek: z.coerce.number().int().min(1).max(7),
  isOvertimeEligible: z.boolean(),
  isHolidayPayEligible: z.boolean(),
})

export const upsertEmploymentEntityInputSchema = z.discriminatedUnion("entity", [
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("positions"),
    payload: positionSchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("employmentStatuses"),
    payload: employmentStatusSchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("employmentTypes"),
    payload: employmentTypeSchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("employmentClasses"),
    payload: employmentClassSchema,
  }),
])

export type UpsertEmploymentEntityInput = z.infer<typeof upsertEmploymentEntityInputSchema>
