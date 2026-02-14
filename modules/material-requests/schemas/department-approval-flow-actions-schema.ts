import { z } from "zod"

const MAX_APPROVAL_STEPS = 4
const MAX_APPROVERS_PER_STEP = 20

const stepSchema = z.object({
  stepNumber: z.coerce.number().int().min(1).max(MAX_APPROVAL_STEPS),
  stepName: z.string().trim().min(1).max(60),
  approverUserId: z.string().uuid(),
})

export const upsertDepartmentMaterialRequestApprovalFlowInputSchema = z
  .object({
    companyId: z.string().uuid(),
    departmentId: z.string().uuid(),
    requiredSteps: z.coerce.number().int().min(1).max(MAX_APPROVAL_STEPS),
    isActive: z.boolean().optional(),
    steps: z.array(stepSchema).min(1).max(MAX_APPROVAL_STEPS * MAX_APPROVERS_PER_STEP),
  })
  .superRefine((value, ctx) => {
    if (value.steps.length < value.requiredSteps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps"],
        message: `At least one approver per step is required for ${value.requiredSteps} step(s).`,
      })
    }

    const stepApproverPairs = new Set<string>()
    const stepCounts = new Map<number, number>()
    const stepNamesByStepNumber = new Map<number, string>()

    for (const [index, step] of value.steps.entries()) {
      if (step.stepNumber > value.requiredSteps) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "stepNumber"],
          message: `Step number must be between 1 and ${value.requiredSteps}.`,
        })
      }

      const pairKey = `${step.stepNumber}:${step.approverUserId}`
      if (stepApproverPairs.has(pairKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index],
          message: "Duplicate approver assignment for the same step is not allowed.",
        })
      }

      stepApproverPairs.add(pairKey)
      stepCounts.set(step.stepNumber, (stepCounts.get(step.stepNumber) ?? 0) + 1)

      const existingStepName = stepNamesByStepNumber.get(step.stepNumber)
      if (!existingStepName) {
        stepNamesByStepNumber.set(step.stepNumber, step.stepName)
      } else if (existingStepName !== step.stepName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "stepName"],
          message: "All approvers under the same step must use the same step name.",
        })
      }
    }

    for (let expected = 1; expected <= value.requiredSteps; expected += 1) {
      if ((stepCounts.get(expected) ?? 0) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps"],
          message: `Step ${expected} must have at least one approver.`,
        })
      }
    }
  })

export const getDepartmentMaterialRequestApprovalFlowsInputSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
})

export const deleteDepartmentMaterialRequestApprovalFlowInputSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid(),
})

export type UpsertDepartmentMaterialRequestApprovalFlowInput = z.infer<
  typeof upsertDepartmentMaterialRequestApprovalFlowInputSchema
>
export type GetDepartmentMaterialRequestApprovalFlowsInput = z.infer<
  typeof getDepartmentMaterialRequestApprovalFlowsInputSchema
>
export type DeleteDepartmentMaterialRequestApprovalFlowInput = z.infer<
  typeof deleteDepartmentMaterialRequestApprovalFlowInputSchema
>
