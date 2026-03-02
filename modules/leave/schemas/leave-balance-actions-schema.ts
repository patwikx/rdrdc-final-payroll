import { z } from "zod"

export const updateLeaveBalanceInputSchema = z.object({
  companyId: z.string().uuid(),
  leaveBalanceId: z.string().uuid(),
  currentBalance: z.coerce.number().finite().min(0).max(9999.99),
})

export type UpdateLeaveBalanceInput = z.infer<typeof updateLeaveBalanceInputSchema>
