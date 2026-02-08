import { LeaveAccrualMethod, LeaveProrationMethod, OvertimeTypeCode } from "@prisma/client"
import { z } from "zod"

export const overtimeTypeOptions: Array<{ code: OvertimeTypeCode; label: string }> = [
  { code: OvertimeTypeCode.REGULAR_OT, label: "Regular OT" },
  { code: OvertimeTypeCode.REST_DAY_OT, label: "Rest Day OT" },
  { code: OvertimeTypeCode.SPECIAL_HOLIDAY_OT, label: "Special Holiday OT" },
  { code: OvertimeTypeCode.REGULAR_HOLIDAY_OT, label: "Regular Holiday OT" },
  { code: OvertimeTypeCode.REST_DAY_HOLIDAY_OT, label: "Rest Day Holiday OT" },
  { code: OvertimeTypeCode.NIGHT_DIFF, label: "Night Differential" },
]

export const leaveAccrualMethodOptions: Array<{ code: LeaveAccrualMethod; label: string }> = [
  { code: LeaveAccrualMethod.UPFRONT, label: "Upfront" },
  { code: LeaveAccrualMethod.MONTHLY, label: "Monthly" },
  { code: LeaveAccrualMethod.QUARTERLY, label: "Quarterly" },
  { code: LeaveAccrualMethod.PER_PAYROLL, label: "Per Payroll" },
]

export const leaveProrationMethodOptions: Array<{ code: LeaveProrationMethod; label: string }> = [
  { code: LeaveProrationMethod.FULL, label: "Full" },
  { code: LeaveProrationMethod.PRORATED_MONTH, label: "Prorated (Month)" },
  { code: LeaveProrationMethod.PRORATED_DAY, label: "Prorated (Day)" },
]

const dateInputRegex = /^\d{4}-\d{2}-\d{2}$/

export const upsertLeaveTypePolicySettingsInputSchema = z.object({
  companyId: z.string().uuid(),
  leaveTypeId: z.string().uuid().optional(),
  policyId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  isPaid: z.boolean(),
  isCarriedOver: z.boolean(),
  maxCarryOverDays: z.coerce.number().min(0).max(365).optional(),
  allowHalfDay: z.boolean(),
  requiresApproval: z.boolean(),
  statusApplicability: z.enum(["ALL", "REGULAR_ONLY"]),
  isActive: z.boolean(),
  employmentStatusId: z.string().uuid(),
  annualEntitlement: z.coerce.number().min(0).max(365),
  accrualMethodCode: z.nativeEnum(LeaveAccrualMethod),
  prorationMethodCode: z.nativeEnum(LeaveProrationMethod),
  effectiveFrom: z.string().regex(dateInputRegex, "Effective date must use YYYY-MM-DD format."),
})

export const upsertOvertimeRateSettingsInputSchema = z.object({
  companyId: z.string().uuid(),
  overtimeRateId: z.string().uuid().optional(),
  overtimeTypeCode: z.nativeEnum(OvertimeTypeCode),
  description: z.string().trim().max(1000).optional(),
  rateMultiplier: z.coerce.number().min(0.5).max(10),
  isActive: z.boolean(),
  effectiveFrom: z.string().regex(dateInputRegex, "Effective date must use YYYY-MM-DD format."),
})

export type UpsertLeaveTypePolicySettingsInput = z.infer<typeof upsertLeaveTypePolicySettingsInputSchema>
export type UpsertOvertimeRateSettingsInput = z.infer<typeof upsertOvertimeRateSettingsInputSchema>
