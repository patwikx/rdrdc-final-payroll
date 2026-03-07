import { z } from "zod"

import { ACCESS_SCOPES, COMPANY_ROLES } from "../../../auth/utils/authorization-policy.ts"

const companyRoleSchema = z.enum(COMPANY_ROLES)

const actionBaseSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
})

const companyActionSchema = z.object({
  companyId: z.string().uuid(),
})

const systemUserActionSchema = companyActionSchema.extend({
  userId: z.string().uuid(),
})
const accessScopeSchema = z.enum(ACCESS_SCOPES)
const employeePortalCapabilityOverrideEntrySchema = z.object({
  capability: z.string().trim().min(1),
  accessScope: accessScopeSchema,
})

export const createEmployeeSystemUserInputSchema = actionBaseSchema.extend({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(128),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
  isPurchaseRequestItemManager: z.boolean().default(false),
})

export const createStandaloneSystemUserInputSchema = companyActionSchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(128),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
  isPurchaseRequestItemManager: z.boolean().default(false),
  enableExternalRequesterProfile: z.boolean().default(false),
  externalRequesterBranchId: z.string().uuid().optional(),
  overrides: z.array(employeePortalCapabilityOverrideEntrySchema).default([]),
}).superRefine((value, ctx) => {
  if (value.enableExternalRequesterProfile && !value.externalRequesterBranchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["externalRequesterBranchId"],
      message: "Branch is required when External PR Requester Profile is enabled.",
    })
  }
})

export const linkEmployeeToUserInputSchema = actionBaseSchema.extend({
  userId: z.string().uuid(),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
  isPurchaseRequestItemManager: z.boolean().default(false),
})

export const unlinkEmployeeUserInputSchema = actionBaseSchema

export const updateEmployeeRequestApproverInputSchema = actionBaseSchema.extend({
  isRequestApprover: z.boolean(),
})

export const updateLinkedUserCredentialsInputSchema = actionBaseSchema.extend({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean(),
  companyRole: companyRoleSchema.optional(),
  isRequestApprover: z.boolean().optional(),
  isMaterialRequestPurchaser: z.boolean().optional(),
  isMaterialRequestPoster: z.boolean().optional(),
  isPurchaseRequestItemManager: z.boolean().optional(),
})

export const updateStandaloneSystemUserInputSchema = systemUserActionSchema.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean(),
  companyRole: companyRoleSchema,
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
  isPurchaseRequestItemManager: z.boolean().default(false),
  enableExternalRequesterProfile: z.boolean().default(false),
  externalRequesterBranchId: z.string().uuid().optional(),
  overrides: z.array(employeePortalCapabilityOverrideEntrySchema).default([]),
}).superRefine((value, ctx) => {
  if (value.enableExternalRequesterProfile && !value.externalRequesterBranchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["externalRequesterBranchId"],
      message: "Branch is required when External PR Requester Profile is enabled.",
    })
  }
})

export const deleteStandaloneSystemUserInputSchema = systemUserActionSchema

const companyAccessEntrySchema = z.object({
  companyId: z.string().uuid(),
  role: companyRoleSchema,
  isDefault: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
  isPurchaseRequestItemManager: z.boolean().default(false),
})

export const updateEmployeeCompanyAccessInputSchema = actionBaseSchema.extend({
  accesses: z
    .array(companyAccessEntrySchema)
    .min(1, "At least one company access assignment is required.")
    .superRefine((entries, ctx) => {
      const seen = new Set<string>()
      for (const entry of entries) {
        if (seen.has(entry.companyId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["accesses"],
            message: "Duplicate company access entries are not allowed.",
          })
          return
        }
        seen.add(entry.companyId)
      }
    }),
})

export const updateEmployeePortalCapabilityOverridesInputSchema = actionBaseSchema.extend({
  userId: z.string().uuid(),
  overrides: z
    .array(employeePortalCapabilityOverrideEntrySchema)
    .superRefine((entries, ctx) => {
      const seen = new Set<string>()
      for (const entry of entries) {
        if (seen.has(entry.capability)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["overrides"],
            message: "Duplicate employee portal capability overrides are not allowed.",
          })
          return
        }
        seen.add(entry.capability)
      }
    }),
})

export type CreateEmployeeSystemUserInput = z.infer<typeof createEmployeeSystemUserInputSchema>
export type CreateStandaloneSystemUserInput = z.infer<typeof createStandaloneSystemUserInputSchema>
export type LinkEmployeeToUserInput = z.infer<typeof linkEmployeeToUserInputSchema>
export type UnlinkEmployeeUserInput = z.infer<typeof unlinkEmployeeUserInputSchema>
export type UpdateEmployeeRequestApproverInput = z.infer<typeof updateEmployeeRequestApproverInputSchema>
export type UpdateLinkedUserCredentialsInput = z.infer<typeof updateLinkedUserCredentialsInputSchema>
export type UpdateStandaloneSystemUserInput = z.infer<typeof updateStandaloneSystemUserInputSchema>
export type DeleteStandaloneSystemUserInput = z.infer<typeof deleteStandaloneSystemUserInputSchema>
export type UpdateEmployeeCompanyAccessInput = z.infer<typeof updateEmployeeCompanyAccessInputSchema>
export type UpdateEmployeePortalCapabilityOverridesInput = z.infer<
  typeof updateEmployeePortalCapabilityOverridesInputSchema
>
