"use server"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { LeaveActionDataResult } from "@/modules/leave/types/leave-action-result"
import { getLeaveBalanceWorkspaceData, resolveLeaveYear } from "@/modules/leave/utils/leave-domain"

type GetLeaveBalanceWorkspaceActionResult = LeaveActionDataResult<
  Awaited<ReturnType<typeof getLeaveBalanceWorkspaceData>> & { selectedYear: number }
>

export async function getLeaveBalanceWorkspaceAction(input: {
  companyId: string
  year?: number
}): Promise<GetLeaveBalanceWorkspaceActionResult> {
  const context = await getActiveCompanyContext({ companyId: input.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "leave")) {
    return { ok: false, error: "You do not have permission to view leave balances." }
  }

  const selectedYear = resolveLeaveYear(input.year)
  const data = await getLeaveBalanceWorkspaceData({
    companyId: context.companyId,
    year: selectedYear,
  })

  return { ok: true, data: { ...data, selectedYear } }
}
