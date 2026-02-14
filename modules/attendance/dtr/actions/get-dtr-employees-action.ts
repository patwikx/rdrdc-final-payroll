"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { dtrCompanyInputSchema } from "@/modules/attendance/dtr/schemas/dtr-actions-schema"

type DtrEmployee = {
  id: string
  firstName: string
  lastName: string
  employeeNumber: string
  workSchedule: {
    id: string
    name: string
    restDays: unknown
  } | null
}

type GetDtrEmployeesActionResult =
  | { ok: true; data: DtrEmployee[] }
  | { ok: false; error: string }

export async function getDtrEmployeesAction(companyId: string): Promise<GetDtrEmployeesActionResult> {
  const parsed = dtrCompanyInputSchema.safeParse({ companyId })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid company id." }
  }

  const context = await getActiveCompanyContext({ companyId: parsed.data.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to view employees for DTR." }
  }

  const employees = await db.employee.findMany({
    where: {
      companyId: context.companyId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      workSchedule: {
        select: {
          id: true,
          name: true,
          restDays: true,
        },
      },
    },
  })

  return { ok: true, data: employees }
}
