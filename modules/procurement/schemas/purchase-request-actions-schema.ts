import { MaterialRequestSeries, MaterialRequestType, PurchaseRequestItemSource } from "@prisma/client"
import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const MAX_UNIT_PRICE = 999999.99

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())
const optionalUuid = z.preprocess(trimToUndefined, z.string().uuid().optional())

const itemSchema = z.object({
  source: z.nativeEnum(PurchaseRequestItemSource).optional(),
  procurementItemId: z.string().uuid("Catalog item is required."),
  itemCode: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(500),
  uom: z.string().trim().min(1).max(40),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce
    .number()
    .min(0)
    .max(MAX_UNIT_PRICE, "Unit price must not exceed 6 digits before the decimal.")
    .optional(),
  remarks: optionalText(500),
})

const purchaseRequestDraftSchema = z
  .object({
    companyId: z.string().uuid(),
    series: z.nativeEnum(MaterialRequestSeries),
    requestType: z.nativeEnum(MaterialRequestType),
    datePrepared: z.string().regex(datePattern, "Prepared date is invalid."),
    dateRequired: z.string().regex(datePattern, "Required date is invalid."),
    departmentId: z.string().uuid(),
    selectedInitialApproverUserId: optionalUuid,
    selectedStepTwoApproverUserId: optionalUuid,
    selectedStepThreeApproverUserId: optionalUuid,
    selectedStepFourApproverUserId: optionalUuid,
    purpose: optionalText(4000),
    remarks: optionalText(2000),
    deliverTo: optionalText(200),
    items: z.array(itemSchema).min(1, "At least one item is required.").max(300),
  })
  .superRefine((value, ctx) => {
    if (value.datePrepared > value.dateRequired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["datePrepared"],
        message: "Prepared date must be on or before required date.",
      })
    }

    for (const [index, item] of value.items.entries()) {
      if (item.source && item.source !== PurchaseRequestItemSource.CATALOG) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "source"],
          message: "Only catalog items are allowed for purchase request lines.",
        })
      }
    }
  })

export const createPurchaseRequestDraftInputSchema = purchaseRequestDraftSchema

export const updatePurchaseRequestDraftInputSchema = purchaseRequestDraftSchema.extend({
  requestId: z.string().uuid(),
})

export const submitPurchaseRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const cancelPurchaseRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  reason: optionalText(1000),
})

export const approvePurchaseRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  remarks: optionalText(1000),
})

export const rejectPurchaseRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  remarks: z.string().trim().min(1).max(1000),
})

export const getPurchaseRequestApprovalDecisionDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
})

export type CreatePurchaseRequestDraftInput = z.infer<typeof createPurchaseRequestDraftInputSchema>
export type UpdatePurchaseRequestDraftInput = z.infer<typeof updatePurchaseRequestDraftInputSchema>
export type SubmitPurchaseRequestInput = z.infer<typeof submitPurchaseRequestInputSchema>
export type CancelPurchaseRequestInput = z.infer<typeof cancelPurchaseRequestInputSchema>
export type ApprovePurchaseRequestInput = z.infer<typeof approvePurchaseRequestInputSchema>
export type RejectPurchaseRequestInput = z.infer<typeof rejectPurchaseRequestInputSchema>
export type GetPurchaseRequestApprovalDecisionDetailsInput = z.infer<
  typeof getPurchaseRequestApprovalDecisionDetailsInputSchema
>
