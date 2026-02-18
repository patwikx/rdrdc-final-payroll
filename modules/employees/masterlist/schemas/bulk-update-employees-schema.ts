import { z } from "zod"

export const bulkUpdateEmployeesInputSchema = z.object({
  companyId: z.string().uuid(),
  csvContent: z.string().min(1, "CSV content is required.").max(2_000_000, "CSV file is too large."),
  dryRun: z.boolean().default(true),
})

export type BulkUpdateEmployeesInput = z.infer<typeof bulkUpdateEmployeesInputSchema>
