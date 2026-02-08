import { z } from "zod"

export const initializeLeaveBalancesForYearInputSchema = z.object({
  companyId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
})

export type InitializeLeaveBalancesForYearInput = z.infer<typeof initializeLeaveBalancesForYearInputSchema>
