import { z } from "zod"

const endpointSchema = z
  .string()
  .trim()
  .min(1, "Endpoint is required.")
  .refine((value) => value.startsWith("/"), "Endpoint must start with '/'.")

const manualOverrideSchema = z.object({
  legacyRecordId: z.string().trim().min(1, "Legacy record ID is required."),
  departmentId: z.string().uuid("Department is invalid.").optional(),
  requesterEmployeeNumber: z
    .string()
    .trim()
    .max(100, "Requester employee number is too long.")
    .optional()
    .transform((value) => value || undefined),
  requesterName: z
    .string()
    .trim()
    .max(200, "Requester name is too long.")
    .optional()
    .transform((value) => value || undefined),
  pendingApproverEmployeeNumber: z
    .string()
    .trim()
    .max(100, "Pending approver employee number is too long.")
    .optional()
    .transform((value) => value || undefined),
  recommendingApproverEmployeeNumber: z
    .string()
    .trim()
    .max(100, "Recommending approver employee number is too long.")
    .optional()
    .transform((value) => value || undefined),
  finalApproverEmployeeNumber: z
    .string()
    .trim()
    .max(100, "Final approver employee number is too long.")
    .optional()
    .transform((value) => value || undefined),
  departmentCode: z
    .string()
    .trim()
    .max(80, "Department code is too long.")
    .optional()
    .transform((value) => value || undefined),
  departmentName: z
    .string()
    .trim()
    .max(200, "Department name is too long.")
    .optional()
    .transform((value) => value || undefined),
})

export const syncLegacyMaterialRequestsInputSchema = z.object({
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
  materialRequestEndpoint: endpointSchema.default("/api/migration/material-requests"),
  timeoutMs: z
    .number()
    .int()
    .min(5000, "Timeout must be at least 5000ms.")
    .max(120000, "Timeout must not exceed 120000ms.")
    .default(30000),
  dryRun: z.boolean().default(true),
  targetLegacyRecordIds: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Legacy record ID is required.")
        .max(200, "Legacy record ID is too long.")
    )
    .max(2000, "Too many target legacy record IDs.")
    .optional(),
  manualOverrides: z.array(manualOverrideSchema).max(2000, "Too many manual overrides.").default([]),
})

export type SyncLegacyMaterialRequestsInput = z.infer<typeof syncLegacyMaterialRequestsInputSchema>
