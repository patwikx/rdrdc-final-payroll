import { z } from "zod"

const companyCodeRegex = /^[A-Z0-9_-]{3,20}$/
const usernameRegex = /^[a-zA-Z0-9._-]{4,30}$/
const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

const optionalTrimmedString = (minLength?: number, maxLength?: number) => {
  let schema = z.string().trim()

  if (typeof minLength === "number") {
    schema = schema.min(minLength)
  }

  if (typeof maxLength === "number") {
    schema = schema.max(maxLength)
  }

  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value
    }

    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  }, schema.optional())
}

const optionalTimeString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().regex(hhmmRegex).optional())

const dayEnum = z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])

const overtimeTypeEnum = z.enum([
  "REGULAR_OT",
  "REST_DAY_OT",
  "SPECIAL_HOLIDAY_OT",
  "REGULAR_HOLIDAY_OT",
  "REST_DAY_HOLIDAY_OT",
  "NIGHT_DIFF",
])

const holidayTypeEnum = z.enum(["REGULAR", "SPECIAL_NON_WORKING", "SPECIAL_WORKING", "LOCAL", "COMPANY", "ONE_TIME"])

const loanCategoryEnum = z.enum(["SSS", "PAGIBIG", "COMPANY", "CASH_ADVANCE"])

const loanInterestTypeEnum = z.enum(["FIXED", "DIMINISHING", "ZERO"])

const baseInitializeSystemSchema = z.object({
  admin: z.object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    username: z.string().trim().regex(usernameRegex),
    email: z.string().trim().email(),
    password: z.string().min(12).max(128),
  }),
  company: z.object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().toUpperCase().regex(companyCodeRegex),
    legalName: optionalTrimmedString(2, 180),
    tin: optionalTrimmedString(9, 20),
    rdoCode: optionalTrimmedString(2, 10),
    secDtiNumber: optionalTrimmedString(4, 50),
    sssEmployerNumber: optionalTrimmedString(4, 30),
    philHealthEmployerNumber: optionalTrimmedString(4, 30),
    pagIbigEmployerNumber: optionalTrimmedString(4, 30),
    minimumWageRegion: optionalTrimmedString(2, 50),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    defaultCurrency: z.literal("PHP"),
  }),
  organization: z.object({
    department: z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(2).max(80) }),
    position: z.object({ code: z.string().trim().min(2).max(30), name: z.string().trim().min(2).max(80) }),
    branch: z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(2).max(80) }),
    division: z.object({ code: z.string().trim().min(2).max(20), name: z.string().trim().min(2).max(80) }),
    rank: z.object({ code: z.string().trim().min(1).max(20), name: z.string().trim().min(2).max(80) }),
  }),
  payroll: z.object({
    payPeriodPattern: z.object({
      code: z.string().trim().min(3).max(30),
      name: z.string().trim().min(3).max(80),
      payFrequencyCode: z.literal("SEMI_MONTHLY"),
    }),
  }),
  attendance: z.object({
    workSchedule: z.object({
      code: z.string().trim().min(2).max(30),
      name: z.string().trim().min(2).max(80),
      workStartTime: z.string().regex(hhmmRegex),
      workEndTime: z.string().regex(hhmmRegex),
      breakStartTime: z.string().regex(hhmmRegex),
      breakEndTime: z.string().regex(hhmmRegex),
      breakDurationMins: z.number().int().min(0).max(180),
      gracePeriodMins: z.number().int().min(0).max(120),
      requiredHoursPerDay: z.number().min(1).max(24),
      restDays: z.array(dayEnum).min(1),
      saturdayHalfDay: z.object({
        enabled: z.boolean(),
        startTime: optionalTimeString,
        endTime: optionalTimeString,
        requiredHours: z.number().min(1).max(8).optional(),
      }),
    }),
    overtimeRates: z.array(
      z.object({
        overtimeTypeCode: overtimeTypeEnum,
        rateMultiplier: z.number().positive().max(5),
      })
    ).min(1),
  }),
  leave: z.object({
    leaveTypes: z.array(
      z.object({
        code: z.string().trim().min(2).max(20),
        name: z.string().trim().min(2).max(80),
        annualEntitlementRegular: z.number().min(0).max(365),
      })
    ).min(1),
  }),
  holidays: z.object({
    items: z.array(
      z.object({
        holidayDate: z.string().date(),
        name: z.string().trim().min(2).max(120),
        holidayTypeCode: holidayTypeEnum,
        payMultiplier: z.number().positive().max(4),
        applicability: z.enum(["NATIONWIDE", "REGIONAL", "COMPANY"]),
        region: optionalTrimmedString(undefined, 80),
      })
    ).min(1),
  }),
  loans: z.object({
    loanTypes: z.array(
      z.object({
        code: z.string().trim().min(2).max(20),
        name: z.string().trim().min(2).max(80),
        categoryCode: loanCategoryEnum,
        interestTypeCode: loanInterestTypeEnum,
        defaultInterestRate: z.number().min(0).max(1),
        maxTermMonths: z.number().int().min(1).max(240),
      })
    ).min(1),
  }),
  compensation: z.object({
    earningTypes: z.array(
      z.object({
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(80),
        isTaxable: z.boolean(),
        isIncludedInGross: z.boolean(),
      })
    ).min(1),
    deductionTypes: z.array(
      z.object({
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(80),
        isMandatory: z.boolean(),
        isPreTax: z.boolean(),
      })
    ).min(1),
  }),
  statutory: z.object({
    sss: z.object({
      version: z.string().trim().min(1).max(30),
      monthlySalaryCredit: z.number().positive(),
      employeeShare: z.number().nonnegative(),
      employerShare: z.number().nonnegative(),
      ecContribution: z.number().nonnegative(),
    }),
    philHealth: z.object({
      version: z.string().trim().min(1).max(30),
      premiumRate: z.number().positive(),
      monthlyFloor: z.number().nonnegative(),
      monthlyCeiling: z.number().positive(),
      employeeSharePercent: z.number().positive(),
      employerSharePercent: z.number().positive(),
    }),
    pagIbig: z.object({
      version: z.string().trim().min(1).max(30),
      employeeRatePercent: z.number().positive(),
      employerRatePercent: z.number().positive(),
      maxMonthlyCompensation: z.number().positive(),
    }),
    tax: z.object({
      version: z.string().trim().min(1).max(30),
      monthlyExemptThreshold: z.number().nonnegative(),
    }),
  }),
  system: z.object({
    timezone: z.literal("Asia/Manila"),
    roleModulePolicy: z.object({
      hrAdmin: z.object({
        employees: z.boolean(),
        leave: z.boolean(),
        overtime: z.boolean(),
        payroll: z.boolean(),
      }),
      payrollAdmin: z.object({
        employees: z.boolean(),
        leave: z.boolean(),
        overtime: z.boolean(),
        payroll: z.boolean(),
      }),
      approver: z.object({
        leave: z.boolean(),
        overtime: z.boolean(),
      }),
    }),
  }),
})

type SaturdayValidationShape = {
  attendance: {
    workSchedule: {
      saturdayHalfDay: {
        enabled: boolean
        startTime?: string
        endTime?: string
        requiredHours?: number
      }
    }
  }
}

const applySaturdayValidation = (value: SaturdayValidationShape, context: z.RefinementCtx) => {
  const saturdayConfig = value.attendance.workSchedule.saturdayHalfDay

  if (saturdayConfig.enabled) {
    if (!saturdayConfig.startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attendance", "workSchedule", "saturdayHalfDay", "startTime"],
        message: "Saturday half-day start time is required when enabled.",
      })
    }

    if (!saturdayConfig.endTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attendance", "workSchedule", "saturdayHalfDay", "endTime"],
        message: "Saturday half-day end time is required when enabled.",
      })
    }

    if (!saturdayConfig.requiredHours) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attendance", "workSchedule", "saturdayHalfDay", "requiredHours"],
        message: "Saturday half-day required hours is required when enabled.",
      })
    }
  }
}

export const initializeSystemSchema = baseInitializeSystemSchema.superRefine(applySaturdayValidation)

export type InitializeSystemInput = z.infer<typeof initializeSystemSchema>

export const setupDraftSchema = baseInitializeSystemSchema.extend({
  admin: baseInitializeSystemSchema.shape.admin.omit({
    password: true,
  }),
}).superRefine(applySaturdayValidation)

export type SetupDraftInput = z.infer<typeof setupDraftSchema>
