import { EducationLevel, RelationshipType } from "@prisma/client"
import { z } from "zod"

const baseContextSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().uuid(),
})

export const createDependentInputSchema = baseContextSchema.extend({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  relationshipId: z.nativeEnum(RelationshipType),
  birthDate: z.string().date().optional().or(z.literal("")),
  isTaxDependent: z.boolean(),
})

export const updateDependentInputSchema = createDependentInputSchema.extend({
  dependentId: z.string().uuid(),
})

export const deleteDependentInputSchema = baseContextSchema.extend({
  dependentId: z.string().uuid(),
})

export const createBeneficiaryInputSchema = baseContextSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(160),
  relationshipId: z.nativeEnum(RelationshipType),
  percentage: z.number().min(0).max(100),
  contactNumber: z.string().trim().max(40).optional(),
})

export const updateBeneficiaryInputSchema = createBeneficiaryInputSchema.extend({
  beneficiaryId: z.string().uuid(),
})

export const deleteBeneficiaryInputSchema = baseContextSchema.extend({
  beneficiaryId: z.string().uuid(),
})

export const createEducationInputSchema = baseContextSchema.extend({
  educationLevelId: z.nativeEnum(EducationLevel),
  schoolName: z.string().trim().min(1, "School name is required.").max(200),
  course: z.string().trim().max(200).optional(),
  yearGraduated: z.number().int().min(1900).max(2200).optional(),
})

export const updateEducationInputSchema = createEducationInputSchema.extend({
  educationId: z.string().uuid(),
})

export const deleteEducationInputSchema = baseContextSchema.extend({
  educationId: z.string().uuid(),
})

export type CreateDependentInput = z.infer<typeof createDependentInputSchema>
export type UpdateDependentInput = z.infer<typeof updateDependentInputSchema>
export type DeleteDependentInput = z.infer<typeof deleteDependentInputSchema>

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiaryInputSchema>
export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiaryInputSchema>
export type DeleteBeneficiaryInput = z.infer<typeof deleteBeneficiaryInputSchema>

export type CreateEducationInput = z.infer<typeof createEducationInputSchema>
export type UpdateEducationInput = z.infer<typeof updateEducationInputSchema>
export type DeleteEducationInput = z.infer<typeof deleteEducationInputSchema>
