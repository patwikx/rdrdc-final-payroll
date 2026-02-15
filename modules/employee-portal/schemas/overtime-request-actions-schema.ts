import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

export const createOvertimeRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  overtimeDate: z.string().regex(datePattern, "Overtime date is invalid."),
  startTime: z.string().regex(timePattern, "Start time is invalid."),
  endTime: z.string().regex(timePattern, "End time is invalid."),
  reason: z.string().trim().max(1000).optional(),
})

export const cancelOvertimeRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
})

export const updateOvertimeRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  overtimeDate: z.string().regex(datePattern, "Overtime date is invalid."),
  startTime: z.string().regex(timePattern, "Start time is invalid."),
  endTime: z.string().regex(timePattern, "End time is invalid."),
  reason: z.string().trim().max(1000).optional(),
})

export type CreateOvertimeRequestInput = z.infer<typeof createOvertimeRequestInputSchema>
export type CancelOvertimeRequestInput = z.infer<typeof cancelOvertimeRequestInputSchema>
export type UpdateOvertimeRequestInput = z.infer<typeof updateOvertimeRequestInputSchema>
