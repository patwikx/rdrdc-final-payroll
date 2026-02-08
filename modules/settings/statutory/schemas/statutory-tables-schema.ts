import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))

const sssRowSchema = z.object({
  salaryBracketMin: z.coerce.number().min(0),
  salaryBracketMax: z.coerce.number().min(0),
  monthlySalaryCredit: z.coerce.number().min(0),
  employeeShare: z.coerce.number().min(0),
  employerShare: z.coerce.number().min(0),
  ecContribution: z.coerce.number().min(0),
  totalContribution: z.coerce.number().min(0),
  wispEmployee: z.coerce.number().min(0).optional(),
  wispEmployer: z.coerce.number().min(0).optional(),
})

const philHealthRowSchema = z.object({
  premiumRate: z.coerce.number().min(0).max(1),
  monthlyFloor: z.coerce.number().min(0),
  monthlyCeiling: z.coerce.number().min(0),
  employeeSharePercent: z.coerce.number().min(0).max(1),
  employerSharePercent: z.coerce.number().min(0).max(1),
  membershipCategory: optionalText,
})

const pagIbigRowSchema = z.object({
  salaryBracketMin: z.coerce.number().min(0),
  salaryBracketMax: z.coerce.number().min(0),
  employeeRatePercent: z.coerce.number().min(0).max(1),
  employerRatePercent: z.coerce.number().min(0).max(1),
  maxMonthlyCompensation: z.coerce.number().min(0),
})

const taxRowSchema = z.object({
  bracketOver: z.coerce.number().min(0),
  bracketNotOver: z.coerce.number().min(0),
  baseTax: z.coerce.number().min(0),
  taxRatePercent: z.coerce.number().min(0).max(1),
  excessOver: z.coerce.number().min(0),
})

export const statutoryTablesInputSchema = z.object({
  companyId: z.string().uuid(),
  effectiveFrom: z.string().date(),
  sssRows: z.array(sssRowSchema).min(1),
  philHealthRows: z.array(philHealthRowSchema).min(1),
  pagIbigRows: z.array(pagIbigRowSchema).min(1),
  taxRows: z.array(taxRowSchema).min(1),
})

export type StatutoryTablesInput = z.infer<typeof statutoryTablesInputSchema>
