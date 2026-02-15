"use server"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { leaveBalanceWorkspaceInputSchema } from "@/modules/leave/schemas/leave-query-schemas"
import type { LeaveActionDataResult } from "@/modules/leave/types/leave-action-result"
import { getLeaveBalanceWorkspaceData, resolveLeaveYear } from "@/modules/leave/utils/leave-domain"

type GetLeaveBalanceWorkspaceActionResult = LeaveActionDataResult<
  Awaited<ReturnType<typeof getLeaveBalanceWorkspaceData>> & { selectedYear: number }
>

export async function getLeaveBalanceWorkspaceAction(input: {
  companyId: string
  year?: number
}): Promise<GetLeaveBalanceWorkspaceActionResult> {
  const parsed = leaveBalanceWorkspaceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid leave balance request." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "leave")) {
    return { ok: false, error: "You do not have permission to view leave balances." }
  }

  const selectedYear = resolveLeaveYear(payload.year)
  const data = await getLeaveBalanceWorkspaceData({
    companyId: context.companyId,
    year: selectedYear,
  })

  return { ok: true, data: { ...data, selectedYear } }
}
