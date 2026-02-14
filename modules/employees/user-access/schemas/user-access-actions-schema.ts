import { z } from "zod"

import { COMPANY_ROLES } from "@/modules/auth/utils/authorization-policy"

const companyRoleSchema = z.enum(COMPANY_ROLES)

const actionBaseSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
})

export const createEmployeeSystemUserInputSchema = actionBaseSchema.extend({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
})

export const linkEmployeeToUserInputSchema = actionBaseSchema.extend({
  userId: z.string().uuid(),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
})

export const unlinkEmployeeUserInputSchema = actionBaseSchema

export const updateEmployeeRequestApproverInputSchema = actionBaseSchema.extend({
  isRequestApprover: z.boolean(),
})

export const updateLinkedUserCredentialsInputSchema = actionBaseSchema.extend({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean(),
  companyRole: companyRoleSchema.optional(),
  isRequestApprover: z.boolean().optional(),
  isMaterialRequestPurchaser: z.boolean().optional(),
  isMaterialRequestPoster: z.boolean().optional(),
})

const companyAccessEntrySchema = z.object({
  companyId: z.string().uuid(),
  role: companyRoleSchema,
  isDefault: z.boolean().default(false),
  isMaterialRequestPurchaser: z.boolean().default(false),
  isMaterialRequestPoster: z.boolean().default(false),
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

export type CreateEmployeeSystemUserInput = z.infer<typeof createEmployeeSystemUserInputSchema>
export type LinkEmployeeToUserInput = z.infer<typeof linkEmployeeToUserInputSchema>
export type UnlinkEmployeeUserInput = z.infer<typeof unlinkEmployeeUserInputSchema>
export type UpdateEmployeeRequestApproverInput = z.infer<typeof updateEmployeeRequestApproverInputSchema>
export type UpdateLinkedUserCredentialsInput = z.infer<typeof updateLinkedUserCredentialsInputSchema>
export type UpdateEmployeeCompanyAccessInput = z.infer<typeof updateEmployeeCompanyAccessInputSchema>
