import { z } from "zod"

export const getMaterialRequestProcessingPageInputSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["OPEN", "ALL", "PENDING_PURCHASER", "IN_PROGRESS", "COMPLETED"]).default("OPEN"),
})

export const getMaterialRequestProcessingDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const updateMaterialRequestProcessingStatusInputSchema = z
  .object({
    companyId: z.string().uuid(),
    requestId: z.string().uuid(),
    status: z.enum(["IN_PROGRESS", "COMPLETED"]),
    remarks: z.string().trim().max(1000).optional(),
    processingPoNumber: z.string().trim().max(80).optional(),
    processingSupplierName: z.string().trim().max(160).optional(),
    servedItems: z
      .array(
        z.object({
          materialRequestItemId: z.string().uuid(),
          quantityServed: z.coerce.number().positive(),
        })
      )
      .max(200)
      .optional(),
  })
  .superRefine((value, context) => {
    const servedItems = value.servedItems ?? []

    if (servedItems.length > 0) {
      const seenItemIds = new Set<string>()
      for (const [index, servedItem] of servedItems.entries()) {
        if (seenItemIds.has(servedItem.materialRequestItemId)) {
          context.addIssue({
            code: "custom",
            path: ["servedItems", index, "materialRequestItemId"],
            message: "Each request item can only appear once per serve action.",
          })
          continue
        }

        seenItemIds.add(servedItem.materialRequestItemId)
      }
    }

    if (value.status !== "IN_PROGRESS") {
      return
    }

    if (!value.processingPoNumber?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["processingPoNumber"],
        message: "PO # is required when marking request as served.",
      })
    }

    if (!value.processingSupplierName?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["processingSupplierName"],
        message: "Supplier is required when marking request as served.",
      })
    }

    if (servedItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["servedItems"],
        message: "At least one line item quantity is required when marking request as served.",
      })
    }
  })

export type GetMaterialRequestProcessingPageInput = z.infer<typeof getMaterialRequestProcessingPageInputSchema>
export type GetMaterialRequestProcessingDetailsInput = z.infer<typeof getMaterialRequestProcessingDetailsInputSchema>
export type UpdateMaterialRequestProcessingStatusInput = z.infer<
  typeof updateMaterialRequestProcessingStatusInputSchema
>
