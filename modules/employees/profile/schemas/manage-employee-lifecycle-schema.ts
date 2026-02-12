import { z } from "zod"

export const employeeLifecycleActionTypes = ["DEACTIVATE", "TERMINATE"] as const
export type EmployeeLifecycleActionType = (typeof employeeLifecycleActionTypes)[number]

export const employeeSeparationReasonCodes = [
  "RESIGNATION_PERSONAL",
  "RESIGNATION_HEALTH",
  "RESIGNATION_CAREER",
  "TERMINATION_PERFORMANCE",
  "TERMINATION_MISCONDUCT",
  "REDUNDANCY",
  "RETIREMENT",
  "END_OF_CONTRACT",
  "AWOL",
  "OTHER",
] as const
export type EmployeeSeparationReasonCode = (typeof employeeSeparationReasonCodes)[number]

export const terminationReasonCodes: readonly EmployeeSeparationReasonCode[] = [
  "TERMINATION_PERFORMANCE",
  "TERMINATION_MISCONDUCT",
  "REDUNDANCY",
  "AWOL",
  "OTHER",
]

export const deactivationReasonCodes: readonly EmployeeSeparationReasonCode[] = [
  "RESIGNATION_PERSONAL",
  "RESIGNATION_HEALTH",
  "RESIGNATION_CAREER",
  "RETIREMENT",
  "END_OF_CONTRACT",
  "OTHER",
]

export const separationReasonLabels: Record<EmployeeSeparationReasonCode, string> = {
  RESIGNATION_PERSONAL: "Resignation - Personal",
  RESIGNATION_HEALTH: "Resignation - Health",
  RESIGNATION_CAREER: "Resignation - Career",
  TERMINATION_PERFORMANCE: "Termination - Performance",
  TERMINATION_MISCONDUCT: "Termination - Misconduct",
  REDUNDANCY: "Redundancy",
  RETIREMENT: "Retirement",
  END_OF_CONTRACT: "End of Contract",
  AWOL: "AWOL",
  OTHER: "Other",
}

export const manageEmployeeLifecycleInputSchema = z
  .object({
    companyId: z.string().min(1),
    employeeId: z.string().uuid(),
    actionType: z.enum(employeeLifecycleActionTypes),
    separationDate: z.string().date(),
    lastWorkingDay: z.string().date().optional().or(z.literal("")),
    separationReasonCode: z.enum(employeeSeparationReasonCodes).optional(),
    remarks: z.string().trim().max(500, "Remarks must be 500 characters or less.").optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const hasLastWorkingDay = typeof value.lastWorkingDay === "string" && value.lastWorkingDay.length > 0
    const normalizedLastWorkingDay = hasLastWorkingDay
      ? (value.lastWorkingDay as string)
      : value.separationDate

    if (normalizedLastWorkingDay > value.separationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Last working day cannot be later than separation date.",
        path: ["lastWorkingDay"],
      })
    }

    if (value.actionType === "TERMINATE") {
      if (!hasLastWorkingDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Last working day is required for termination.",
          path: ["lastWorkingDay"],
        })
      }

      if (!value.separationReasonCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reason is required for termination.",
          path: ["separationReasonCode"],
        })
      } else if (!terminationReasonCodes.includes(value.separationReasonCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select a valid termination reason.",
          path: ["separationReasonCode"],
        })
      }
    }

    if (
      value.actionType === "DEACTIVATE" &&
      value.separationReasonCode &&
      !deactivationReasonCodes.includes(value.separationReasonCode)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid deactivation reason.",
        path: ["separationReasonCode"],
      })
    }
  })

export type ManageEmployeeLifecycleInput = z.infer<typeof manageEmployeeLifecycleInputSchema>
