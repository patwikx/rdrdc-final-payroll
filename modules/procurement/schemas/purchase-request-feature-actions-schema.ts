import { z } from "zod"

export const getPurchaseRequestFeatureInputSchema = z.object({
  companyId: z.string().uuid(),
})

export const updatePurchaseRequestFeatureInputSchema = z.object({
  companyId: z.string().uuid(),
  enabled: z.boolean(),
})

export type GetPurchaseRequestFeatureInput = z.infer<typeof getPurchaseRequestFeatureInputSchema>
export type UpdatePurchaseRequestFeatureInput = z.infer<typeof updatePurchaseRequestFeatureInputSchema>
