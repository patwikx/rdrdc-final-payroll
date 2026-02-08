"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

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
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "attendance")) {
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
