import { PayrollRunType } from "@prisma/client"
import { z } from "zod"

export const createPayrollRunInputSchema = z.object({
  companyId: z.string().uuid(),
  payPeriodId: z.string().uuid(),
  runTypeCode: z.nativeEnum(PayrollRunType),
  departmentIds: z.array(z.string().uuid()).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
})

export const payrollRunActionInputSchema = z.object({
  companyId: z.string().uuid(),
  runId: z.string().uuid(),
})

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunInputSchema>
export type PayrollRunActionInput = z.infer<typeof payrollRunActionInputSchema>
