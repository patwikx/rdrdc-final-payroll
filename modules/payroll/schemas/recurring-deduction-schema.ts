import { RecurringDeductionStatus } from "@prisma/client"
import { z } from "zod"

const dateInputRegex = /^\d{4}-\d{2}-\d{2}$/

export const createRecurringDeductionInputSchema = z
  .object({
    recurringDeductionId: z.string().uuid().optional(),
    companyId: z.string().uuid(),
    employeeId: z.string().uuid(),
    deductionTypeId: z.string().uuid(),
    description: z.string().max(160).optional(),
    amount: z.number().min(0),
    isPercentage: z.boolean(),
    percentageRate: z.number().min(0).max(1).optional(),
    frequency: z.enum(["PER_PAYROLL", "MONTHLY"]),
    effectiveFrom: z.string().regex(dateInputRegex),
    effectiveTo: z.string().regex(dateInputRegex).optional(),
    remarks: z.string().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.isPercentage && (value.percentageRate === undefined || value.percentageRate <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentageRate"],
        message: "Percentage rate is required when deduction is percentage-based.",
      })
    }

    if (!value.isPercentage && value.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Amount must be greater than zero.",
      })
    }

    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Effective To must not be earlier than Effective From.",
      })
    }
  })

export type CreateRecurringDeductionInput = z.infer<typeof createRecurringDeductionInputSchema>

export const updateRecurringDeductionStatusInputSchema = z.object({
  companyId: z.string().uuid(),
  recurringDeductionId: z.string().uuid(),
  statusCode: z.enum([RecurringDeductionStatus.ACTIVE, RecurringDeductionStatus.SUSPENDED, RecurringDeductionStatus.CANCELLED]),
})

export type UpdateRecurringDeductionStatusInput = z.infer<typeof updateRecurringDeductionStatusInputSchema>

export const createDeductionTypeInputSchema = z.object({
  companyId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "Code must use uppercase letters, numbers, and underscore only."),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(180).optional(),
  isPreTax: z.boolean().default(true),
  payPeriodApplicability: z.enum(["EVERY_PAYROLL", "FIRST_HALF", "SECOND_HALF"]).default("EVERY_PAYROLL"),
})

export type CreateDeductionTypeInput = z.infer<typeof createDeductionTypeInputSchema>
