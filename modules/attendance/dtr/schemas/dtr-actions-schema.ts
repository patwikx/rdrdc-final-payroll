import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

export const dtrCompanyInputSchema = z.object({
  companyId: z.string().uuid(),
})

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

export const dtrEmployeeDateRangeInputSchema = dtrDateRangeInputSchema.extend({
  employeeId: z.string().uuid(),
})

export const dtrEmployeeScheduleInputSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  attendanceDate: z.string().regex(datePattern),
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

export const overridePendingRequestApprovalInputSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  requestKind: z.enum(["LEAVE", "OVERTIME"]),
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().trim().min(2).max(1000),
})

export type DtrDateRangeInput = z.infer<typeof dtrDateRangeInputSchema>
export type DtrCompanyInput = z.infer<typeof dtrCompanyInputSchema>
export type DtrEmployeeDateRangeInput = z.infer<typeof dtrEmployeeDateRangeInputSchema>
export type DtrEmployeeScheduleInput = z.infer<typeof dtrEmployeeScheduleInputSchema>
export type UpdateDtrRecordInput = z.infer<typeof updateDtrRecordInputSchema>
export type OverridePendingRequestApprovalInput = z.infer<typeof overridePendingRequestApprovalInputSchema>
