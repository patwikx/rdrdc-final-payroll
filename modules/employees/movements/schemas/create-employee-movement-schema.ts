import { SalaryAdjustmentType } from "@prisma/client"
import { z } from "zod"

const baseSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  effectiveDate: z.string().date(),
  reason: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(1000).optional(),
})

export const createEmployeeMovementInputSchema = z.discriminatedUnion("movementKind", [
  baseSchema.extend({
    movementKind: z.literal("STATUS"),
    newStatusId: z.string().uuid(),
  }),
  baseSchema.extend({
    movementKind: z.literal("POSITION"),
    newPositionId: z.string().uuid(),
    newDepartmentId: z.string().uuid().optional(),
    newBranchId: z.string().uuid().optional(),
    movementType: z.enum(["PROMOTION", "TRANSFER", "DEMOTION", "LATERAL"]),
  }),
  baseSchema.extend({
    movementKind: z.literal("RANK"),
    newRankId: z.string().uuid(),
    movementType: z.enum(["PROMOTION", "TRANSFER", "DEMOTION", "LATERAL"]),
  }),
  baseSchema.extend({
    movementKind: z.literal("SALARY"),
    newSalary: z.number().positive(),
    adjustmentTypeCode: z.nativeEnum(SalaryAdjustmentType),
  }),
  baseSchema.extend({
    movementKind: z.literal("SCHEDULE"),
    newScheduleId: z.string().uuid(),
  }),
])

export type CreateEmployeeMovementInput = z.infer<typeof createEmployeeMovementInputSchema>
