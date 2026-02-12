import { EmployeeMovementType, SalaryAdjustmentType } from "@prisma/client"
import { z } from "zod"

const baseContextSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().uuid(),
})

const requiredDate = z.string().date("Please select a valid effective date.")

export const createSalaryHistoryInputSchema = baseContextSchema.extend({
  effectiveDate: requiredDate,
  newSalary: z.number().positive("Salary must be greater than zero."),
  adjustmentTypeCode: z.nativeEnum(SalaryAdjustmentType),
  reason: z.string().trim().max(200).optional(),
})

export const updateSalaryHistoryInputSchema = createSalaryHistoryInputSchema.extend({
  historyId: z.string().uuid(),
})

export const deleteSalaryHistoryInputSchema = baseContextSchema.extend({
  historyId: z.string().uuid(),
})

export const createPositionHistoryInputSchema = baseContextSchema.extend({
  effectiveDate: requiredDate,
  newPositionId: z.string().uuid(),
  newDepartmentId: z.string().uuid().optional().or(z.literal("")),
  newBranchId: z.string().uuid().optional().or(z.literal("")),
  movementType: z.nativeEnum(EmployeeMovementType),
  reason: z.string().trim().max(200).optional(),
})

export const updatePositionHistoryInputSchema = createPositionHistoryInputSchema.extend({
  historyId: z.string().uuid(),
})

export const deletePositionHistoryInputSchema = baseContextSchema.extend({
  historyId: z.string().uuid(),
})

export const createStatusHistoryInputSchema = baseContextSchema.extend({
  effectiveDate: requiredDate,
  newStatusId: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
})

export const updateStatusHistoryInputSchema = createStatusHistoryInputSchema.extend({
  historyId: z.string().uuid(),
})

export const deleteStatusHistoryInputSchema = baseContextSchema.extend({
  historyId: z.string().uuid(),
})

export const createRankHistoryInputSchema = baseContextSchema.extend({
  effectiveDate: requiredDate,
  newRankId: z.string().uuid(),
  movementType: z.nativeEnum(EmployeeMovementType),
  reason: z.string().trim().max(200).optional(),
})

export const updateRankHistoryInputSchema = createRankHistoryInputSchema.extend({
  historyId: z.string().uuid(),
})

export const deleteRankHistoryInputSchema = baseContextSchema.extend({
  historyId: z.string().uuid(),
})

export const createPreviousEmploymentInputSchema = baseContextSchema.extend({
  companyName: z.string().trim().min(1, "Company name is required.").max(160),
  position: z.string().trim().max(120).optional(),
  startDate: z.string().date().optional().or(z.literal("")),
  endDate: z.string().date().optional().or(z.literal("")),
  lastSalary: z.number().nonnegative("Salary cannot be negative.").optional(),
})

export const updatePreviousEmploymentInputSchema = createPreviousEmploymentInputSchema.extend({
  historyId: z.string().uuid(),
})

export const deletePreviousEmploymentInputSchema = baseContextSchema.extend({
  historyId: z.string().uuid(),
})

export type CreateSalaryHistoryInput = z.infer<typeof createSalaryHistoryInputSchema>
export type UpdateSalaryHistoryInput = z.infer<typeof updateSalaryHistoryInputSchema>
export type DeleteSalaryHistoryInput = z.infer<typeof deleteSalaryHistoryInputSchema>

export type CreatePositionHistoryInput = z.infer<typeof createPositionHistoryInputSchema>
export type UpdatePositionHistoryInput = z.infer<typeof updatePositionHistoryInputSchema>
export type DeletePositionHistoryInput = z.infer<typeof deletePositionHistoryInputSchema>

export type CreateStatusHistoryInput = z.infer<typeof createStatusHistoryInputSchema>
export type UpdateStatusHistoryInput = z.infer<typeof updateStatusHistoryInputSchema>
export type DeleteStatusHistoryInput = z.infer<typeof deleteStatusHistoryInputSchema>

export type CreateRankHistoryInput = z.infer<typeof createRankHistoryInputSchema>
export type UpdateRankHistoryInput = z.infer<typeof updateRankHistoryInputSchema>
export type DeleteRankHistoryInput = z.infer<typeof deleteRankHistoryInputSchema>

export type CreatePreviousEmploymentInput = z.infer<typeof createPreviousEmploymentInputSchema>
export type UpdatePreviousEmploymentInput = z.infer<typeof updatePreviousEmploymentInputSchema>
export type DeletePreviousEmploymentInput = z.infer<typeof deletePreviousEmploymentInputSchema>
