"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createTrainingInputSchema,
  deleteTrainingInputSchema,
  type CreateTrainingInput,
  type DeleteTrainingInput,
  type UpdateTrainingInput,
  updateTrainingInputSchema,
} from "@/modules/employees/profile/schemas/training-crud-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  const [year, month, day] = normalized.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const revalidateEmployeeProfilePaths = (companyId: string, employeeId: string) => {
  revalidatePath(`/${companyId}/employees`)
  revalidatePath(`/${companyId}/employees/${employeeId}`)
}

const validateContextAndAccess = async (companyId: string): Promise<{ companyId: string; userId: string } | null> => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return null
  }
  return { companyId: context.companyId, userId: context.userId }
}

const ensureEmployeeInCompany = async (employeeId: string, companyId: string) => {
  return db.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  })
}

export async function createTrainingAction(input: CreateTrainingInput): Promise<ActionResult> {
  const parsed = createTrainingInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid training input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const created = await tx.employeeTraining.create({
      data: {
        employeeId: employee.id,
        trainingName: payload.trainingName,
        provider: toNullable(payload.provider),
        trainingDate: parsePhDate(payload.trainingDate),
        trainingEndDate: parsePhDate(payload.trainingEndDate),
        durationHours: payload.durationHours,
        location: toNullable(payload.location),
        isActive: true,
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeTraining",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "EMPLOYEE_TRAINING_CREATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Training record added." }
}

export async function updateTrainingAction(input: UpdateTrainingInput): Promise<ActionResult> {
  const parsed = updateTrainingInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid training input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeTraining.findFirst({
      where: { id: payload.trainingId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("TRAINING_NOT_FOUND")

    await tx.employeeTraining.update({
      where: { id: existing.id },
      data: {
        trainingName: payload.trainingName,
        provider: toNullable(payload.provider),
        trainingDate: parsePhDate(payload.trainingDate),
        trainingEndDate: parsePhDate(payload.trainingEndDate),
        durationHours: payload.durationHours,
        location: toNullable(payload.location),
      },
    })

    await createAuditLog(
      {
        tableName: "EmployeeTraining",
        recordId: existing.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "EMPLOYEE_TRAINING_UPDATED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Training record updated." }
}

export async function deleteTrainingAction(input: DeleteTrainingInput): Promise<ActionResult> {
  const parsed = deleteTrainingInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid training delete request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee records." }

  const employee = await ensureEmployeeInCompany(payload.employeeId, context.companyId)
  if (!employee) return { ok: false, error: "Employee record was not found in the selected company." }

  await db.$transaction(async (tx) => {
    const existing = await tx.employeeTraining.findFirst({
      where: { id: payload.trainingId, employeeId: employee.id, isActive: true },
      select: { id: true },
    })
    if (!existing) throw new Error("TRAINING_NOT_FOUND")

    await tx.employeeTraining.update({
      where: { id: existing.id },
      data: { isActive: false },
    })

    await createAuditLog(
      {
        tableName: "EmployeeTraining",
        recordId: existing.id,
        action: "DELETE",
        userId: context.userId,
        reason: "EMPLOYEE_TRAINING_DELETED",
      },
      tx
    )
  })

  revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
  return { ok: true, message: "Training record deleted." }
}
