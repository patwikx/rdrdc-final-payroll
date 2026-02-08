import { z } from "zod"

const nonEmptyText = z
  .string()
  .trim()
  .min(2, "Please provide at least 2 characters.")
  .max(1000, "Please keep your input under 1000 characters.")

const actionBaseSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
})

export const approveApprovalQueueRequestInputSchema = actionBaseSchema.extend({
  remarks: nonEmptyText,
})

export const rejectApprovalQueueRequestInputSchema = actionBaseSchema.extend({
  reason: nonEmptyText,
})

export type ApproveApprovalQueueRequestInput = z.infer<typeof approveApprovalQueueRequestInputSchema>
export type RejectApprovalQueueRequestInput = z.infer<typeof rejectApprovalQueueRequestInputSchema>
