import { z } from "zod"

export const getMaterialRequestReceivingReportPageInputSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "PENDING_POSTING", "POSTED"]).default("ALL"),
  departmentId: z.string().uuid().optional(),
})

export const getMaterialRequestReceivingReportDetailsInputSchema = z.object({
  companyId: z.string().uuid(),
  reportId: z.string().uuid(),
})

export type GetMaterialRequestReceivingReportPageInput = z.infer<
  typeof getMaterialRequestReceivingReportPageInputSchema
>
export type GetMaterialRequestReceivingReportDetailsInput = z.infer<
  typeof getMaterialRequestReceivingReportDetailsInputSchema
>
