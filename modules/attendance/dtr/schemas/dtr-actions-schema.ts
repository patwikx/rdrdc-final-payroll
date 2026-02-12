import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

export const dtrDateRangeInputSchema = z
  .object({
    companyId: z.string().uuid(),
    startDate: z.string().regex(datePattern),
    endDate: z.string().regex(datePattern),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date must be on or before end date.",
      })
    }
  })

export const updateDtrRecordInputSchema = z.object({
  companyId: z.string().uuid(),
  dtrId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  attendanceDate: z.string().regex(datePattern),
  attendanceStatus: z.enum(["PRESENT", "ABSENT", "ON_LEAVE", "HOLIDAY", "REST_DAY", "SUSPENDED", "AWOL"]),
  dayFraction: z.enum(["FULL", "HALF"]).optional(),
  actualTimeIn: z.string().regex(timePattern).optional().or(z.literal("")),
  actualTimeOut: z.string().regex(timePattern).optional().or(z.literal("")),
  remarks: z.string().max(2000).optional(),
})

export type DtrDateRangeInput = z.infer<typeof dtrDateRangeInputSchema>
export type UpdateDtrRecordInput = z.infer<typeof updateDtrRecordInputSchema>
