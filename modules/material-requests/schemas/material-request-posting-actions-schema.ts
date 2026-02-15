import { z } from "zod"

export const getMaterialRequestPostingPageInputSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "PENDING_POSTING", "POSTED"]).default("ALL"),
})

export const getMaterialRequestPostingDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const postMaterialRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  postingReference: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(1000).optional(),
})

export type GetMaterialRequestPostingPageInput = z.infer<typeof getMaterialRequestPostingPageInputSchema>
export type GetMaterialRequestPostingDetailsInput = z.infer<typeof getMaterialRequestPostingDetailsInputSchema>
export type PostMaterialRequestInput = z.infer<typeof postMaterialRequestInputSchema>
