import { z } from "zod"

const adjustmentTypeSchema = z.enum(["EARNING", "DEDUCTION"])

export const payslipAdjustmentsListInputSchema = z.object({
  companyId: z.string().uuid(),
  payslipId: z.string().uuid(),
})

export const upsertPayslipAdjustmentInputSchema = z.object({
  companyId: z.string().uuid(),
  payslipId: z.string().uuid(),
  type: adjustmentTypeSchema,
  description: z.string().trim().min(1).max(150),
  amount: z.coerce.number().positive().max(999999999),
  isTaxable: z.boolean().default(true),
})

export const removePayslipAdjustmentInputSchema = z.object({
  companyId: z.string().uuid(),
  payslipId: z.string().uuid(),
  adjustmentId: z.string().uuid(),
  type: adjustmentTypeSchema,
})

export type PayslipAdjustmentsListInput = z.infer<typeof payslipAdjustmentsListInputSchema>
export type UpsertPayslipAdjustmentInput = z.infer<typeof upsertPayslipAdjustmentInputSchema>
export type RemovePayslipAdjustmentInput = z.infer<typeof removePayslipAdjustmentInputSchema>
