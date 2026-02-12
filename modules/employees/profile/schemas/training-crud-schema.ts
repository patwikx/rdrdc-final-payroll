import { z } from "zod"

const baseContextSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().uuid(),
})

export const createTrainingInputSchema = baseContextSchema.extend({
  trainingName: z.string().trim().min(1, "Training name is required.").max(200),
  provider: z.string().trim().max(160).optional(),
  trainingDate: z.string().date().optional().or(z.literal("")),
  trainingEndDate: z.string().date().optional().or(z.literal("")),
  durationHours: z.number().min(0).max(10000).optional(),
  location: z.string().trim().max(160).optional(),
})

export const updateTrainingInputSchema = createTrainingInputSchema.extend({
  trainingId: z.string().uuid(),
})

export const deleteTrainingInputSchema = baseContextSchema.extend({
  trainingId: z.string().uuid(),
})

export type CreateTrainingInput = z.infer<typeof createTrainingInputSchema>
export type UpdateTrainingInput = z.infer<typeof updateTrainingInputSchema>
export type DeleteTrainingInput = z.infer<typeof deleteTrainingInputSchema>
