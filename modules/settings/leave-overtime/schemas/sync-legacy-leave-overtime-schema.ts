import { z } from "zod"

const endpointSchema = z
  .string()
  .trim()
  .min(1, "Endpoint is required.")
  .refine((value) => value.startsWith("/"), "Endpoint must start with '/'.")

export const syncLegacyLeaveOvertimeInputSchema = z.object({
  companyId: z.string().uuid(),
  baseUrl: z.string().trim().url("Please enter a valid base URL."),
  legacyScopeId: z
    .string()
    .trim()
    .max(100, "Legacy scope ID is too long.")
    .optional()
    .transform((value) => value || undefined),
  apiToken: z
    .string()
    .trim()
    .max(2000, "Token is too long.")
    .optional()
    .transform((value) => value || undefined),
  leaveEndpoint: endpointSchema.default("/api/migration/leave-requests"),
  overtimeEndpoint: endpointSchema.default("/api/migration/overtime-requests"),
  balanceEndpoint: endpointSchema.default("/api/migration/leave-balances"),
  timeoutMs: z
    .number()
    .int()
    .min(5000, "Timeout must be at least 5000ms.")
    .max(120000, "Timeout must not exceed 120000ms.")
    .default(30000),
  dryRun: z.boolean().default(true),
})

export type SyncLegacyLeaveOvertimeInput = z.infer<typeof syncLegacyLeaveOvertimeInputSchema>
