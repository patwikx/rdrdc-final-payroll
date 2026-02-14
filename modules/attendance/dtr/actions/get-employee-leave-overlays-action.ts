"use server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  dtrEmployeeDateRangeInputSchema,
  type DtrEmployeeDateRangeInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import type { LeaveOverlayItem } from "@/modules/attendance/dtr/types"
import { getApprovedLeaveOverlaysForEmployee } from "@/modules/leave/utils/leave-domain"

type GetEmployeeLeaveOverlaysActionResult =
  | { ok: true; data: LeaveOverlayItem[] }
  | { ok: false; error: string }

const toPhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

export async function getEmployeeLeaveOverlaysAction(params: {
  companyId: string
  employeeId: string
  startDate: string
  endDate: string
}): Promise<GetEmployeeLeaveOverlaysActionResult> {
  const parsed = dtrEmployeeDateRangeInputSchema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave overlay filters." }
  }

  const payload: DtrEmployeeDateRangeInput = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to view leave overlays." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  const leaves = await getApprovedLeaveOverlaysForEmployee({
    companyId: context.companyId,
    employeeId: payload.employeeId,
    startDate: toPhDate(payload.startDate),
    endDate: toPhDate(payload.endDate),
  })

  return {
    ok: true,
    data: leaves satisfies LeaveOverlayItem[],
  }
}
