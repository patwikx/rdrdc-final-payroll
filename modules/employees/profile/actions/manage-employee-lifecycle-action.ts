"use server"

import { Prisma, SeparationReasonCode } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  manageEmployeeLifecycleInputSchema,
  type ManageEmployeeLifecycleInput,
} from "@/modules/employees/profile/schemas/manage-employee-lifecycle-schema"

type ManageEmployeeLifecycleActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const normalized = value.trim()
  if (normalized.length === 0) return null
  const [year, month, day] = normalized.split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const getTodayPhDate = (): Date => {
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date())

  return parsePhDate(today) ?? new Date()
}

export async function manageEmployeeLifecycleAction(
  input: ManageEmployeeLifecycleInput
): Promise<ManageEmployeeLifecycleActionResult> {
  const parsed = manageEmployeeLifecycleInputSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? "Please review the lifecycle form and try again." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to update employee lifecycle in this company." }
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
          firstName: true,
          lastName: true,
          isActive: true,
          separationDate: true,
          lastWorkingDay: true,
          separationReasonCode: true,
          isRehireEligible: true,
          rehireNotes: true,
        },
      })

      if (!employee) {
        throw new Error("EMPLOYEE_NOT_FOUND")
      }

      if (!employee.isActive) {
        throw new Error("EMPLOYEE_ALREADY_INACTIVE")
      }

      const separationDate = parsePhDate(payload.separationDate) ?? getTodayPhDate()
      const resolvedLastWorkingDayInput =
        payload.lastWorkingDay && payload.lastWorkingDay.trim().length > 0
          ? payload.lastWorkingDay
          : payload.separationDate
      const lastWorkingDay = parsePhDate(resolvedLastWorkingDayInput) ?? separationDate
      const reasonCode =
        (payload.separationReasonCode as SeparationReasonCode | undefined) ??
        SeparationReasonCode.OTHER
      const remarks = payload.remarks?.trim() || null

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          isActive: false,
          separationDate,
          lastWorkingDay,
          separationReasonCode: reasonCode,
          ...(payload.actionType === "TERMINATE" ? { isRehireEligible: false } : {}),
          ...(remarks ? { rehireNotes: remarks } : {}),
          updatedById: context.userId,
        },
      })

      await createAuditLog(
        {
          tableName: "Employee",
          recordId: employee.id,
          action: "UPDATE",
          userId: context.userId,
          reason: payload.actionType === "TERMINATE" ? "EMPLOYEE_TERMINATED" : "EMPLOYEE_DEACTIVATED",
          changes: [
            { fieldName: "isActive", oldValue: employee.isActive, newValue: false },
            { fieldName: "separationDate", oldValue: employee.separationDate, newValue: separationDate },
            { fieldName: "lastWorkingDay", oldValue: employee.lastWorkingDay, newValue: lastWorkingDay },
            { fieldName: "separationReasonCode", oldValue: employee.separationReasonCode, newValue: reasonCode },
            ...(payload.actionType === "TERMINATE"
              ? [{ fieldName: "isRehireEligible", oldValue: employee.isRehireEligible, newValue: false }]
              : []),
            ...(remarks ? [{ fieldName: "rehireNotes", oldValue: employee.rehireNotes, newValue: remarks }] : []),
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/employees`)
    revalidatePath(`/${context.companyId}/employees/${payload.employeeId}`)

    return {
      ok: true,
      message: payload.actionType === "TERMINATE"
        ? "Employee terminated successfully."
        : "Employee deactivated successfully.",
    }
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") {
      return { ok: false, error: "Employee record was not found in the selected company." }
    }

    if (error instanceof Error && error.message === "EMPLOYEE_ALREADY_INACTIVE") {
      return { ok: false, error: "This employee is already inactive." }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "Unable to update lifecycle due to a related-record constraint." }
    }

    return { ok: false, error: "Unable to update employee lifecycle right now. Please try again." }
  }
}
