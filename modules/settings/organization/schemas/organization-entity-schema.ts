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

const optionalNumber = z.preprocess((value) => {
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

const departmentEntitySchema = baseEntitySchema.extend({
  parentId: optionalUuid,
})

const divisionEntitySchema = baseEntitySchema.extend({
  parentId: optionalUuid,
})

const rankEntitySchema = baseEntitySchema.extend({
  level: z.coerce.number().int().min(0).max(99),
  category: optionalText(80),
  parentId: optionalUuid,
  salaryGradeMin: optionalNumber,
  salaryGradeMax: optionalNumber,
})

const branchEntitySchema = baseEntitySchema.extend({
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
})

export const upsertOrganizationEntityInputSchema = z.discriminatedUnion("entity", [
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("departments"),
    payload: departmentEntitySchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("divisions"),
    payload: divisionEntitySchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("ranks"),
    payload: rankEntitySchema,
  }),
  z.object({
    companyId: z.string().uuid(),
    entity: z.literal("branches"),
    payload: branchEntitySchema,
  }),
])

export type UpsertOrganizationEntityInput = z.infer<typeof upsertOrganizationEntityInputSchema>
