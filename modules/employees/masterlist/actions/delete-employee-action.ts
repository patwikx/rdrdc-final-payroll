"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

const deleteEmployeeInputSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
})

const restoreEmployeeInputSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  restoreActive: z.boolean().default(true),
})

type DeleteEmployeeInput = z.infer<typeof deleteEmployeeInputSchema>
type RestoreEmployeeInput = z.infer<typeof restoreEmployeeInputSchema>

type DeleteEmployeeActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const canDeleteEmployeeRecord = (companyRole: CompanyRole, isSuperAdmin: boolean): boolean => {
  if (isSuperAdmin) return true
  return companyRole === "COMPANY_ADMIN"
}

const canRestoreEmployeeRecord = (companyRole: CompanyRole, isSuperAdmin: boolean): boolean => {
  if (isSuperAdmin) return true
  return companyRole === "COMPANY_ADMIN"
}

export async function deleteEmployeeAction(
  input: DeleteEmployeeInput
): Promise<DeleteEmployeeActionResult> {
  const parsed = deleteEmployeeInputSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid delete payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid delete payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const companyRole = context.companyRole as CompanyRole

  if (!canDeleteEmployeeRecord(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin or Super Admin can delete employees." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    const deletedAt = new Date()

    await db.$transaction(async (tx) => {
      const existing = await tx.employee.findFirst({
        where: {
          id: payload.employeeId,
          companyId: context.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
          isActive: true,
        },
      })

      if (!existing) {
        throw new Error("EMPLOYEE_NOT_FOUND")
      }

      if (existing.userId && existing.userId === context.userId) {
        throw new Error("SELF_DELETE_NOT_ALLOWED")
      }

      await tx.employee.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          deletedAt,
          deletedById: context.userId,
          updatedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: existing.id,
          action: "DELETE",
          userId: context.userId,
          reason: "EMPLOYEE_SOFT_DELETED",
          changes: [
            { fieldName: "isActive", oldValue: existing.isActive, newValue: false },
            { fieldName: "deletedAt", oldValue: existing.deletedAt, newValue: deletedAt },
            { fieldName: "deletedById", oldValue: null, newValue: context.userId },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/employees`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Employee deleted successfully." }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return { ok: false, error: "Employee record was not found in the selected company." }
    }

    if (error instanceof Error && error.message === "SELF_DELETE_NOT_ALLOWED") {
      return { ok: false, error: "You cannot delete your own employee record." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to delete employee: ${message}` }
  }
}

export async function restoreEmployeeAction(
  input: RestoreEmployeeInput
): Promise<DeleteEmployeeActionResult> {
  const parsed = restoreEmployeeInputSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid restore payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid restore payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const companyRole = context.companyRole as CompanyRole

  if (!canRestoreEmployeeRecord(companyRole, isSuperAdmin)) {
    return { ok: false, error: "Only Company Admin or Super Admin can restore employees." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.employee.findFirst({
        where: {
          id: payload.employeeId,
          companyId: context.companyId,
          deletedAt: { not: null },
        },
        select: {
          id: true,
          deletedAt: true,
          deletedById: true,
          isActive: true,
        },
      })

      if (!existing) {
        throw new Error("EMPLOYEE_NOT_FOUND_OR_NOT_DELETED")
      }

      await tx.employee.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          deletedById: null,
          isActive: payload.restoreActive,
          updatedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: existing.id,
          action: "RESTORE",
          userId: context.userId,
          reason: "EMPLOYEE_SOFT_DELETE_UNDO",
          changes: [
            { fieldName: "deletedAt", oldValue: existing.deletedAt, newValue: null },
            { fieldName: "deletedById", oldValue: existing.deletedById, newValue: null },
            { fieldName: "isActive", oldValue: existing.isActive, newValue: payload.restoreActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/employees`)
    revalidatePath(`/${context.companyId}/employees/${payload.employeeId}`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Employee delete was undone." }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND_OR_NOT_DELETED") {
      return { ok: false, error: "Employee is not available for restore." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to restore employee: ${message}` }
  }
}
