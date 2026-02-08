"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createEmployeeMovementInputSchema,
  type CreateEmployeeMovementInput,
} from "@/modules/employees/movements/schemas/create-employee-movement-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export async function createEmployeeMovementAction(
  input: CreateEmployeeMovementInput
): Promise<ActionResult> {
  const parsed = createEmployeeMovementInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid movement input." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to create employee movements." }
  }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: payload.employeeId,
          companyId: context.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          employeeNumber: true,
          employmentStatusId: true,
          positionId: true,
          departmentId: true,
          branchId: true,
          rankId: true,
          workScheduleId: true,
          salary: { select: { baseSalary: true } },
        },
      })

      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND")
      }

      const effectiveDate = toPhDate(payload.effectiveDate)

      if (payload.movementKind === "STATUS") {
        await tx.employeeStatusHistory.create({
          data: {
            employeeId: employee.id,
            previousStatusId: employee.employmentStatusId,
            newStatusId: payload.newStatusId,
            effectiveDate,
            reason: payload.reason,
            remarks: payload.remarks,
            changedById: context.userId,
          },
        })

        await tx.employee.update({
          where: { id: employee.id },
          data: { employmentStatusId: payload.newStatusId, updatedById: context.userId },
        })
      }

      if (payload.movementKind === "POSITION") {
        await tx.employeePositionHistory.create({
          data: {
            employeeId: employee.id,
            previousPositionId: employee.positionId,
            newPositionId: payload.newPositionId,
            previousDepartmentId: employee.departmentId,
            newDepartmentId: payload.newDepartmentId ?? employee.departmentId,
            previousBranchId: employee.branchId,
            newBranchId: payload.newBranchId ?? employee.branchId,
            movementType: payload.movementType,
            effectiveDate,
            reason: payload.reason,
            remarks: payload.remarks,
            approvedById: context.userId,
            approvedAt: new Date(),
          },
        })

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            positionId: payload.newPositionId,
            departmentId: payload.newDepartmentId ?? employee.departmentId,
            branchId: payload.newBranchId ?? employee.branchId,
            updatedById: context.userId,
          },
        })
      }

      if (payload.movementKind === "RANK") {
        await tx.employeeRankHistory.create({
          data: {
            employeeId: employee.id,
            previousRankId: employee.rankId,
            newRankId: payload.newRankId,
            movementType: payload.movementType,
            effectiveDate,
            reason: payload.reason,
            remarks: payload.remarks,
            approvedById: context.userId,
            approvedAt: new Date(),
          },
        })

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            rankId: payload.newRankId,
            updatedById: context.userId,
          },
        })
      }

      if (payload.movementKind === "SALARY") {
        const currentBaseSalary = employee.salary?.baseSalary
        const previousSalary = currentBaseSalary ? Number(currentBaseSalary) : null
        const adjustmentAmount = previousSalary === null ? null : payload.newSalary - previousSalary
        const adjustmentPercent =
          previousSalary && previousSalary > 0 ? (adjustmentAmount! / previousSalary) * 100 : null

        await tx.employeeSalaryHistory.create({
          data: {
            employeeId: employee.id,
            previousSalary,
            newSalary: payload.newSalary,
            adjustmentTypeCode: payload.adjustmentTypeCode,
            adjustmentAmount,
            adjustmentPercent,
            effectiveDate,
            reason: payload.reason,
            remarks: payload.remarks,
            approvalStatus: "APPROVED",
            approvedById: context.userId,
            approvedAt: new Date(),
          },
        })

        await tx.employeeSalary.update({
          where: { employeeId: employee.id },
          data: {
            baseSalary: payload.newSalary,
          },
        })
      }

      if (payload.movementKind === "SCHEDULE") {
        await tx.employeeScheduleHistory.create({
          data: {
            employeeId: employee.id,
            previousScheduleId: employee.workScheduleId,
            newScheduleId: payload.newScheduleId,
            effectiveDate,
            reason: payload.reason,
            changedById: context.userId,
          },
        })

        await tx.employee.update({
          where: { id: employee.id },
          data: { workScheduleId: payload.newScheduleId, updatedById: context.userId },
        })
      }

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: employee.id,
          action: "UPDATE",
          userId: context.userId,
          reason: `EMPLOYEE_${payload.movementKind}_MOVEMENT_CREATED`,
          changes: [
            {
              fieldName: "movementKind",
              oldValue: null,
              newValue: payload.movementKind,
            },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/employees/movements`)
    revalidatePath(`/${context.companyId}/employees`)
    revalidatePath(`/${context.companyId}/employees/${payload.employeeId}`)

    return { ok: true, message: "Employee movement saved." }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return { ok: false, error: "Employee not found for the selected company." }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, error: "Failed to save movement due to a database constraint." }
    }

    return { ok: false, error: "Unable to save movement right now. Please try again." }
  }
}
