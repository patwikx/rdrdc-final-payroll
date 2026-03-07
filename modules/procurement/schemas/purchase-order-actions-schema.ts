import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (max: number) => z.preprocess(trimToUndefined, z.string().max(max).optional())

const createPurchaseOrderLineSchema = z.object({
  sourcePurchaseRequestItemId: z.string().uuid(),
  quantityOrdered: z.coerce.number().positive("Ordered quantity must be greater than zero."),
  unitPrice: z.coerce.number().min(0),
  remarks: optionalText(500),
})

const createPurchaseOrderGoodsReceiptLineSchema = z.object({
  purchaseOrderLineId: z.string().uuid(),
  receivedQuantity: z.coerce.number().min(0),
})

export const createPurchaseOrderInputSchema = z.object({
  companyId: z.string().uuid(),
  sourceRequestId: z.string().uuid(),
  supplierName: z.string().trim().min(1).max(200),
  paymentTerms: z.string().trim().min(1).max(100),
  saveAsDraft: z.boolean().default(false),
  applyVat: z.boolean().default(false),
  discount: z.coerce.number().min(0).default(0),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remarks: optionalText(1000),
  lines: z.array(createPurchaseOrderLineSchema).min(1),
})

export const openPurchaseOrderInputSchema = z.object({
  companyId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
})

export const closePurchaseOrderInputSchema = z.object({
  companyId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
})

export const closePurchaseOrderLineInputSchema = z.object({
  companyId: z.string().uuid(),
  purchaseOrderLineId: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is required.").max(1000),
})

export const cancelPurchaseOrderInputSchema = z.object({
  companyId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
})

export const createPurchaseOrderGoodsReceiptInputSchema = z.object({
  companyId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: optionalText(1000),
  lines: z.array(createPurchaseOrderGoodsReceiptLineSchema).min(1),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderInputSchema>
export type OpenPurchaseOrderInput = z.infer<typeof openPurchaseOrderInputSchema>
export type ClosePurchaseOrderInput = z.infer<typeof closePurchaseOrderInputSchema>
export type ClosePurchaseOrderLineInput = z.infer<typeof closePurchaseOrderLineInputSchema>
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderInputSchema>
export type CreatePurchaseOrderGoodsReceiptInput = z.infer<typeof createPurchaseOrderGoodsReceiptInputSchema>
