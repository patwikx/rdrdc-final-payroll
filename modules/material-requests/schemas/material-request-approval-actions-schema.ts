import { z } from "zod"

export const getMaterialRequestsForMyApprovalInputSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export const decideMaterialRequestStepInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  remarks: z.string().trim().max(1000).optional(),
})

export const getMaterialRequestApprovalDecisionDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
})

export const getMaterialRequestApprovalHistoryDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const getMaterialRequestApprovalHistoryPageInputSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]).default("ALL"),
})

export type GetMaterialRequestsForMyApprovalInput = z.infer<typeof getMaterialRequestsForMyApprovalInputSchema>
export type DecideMaterialRequestStepInput = z.infer<typeof decideMaterialRequestStepInputSchema>
export type GetMaterialRequestApprovalDecisionDetailsInput = z.infer<
  typeof getMaterialRequestApprovalDecisionDetailsInputSchema
>
export type GetMaterialRequestApprovalHistoryDetailsInput = z.infer<
  typeof getMaterialRequestApprovalHistoryDetailsInputSchema
>
export type GetMaterialRequestApprovalHistoryPageInput = z.infer<typeof getMaterialRequestApprovalHistoryPageInputSchema>
