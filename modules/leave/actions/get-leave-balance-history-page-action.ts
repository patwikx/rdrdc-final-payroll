"use server"

import { RequestStatus } from "@prisma/client"
import { z } from "zod"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { LeaveActionDataResult } from "@/modules/leave/types/leave-action-result"
import type { LeaveBalanceWorkspaceHistoryPage } from "@/modules/leave/types/leave-domain-types"
import { getLeaveBalanceEmployeeHistoryPageData, resolveLeaveYear } from "@/modules/leave/utils/leave-domain"

const getLeaveBalanceHistoryPageSchema = z.object({
  companyId: z.string().uuid(),
  year: z.number().int().min(2000).max(9999).optional(),
  employeeId: z.string().uuid(),
  leaveType: z.string().trim().max(120).optional(),
  statusCode: z.nativeEnum(RequestStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export async function getLeaveBalanceHistoryPageAction(
  input: z.input<typeof getLeaveBalanceHistoryPageSchema>
): Promise<LeaveActionDataResult<LeaveBalanceWorkspaceHistoryPage>> {
  const parsed = getLeaveBalanceHistoryPageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave history request." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "leave")) {
    return { ok: false, error: "You do not have permission to view leave balances." }
  }

  const selectedYear = resolveLeaveYear(payload.year)
  const data = await getLeaveBalanceEmployeeHistoryPageData({
    companyId: context.companyId,
    year: selectedYear,
    employeeId: payload.employeeId,
    leaveType: payload.leaveType?.trim() || undefined,
    statusCode: payload.statusCode,
    page: payload.page,
    pageSize: payload.pageSize,
  })

  return { ok: true, data }
}
