import { z } from "zod"

const dateInputRegex = /^\d{4}-\d{2}-\d{2}$/

export const createRecurringEarningInputSchema = z
  .object({
    recurringEarningId: z.string().uuid().optional(),
    companyId: z.string().uuid(),
    employeeId: z.string().uuid(),
    earningTypeId: z.string().uuid(),
    amount: z.number().positive(),
    frequency: z.enum(["PER_PAYROLL", "MONTHLY"]),
    taxTreatment: z.enum(["DEFAULT", "TAXABLE", "NON_TAXABLE"]).default("DEFAULT"),
    effectiveFrom: z.string().regex(dateInputRegex),
    effectiveTo: z.string().regex(dateInputRegex).optional(),
    remarks: z.string().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Effective To must not be earlier than Effective From.",
      })
    }
  })

export type CreateRecurringEarningInput = z.infer<typeof createRecurringEarningInputSchema>

export const updateRecurringEarningStatusInputSchema = z.object({
  companyId: z.string().uuid(),
  recurringEarningId: z.string().uuid(),
  statusCode: z.enum(["ACTIVE", "INACTIVE"]),
})

export type UpdateRecurringEarningStatusInput = z.infer<typeof updateRecurringEarningStatusInputSchema>

export const createEarningTypeInputSchema = z.object({
  companyId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "Code must use uppercase letters, numbers, and underscore only."),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(180).optional(),
  isTaxable: z.boolean().default(true),
  isIncludedIn13thMonth: z.boolean().default(false),
  frequencyCode: z.enum(["PER_PAYROLL", "MONTHLY"]).default("PER_PAYROLL"),
})

export type CreateEarningTypeInput = z.infer<typeof createEarningTypeInputSchema>

export const updateEarningTypeInputSchema = z.object({
  companyId: z.string().uuid(),
  earningTypeId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "Code must use uppercase letters, numbers, and underscore only."),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(180).optional(),
  isTaxable: z.boolean().default(true),
  isIncludedIn13thMonth: z.boolean().default(false),
  frequencyCode: z.enum(["PER_PAYROLL", "MONTHLY"]).default("PER_PAYROLL"),
})

export type UpdateEarningTypeInput = z.infer<typeof updateEarningTypeInputSchema>
