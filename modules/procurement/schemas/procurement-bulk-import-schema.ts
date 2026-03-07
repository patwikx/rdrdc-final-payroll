import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())

export const bulkImportProcurementItemsInputSchema = z.object({
  companyId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        categoryCode: optionalText(60),
        categoryName: optionalText(120),
        itemCode: z.string().trim().min(1, "Item code is required.").max(60),
        itemName: z.string().trim().min(1, "Item name is required.").max(240),
        itemDescription: optionalText(1500),
        uom: z.string().trim().min(1, "UOM is required.").max(40),
        unitPrice: z.coerce.number().min(0).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .min(1, "At least one row is required.")
    .max(5000, "Maximum of 5,000 rows allowed per import."),
})

export type BulkImportProcurementItemsInput = z.infer<typeof bulkImportProcurementItemsInputSchema>

export const BULK_ITEM_TEMPLATE_HEADERS = [
  "categoryCode",
  "categoryName",
  "itemCode",
  "itemName",
  "itemDescription",
  "uom",
  "unitPrice",
  "isActive",
] as const

export type BulkItemTemplateHeader = (typeof BULK_ITEM_TEMPLATE_HEADERS)[number]

export const BULK_ITEM_REQUIRED_HEADERS: readonly BulkItemTemplateHeader[] = [
  "itemCode",
  "itemName",
  "uom",
]
