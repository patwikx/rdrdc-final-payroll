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
})

export const linkEmployeeToUserInputSchema = actionBaseSchema.extend({
  userId: z.string().uuid(),
  companyRole: companyRoleSchema.default("EMPLOYEE"),
  isRequestApprover: z.boolean().default(false),
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
})

export type CreateEmployeeSystemUserInput = z.infer<typeof createEmployeeSystemUserInputSchema>
export type LinkEmployeeToUserInput = z.infer<typeof linkEmployeeToUserInputSchema>
export type UnlinkEmployeeUserInput = z.infer<typeof unlinkEmployeeUserInputSchema>
export type UpdateEmployeeRequestApproverInput = z.infer<typeof updateEmployeeRequestApproverInputSchema>
export type UpdateLinkedUserCredentialsInput = z.infer<typeof updateLinkedUserCredentialsInputSchema>
