import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())

export const getProcurementItemCatalogInputSchema = z.object({
  companyId: z.string().uuid(),
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  includeInactive: z.boolean().optional(),
})

export const upsertProcurementItemCategoryInputSchema = z.object({
  companyId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  description: optionalText(1000),
  isActive: z.boolean().optional(),
})

export const upsertProcurementItemInputSchema = z.object({
  companyId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(240),
  description: optionalText(1500),
  uom: z.string().trim().min(1).max(40),
  unitPrice: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

export type GetProcurementItemCatalogInput = z.infer<typeof getProcurementItemCatalogInputSchema>
export type UpsertProcurementItemCategoryInput = z.infer<typeof upsertProcurementItemCategoryInputSchema>
export type UpsertProcurementItemInput = z.infer<typeof upsertProcurementItemInputSchema>
