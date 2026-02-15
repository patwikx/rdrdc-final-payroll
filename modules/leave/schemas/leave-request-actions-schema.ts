import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const createLeaveRequestInputSchema = z
  .object({
    companyId: z.string().uuid(),
    leaveTypeId: z.string().uuid(),
    startDate: z.string().regex(datePattern, "Start date is invalid."),
    endDate: z.string().regex(datePattern, "End date is invalid."),
    isHalfDay: z.boolean().optional(),
    halfDayPeriod: z.enum(["AM", "PM"]).optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date must be on or before end date.",
      })
    }

    if (value.isHalfDay && !value.halfDayPeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["halfDayPeriod"],
        message: "Half-day period is required.",
      })
    }

    if (value.isHalfDay && value.startDate !== value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Half-day requests must be for a single date.",
      })
    }
  })

export const cancelLeaveRequestInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
})

export const updateLeaveRequestInputSchema = z
  .object({
    companyId: z.string().uuid(),
    requestId: z.string().uuid(),
    leaveTypeId: z.string().uuid(),
    startDate: z.string().regex(datePattern, "Start date is invalid."),
    endDate: z.string().regex(datePattern, "End date is invalid."),
    isHalfDay: z.boolean().optional(),
    halfDayPeriod: z.enum(["AM", "PM"]).optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date must be on or before end date.",
      })
    }

    if (value.isHalfDay && !value.halfDayPeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["halfDayPeriod"],
        message: "Half-day period is required.",
      })
    }

    if (value.isHalfDay && value.startDate !== value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Half-day requests must be for a single date.",
      })
    }
  })

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestInputSchema>
export type CancelLeaveRequestInput = z.infer<typeof cancelLeaveRequestInputSchema>
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestInputSchema>
