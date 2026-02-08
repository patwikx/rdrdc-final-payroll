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

const optionalDecimal = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined
  }
  return value
}, z.coerce.number().nonnegative().optional())

const optionalInteger = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined
  }
  return value
}, z.coerce.number().int().nonnegative().optional())

const baseOrgItemSchema = z.object({
  id: optionalUuid,
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  description: optionalText(300),
  displayOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
})

export const organizationSetupInputSchema = z.object({
  companyId: z.string().uuid(),
  department: baseOrgItemSchema.extend({
    parentId: optionalUuid,
  }),
  position: baseOrgItemSchema.extend({
    jobFamily: optionalText(80),
    jobGrade: optionalText(40),
    salaryGradeMin: optionalDecimal,
    salaryGradeMax: optionalDecimal,
    level: z.coerce.number().int().min(0).max(99),
    minExperienceYears: optionalInteger,
    educationRequired: optionalText(120),
  }),
  branch: baseOrgItemSchema.extend({
    street: optionalText(200),
    barangay: optionalText(120),
    city: optionalText(120),
    municipality: optionalText(120),
    province: optionalText(120),
    region: optionalText(120),
    postalCode: optionalText(12),
    country: z.string().trim().min(2).max(120),
    phone: optionalText(30),
    email: z.preprocess(trimToUndefined, z.string().email().max(160).optional()),
    minimumWageRegion: optionalText(120),
  }),
  division: baseOrgItemSchema.extend({
    parentId: optionalUuid,
  }),
  rank: baseOrgItemSchema.extend({
    level: z.coerce.number().int().min(0).max(99),
    category: optionalText(80),
    parentId: optionalUuid,
    salaryGradeMin: optionalDecimal,
    salaryGradeMax: optionalDecimal,
  }),
})

export type OrganizationSetupInput = z.infer<typeof organizationSetupInputSchema>
