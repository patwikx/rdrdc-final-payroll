import { MaterialRequestItemSource, MaterialRequestSeries, MaterialRequestType } from "@prisma/client"
import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

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
  source: z.nativeEnum(MaterialRequestItemSource).optional(),
  itemCode: optionalText(60),
  description: z.string().trim().min(1).max(500),
  uom: z.string().trim().min(1).max(40),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: z.coerce.number().min(0).optional(),
  remarks: optionalText(500),
})

const materialRequestDraftSchema = z
  .object({
    companyId: z.string().uuid(),
    series: z.nativeEnum(MaterialRequestSeries),
    requestType: z.nativeEnum(MaterialRequestType),
    datePrepared: z.string().regex(datePattern, "Prepared date is invalid."),
    dateRequired: z.string().regex(datePattern, "Required date is invalid."),
    departmentId: optionalUuid,
    selectedInitialApproverUserId: optionalUuid,
    selectedStepTwoApproverUserId: optionalUuid,
    selectedStepThreeApproverUserId: optionalUuid,
    selectedStepFourApproverUserId: optionalUuid,
    chargeTo: optionalText(200),
    bldgCode: optionalText(60),
    purpose: optionalText(4000),
    remarks: optionalText(2000),
    deliverTo: optionalText(200),
    isStoreUse: z.boolean().optional(),
    freight: z.coerce.number().min(0).default(0),
    discount: z.coerce.number().min(0).default(0),
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
  })

export const createMaterialRequestDraftInputSchema = materialRequestDraftSchema

export const updateMaterialRequestDraftInputSchema = materialRequestDraftSchema.extend({
  requestId: z.string().uuid(),
})

export const submitMaterialRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const cancelMaterialRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  reason: optionalText(1000),
})

export type CreateMaterialRequestDraftInput = z.infer<typeof createMaterialRequestDraftInputSchema>
export type UpdateMaterialRequestDraftInput = z.infer<typeof updateMaterialRequestDraftInputSchema>
export type SubmitMaterialRequestInput = z.infer<typeof submitMaterialRequestInputSchema>
export type CancelMaterialRequestInput = z.infer<typeof cancelMaterialRequestInputSchema>
