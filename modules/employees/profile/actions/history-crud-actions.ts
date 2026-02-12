"use server"

import { EmployeeMovementType, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createPositionHistoryInputSchema,
  createPreviousEmploymentInputSchema,
  createRankHistoryInputSchema,
  createSalaryHistoryInputSchema,
  createStatusHistoryInputSchema,
  deletePositionHistoryInputSchema,
  deletePreviousEmploymentInputSchema,
  deleteRankHistoryInputSchema,
  deleteSalaryHistoryInputSchema,
  deleteStatusHistoryInputSchema,
  type CreatePositionHistoryInput,
  type CreatePreviousEmploymentInput,
  type CreateRankHistoryInput,
  type CreateSalaryHistoryInput,
  type CreateStatusHistoryInput,
  type DeletePositionHistoryInput,
  type DeletePreviousEmploymentInput,
  type DeleteRankHistoryInput,
  type DeleteSalaryHistoryInput,
  type DeleteStatusHistoryInput,
  type UpdatePositionHistoryInput,
  type UpdatePreviousEmploymentInput,
  type UpdateRankHistoryInput,
  type UpdateSalaryHistoryInput,
  type UpdateStatusHistoryInput,
  updatePositionHistoryInputSchema,
  updatePreviousEmploymentInputSchema,
  updateRankHistoryInputSchema,
  updateSalaryHistoryInputSchema,
  updateStatusHistoryInputSchema,
} from "@/modules/employees/profile/schemas/history-crud-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type Tx = Prisma.TransactionClient

const toNullable = (value: string | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toNullableId = (value: string | undefined): string | null => {
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

const ensureEmployeeInCompany = async (tx: Tx, employeeId: string, companyId: string) => {
  return tx.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  })
}

const ensureStatusInCompany = async (tx: Tx, statusId: string, companyId: string) => {
  return tx.employmentStatus.findFirst({ where: { id: statusId, companyId }, select: { id: true } })
}

const ensurePositionInCompany = async (tx: Tx, positionId: string, companyId: string) => {
  return tx.position.findFirst({ where: { id: positionId, companyId }, select: { id: true } })
}

const ensureDepartmentInCompany = async (tx: Tx, departmentId: string, companyId: string) => {
  return tx.department.findFirst({ where: { id: departmentId, companyId }, select: { id: true } })
}

const ensureBranchInCompany = async (tx: Tx, branchId: string, companyId: string) => {
  return tx.branch.findFirst({ where: { id: branchId, companyId }, select: { id: true } })
}

const ensureRankInCompany = async (tx: Tx, rankId: string, companyId: string) => {
  return tx.rank.findFirst({ where: { id: rankId, companyId }, select: { id: true, level: true } })
}

const syncEmployeeStatusFromLatestHistory = async (tx: Tx, employeeId: string, actorUserId: string) => {
  const latest = await tx.employeeStatusHistory.findFirst({
    where: { employeeId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: { newStatusId: true },
  })
  if (!latest) return

  await tx.employee.update({
    where: { id: employeeId },
    data: {
      employmentStatusId: latest.newStatusId,
      updatedById: actorUserId,
    },
  })
}

const syncEmployeePositionFromLatestHistory = async (tx: Tx, employeeId: string, actorUserId: string) => {
  const latest = await tx.employeePositionHistory.findFirst({
    where: { employeeId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: { newPositionId: true, newDepartmentId: true, newBranchId: true },
  })
  if (!latest) return

  await tx.employee.update({
    where: { id: employeeId },
    data: {
      positionId: latest.newPositionId,
      departmentId: latest.newDepartmentId,
      branchId: latest.newBranchId,
      updatedById: actorUserId,
    },
  })
}

const syncEmployeeRankFromLatestHistory = async (tx: Tx, employeeId: string, actorUserId: string) => {
  const latest = await tx.employeeRankHistory.findFirst({
    where: { employeeId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: { newRankId: true },
  })
  if (!latest) return

  await tx.employee.update({
    where: { id: employeeId },
    data: {
      rankId: latest.newRankId,
      updatedById: actorUserId,
    },
  })
}

const syncEmployeeSalaryFromLatestHistory = async (tx: Tx, employeeId: string) => {
  const latest = await tx.employeeSalaryHistory.findFirst({
    where: { employeeId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: { newSalary: true },
  })
  if (!latest) return

  await tx.employeeSalary.update({
    where: { employeeId },
    data: {
      baseSalary: latest.newSalary,
    },
  })
}

const toRankMovementType = (
  previousRankLevel: number | null,
  nextRankLevel: number | null,
  fallbackMovementType: EmployeeMovementType
): EmployeeMovementType => {
  if (previousRankLevel === null || nextRankLevel === null) {
    return fallbackMovementType
  }
  if (nextRankLevel > previousRankLevel) return EmployeeMovementType.PROMOTION
  if (nextRankLevel < previousRankLevel) return EmployeeMovementType.DEMOTION
  return EmployeeMovementType.LATERAL
}

export async function createSalaryHistoryEntryAction(input: CreateSalaryHistoryInput): Promise<ActionResult> {
  const parsed = createSalaryHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid salary history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) {
    return { ok: false, error: "You do not have permission to update employee history." }
  }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) {
    return { ok: false, error: "Please select a valid effective date." }
  }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const salary = await tx.employeeSalary.findUnique({ where: { employeeId: employee.id }, select: { baseSalary: true } })
      if (!salary) throw new Error("EMPLOYEE_SALARY_NOT_FOUND")

      const previousSalary = salary.baseSalary ? Number(salary.baseSalary) : null
      const adjustmentAmount = previousSalary === null ? null : payload.newSalary - previousSalary
      const adjustmentPercent = previousSalary && previousSalary > 0 && adjustmentAmount !== null ? (adjustmentAmount / previousSalary) * 100 : null

      const created = await tx.employeeSalaryHistory.create({
        data: {
          employeeId: employee.id,
          effectiveDate,
          newSalary: payload.newSalary,
          previousSalary,
          adjustmentTypeCode: payload.adjustmentTypeCode,
          adjustmentAmount,
          adjustmentPercent,
          reason: toNullable(payload.reason),
          approvalStatus: "APPROVED",
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeeSalaryFromLatestHistory(tx, employee.id)

      await createAuditLog(
        {
          tableName: "EmployeeSalaryHistory",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_SALARY_HISTORY_CREATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Salary history added." }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return { ok: false, error: "Employee record was not found in the selected company." }
    }
    if (error instanceof Error && error.message === "EMPLOYEE_SALARY_NOT_FOUND") {
      return { ok: false, error: "Employee salary record is missing and cannot be synced." }
    }
    return { ok: false, error: "Unable to add salary history right now. Please try again." }
  }
}

export async function updateSalaryHistoryEntryAction(input: UpdateSalaryHistoryInput): Promise<ActionResult> {
  const parsed = updateSalaryHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid salary history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) {
    return { ok: false, error: "You do not have permission to update employee history." }
  }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) {
    return { ok: false, error: "Please select a valid effective date." }
  }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeSalaryHistory.findFirst({
        where: {
          id: payload.historyId,
          employeeId: employee.id,
        },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      const latestBeforeThis = await tx.employeeSalaryHistory.findFirst({
        where: {
          employeeId: employee.id,
          id: { not: payload.historyId },
          OR: [
            { effectiveDate: { lt: effectiveDate } },
            { effectiveDate, createdAt: { lt: new Date() } },
          ],
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        select: { newSalary: true },
      })

      const previousSalary = latestBeforeThis ? Number(latestBeforeThis.newSalary) : null
      const adjustmentAmount = previousSalary === null ? null : payload.newSalary - previousSalary
      const adjustmentPercent = previousSalary && previousSalary > 0 && adjustmentAmount !== null ? (adjustmentAmount / previousSalary) * 100 : null

      await tx.employeeSalaryHistory.update({
        where: { id: existing.id },
        data: {
          effectiveDate,
          newSalary: payload.newSalary,
          previousSalary,
          adjustmentTypeCode: payload.adjustmentTypeCode,
          adjustmentAmount,
          adjustmentPercent,
          reason: toNullable(payload.reason),
          approvalStatus: "APPROVED",
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeeSalaryFromLatestHistory(tx, employee.id)

      await createAuditLog(
        {
          tableName: "EmployeeSalaryHistory",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_SALARY_HISTORY_UPDATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Salary history updated." }
  } catch (error) {
    if (error instanceof Error && (error.message === "EMPLOYEE_NOT_FOUND" || error.message === "HISTORY_NOT_FOUND")) {
      return { ok: false, error: "Salary history record was not found." }
    }
    return { ok: false, error: "Unable to update salary history right now. Please try again." }
  }
}

export async function deleteSalaryHistoryEntryAction(input: DeleteSalaryHistoryInput): Promise<ActionResult> {
  const parsed = deleteSalaryHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid salary history request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) {
    return { ok: false, error: "You do not have permission to update employee history." }
  }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeSalaryHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeeSalaryHistory.delete({ where: { id: existing.id } })
      await syncEmployeeSalaryFromLatestHistory(tx, employee.id)

      await createAuditLog(
        {
          tableName: "EmployeeSalaryHistory",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_SALARY_HISTORY_DELETED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Salary history deleted." }
  } catch {
    return { ok: false, error: "Unable to delete salary history right now. Please try again." }
  }
}

export async function createPositionHistoryEntryAction(input: CreatePositionHistoryInput): Promise<ActionResult> {
  const parsed = createPositionHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid position history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true, positionId: true, departmentId: true, branchId: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const [position, department, branch] = await Promise.all([
        ensurePositionInCompany(tx, payload.newPositionId, context.companyId),
        payload.newDepartmentId ? ensureDepartmentInCompany(tx, payload.newDepartmentId, context.companyId) : Promise.resolve(null),
        payload.newBranchId ? ensureBranchInCompany(tx, payload.newBranchId, context.companyId) : Promise.resolve(null),
      ])
      if (!position) throw new Error("INVALID_POSITION")
      if (payload.newDepartmentId && !department) throw new Error("INVALID_DEPARTMENT")
      if (payload.newBranchId && !branch) throw new Error("INVALID_BRANCH")

      const created = await tx.employeePositionHistory.create({
        data: {
          employeeId: employee.id,
          previousPositionId: employee.positionId,
          newPositionId: payload.newPositionId,
          previousDepartmentId: employee.departmentId,
          newDepartmentId: toNullableId(payload.newDepartmentId) ?? employee.departmentId,
          previousBranchId: employee.branchId,
          newBranchId: toNullableId(payload.newBranchId) ?? employee.branchId,
          movementType: payload.movementType,
          effectiveDate,
          reason: toNullable(payload.reason),
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeePositionFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeePositionHistory",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_POSITION_HISTORY_CREATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Position history added." }
  } catch {
    return { ok: false, error: "Unable to add position history right now. Please try again." }
  }
}

export async function updatePositionHistoryEntryAction(input: UpdatePositionHistoryInput): Promise<ActionResult> {
  const parsed = updatePositionHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid position history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeePositionHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      const [position, department, branch] = await Promise.all([
        ensurePositionInCompany(tx, payload.newPositionId, context.companyId),
        payload.newDepartmentId ? ensureDepartmentInCompany(tx, payload.newDepartmentId, context.companyId) : Promise.resolve(null),
        payload.newBranchId ? ensureBranchInCompany(tx, payload.newBranchId, context.companyId) : Promise.resolve(null),
      ])
      if (!position) throw new Error("INVALID_POSITION")
      if (payload.newDepartmentId && !department) throw new Error("INVALID_DEPARTMENT")
      if (payload.newBranchId && !branch) throw new Error("INVALID_BRANCH")

      await tx.employeePositionHistory.update({
        where: { id: existing.id },
        data: {
          newPositionId: payload.newPositionId,
          newDepartmentId: toNullableId(payload.newDepartmentId),
          newBranchId: toNullableId(payload.newBranchId),
          movementType: payload.movementType,
          effectiveDate,
          reason: toNullable(payload.reason),
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeePositionFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeePositionHistory",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_POSITION_HISTORY_UPDATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Position history updated." }
  } catch {
    return { ok: false, error: "Unable to update position history right now. Please try again." }
  }
}

export async function deletePositionHistoryEntryAction(input: DeletePositionHistoryInput): Promise<ActionResult> {
  const parsed = deletePositionHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid position history request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeePositionHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeePositionHistory.delete({ where: { id: existing.id } })
      await syncEmployeePositionFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeePositionHistory",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_POSITION_HISTORY_DELETED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Position history deleted." }
  } catch {
    return { ok: false, error: "Unable to delete position history right now. Please try again." }
  }
}

export async function createStatusHistoryEntryAction(input: CreateStatusHistoryInput): Promise<ActionResult> {
  const parsed = createStatusHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true, employmentStatusId: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const status = await ensureStatusInCompany(tx, payload.newStatusId, context.companyId)
      if (!status) throw new Error("INVALID_STATUS")

      const created = await tx.employeeStatusHistory.create({
        data: {
          employeeId: employee.id,
          previousStatusId: employee.employmentStatusId,
          newStatusId: payload.newStatusId,
          effectiveDate,
          reason: toNullable(payload.reason),
          changedById: context.userId,
        },
      })

      await syncEmployeeStatusFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeStatusHistory",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_STATUS_HISTORY_CREATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Employment status history added." }
  } catch {
    return { ok: false, error: "Unable to add employment status history right now. Please try again." }
  }
}

export async function updateStatusHistoryEntryAction(input: UpdateStatusHistoryInput): Promise<ActionResult> {
  const parsed = updateStatusHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeStatusHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      const status = await ensureStatusInCompany(tx, payload.newStatusId, context.companyId)
      if (!status) throw new Error("INVALID_STATUS")

      await tx.employeeStatusHistory.update({
        where: { id: existing.id },
        data: {
          newStatusId: payload.newStatusId,
          effectiveDate,
          reason: toNullable(payload.reason),
          changedById: context.userId,
        },
      })

      await syncEmployeeStatusFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeStatusHistory",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_STATUS_HISTORY_UPDATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Employment status history updated." }
  } catch {
    return { ok: false, error: "Unable to update employment status history right now. Please try again." }
  }
}

export async function deleteStatusHistoryEntryAction(input: DeleteStatusHistoryInput): Promise<ActionResult> {
  const parsed = deleteStatusHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status history request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeStatusHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeeStatusHistory.delete({ where: { id: existing.id } })
      await syncEmployeeStatusFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeStatusHistory",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_STATUS_HISTORY_DELETED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Employment status history deleted." }
  } catch {
    return { ok: false, error: "Unable to delete employment status history right now. Please try again." }
  }
}

export async function createRankHistoryEntryAction(input: CreateRankHistoryInput): Promise<ActionResult> {
  const parsed = createRankHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rank history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true, rankId: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const [previousRank, newRank] = await Promise.all([
        employee.rankId ? ensureRankInCompany(tx, employee.rankId, context.companyId) : Promise.resolve(null),
        ensureRankInCompany(tx, payload.newRankId, context.companyId),
      ])
      if (!newRank) throw new Error("INVALID_RANK")

      const movementType = toRankMovementType(previousRank?.level ?? null, newRank.level, payload.movementType)

      const created = await tx.employeeRankHistory.create({
        data: {
          employeeId: employee.id,
          previousRankId: employee.rankId,
          newRankId: payload.newRankId,
          movementType,
          effectiveDate,
          reason: toNullable(payload.reason),
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeeRankFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeRankHistory",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_RANK_HISTORY_CREATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Rank history added." }
  } catch {
    return { ok: false, error: "Unable to add rank history right now. Please try again." }
  }
}

export async function updateRankHistoryEntryAction(input: UpdateRankHistoryInput): Promise<ActionResult> {
  const parsed = updateRankHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rank history input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  const effectiveDate = parsePhDate(payload.effectiveDate)
  if (!effectiveDate) return { ok: false, error: "Please select a valid effective date." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: payload.employeeId, companyId: context.companyId, deletedAt: null },
        select: { id: true, rankId: true },
      })
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeRankHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true, previousRankId: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      const [previousRank, newRank] = await Promise.all([
        existing.previousRankId ? ensureRankInCompany(tx, existing.previousRankId, context.companyId) : Promise.resolve(null),
        ensureRankInCompany(tx, payload.newRankId, context.companyId),
      ])
      if (!newRank) throw new Error("INVALID_RANK")

      const movementType = toRankMovementType(previousRank?.level ?? null, newRank.level, payload.movementType)

      await tx.employeeRankHistory.update({
        where: { id: existing.id },
        data: {
          newRankId: payload.newRankId,
          movementType,
          effectiveDate,
          reason: toNullable(payload.reason),
          approvedById: context.userId,
          approvedAt: new Date(),
        },
      })

      await syncEmployeeRankFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeRankHistory",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_RANK_HISTORY_UPDATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Rank history updated." }
  } catch {
    return { ok: false, error: "Unable to update rank history right now. Please try again." }
  }
}

export async function deleteRankHistoryEntryAction(input: DeleteRankHistoryInput): Promise<ActionResult> {
  const parsed = deleteRankHistoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rank history request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeeRankHistory.findFirst({
        where: { id: payload.historyId, employeeId: employee.id },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeeRankHistory.delete({ where: { id: existing.id } })
      await syncEmployeeRankFromLatestHistory(tx, employee.id, context.userId)

      await createAuditLog(
        {
          tableName: "EmployeeRankHistory",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_RANK_HISTORY_DELETED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Rank history deleted." }
  } catch {
    return { ok: false, error: "Unable to delete rank history right now. Please try again." }
  }
}

export async function createPreviousEmploymentEntryAction(input: CreatePreviousEmploymentInput): Promise<ActionResult> {
  const parsed = createPreviousEmploymentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid previous employment input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const created = await tx.employeePreviousEmployment.create({
        data: {
          employeeId: employee.id,
          companyName: payload.companyName.trim(),
          position: toNullable(payload.position),
          startDate: parsePhDate(payload.startDate),
          endDate: parsePhDate(payload.endDate),
          lastSalary: payload.lastSalary,
          isActive: true,
        },
      })

      await createAuditLog(
        {
          tableName: "EmployeePreviousEmployment",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "EMPLOYEE_PREVIOUS_EMPLOYMENT_CREATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Previous employment history added." }
  } catch {
    return { ok: false, error: "Unable to add previous employment right now. Please try again." }
  }
}

export async function updatePreviousEmploymentEntryAction(input: UpdatePreviousEmploymentInput): Promise<ActionResult> {
  const parsed = updatePreviousEmploymentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid previous employment input." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeePreviousEmployment.findFirst({
        where: {
          id: payload.historyId,
          employeeId: employee.id,
          isActive: true,
        },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeePreviousEmployment.update({
        where: { id: existing.id },
        data: {
          companyName: payload.companyName.trim(),
          position: toNullable(payload.position),
          startDate: parsePhDate(payload.startDate),
          endDate: parsePhDate(payload.endDate),
          lastSalary: payload.lastSalary,
        },
      })

      await createAuditLog(
        {
          tableName: "EmployeePreviousEmployment",
          recordId: existing.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_PREVIOUS_EMPLOYMENT_UPDATED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Previous employment history updated." }
  } catch {
    return { ok: false, error: "Unable to update previous employment right now. Please try again." }
  }
}

export async function deletePreviousEmploymentEntryAction(input: DeletePreviousEmploymentInput): Promise<ActionResult> {
  const parsed = deletePreviousEmploymentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid previous employment request." }
  }

  const payload = parsed.data
  const context = await validateContextAndAccess(payload.companyId)
  if (!context) return { ok: false, error: "You do not have permission to update employee history." }

  try {
    await db.$transaction(async (tx) => {
      const employee = await ensureEmployeeInCompany(tx, payload.employeeId, context.companyId)
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND")

      const existing = await tx.employeePreviousEmployment.findFirst({
        where: {
          id: payload.historyId,
          employeeId: employee.id,
          isActive: true,
        },
        select: { id: true },
      })
      if (!existing) throw new Error("HISTORY_NOT_FOUND")

      await tx.employeePreviousEmployment.update({
        where: { id: existing.id },
        data: {
          isActive: false,
        },
      })

      await createAuditLog(
        {
          tableName: "EmployeePreviousEmployment",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_PREVIOUS_EMPLOYMENT_DELETED",
        },
        tx
      )
    })

    revalidateEmployeeProfilePaths(context.companyId, payload.employeeId)
    return { ok: true, message: "Previous employment history deleted." }
  } catch {
    return { ok: false, error: "Unable to delete previous employment right now. Please try again." }
  }
}
