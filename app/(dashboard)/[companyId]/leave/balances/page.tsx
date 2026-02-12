import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveBalancePage } from "@/modules/leave/components/leave-balance-page"
import { getLeaveBalanceWorkspaceData, resolveLeaveYear } from "@/modules/leave/utils/leave-domain"

type LeaveBalancesRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ year?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Leave Balance | ${company.companyName} | Final Payroll System`,
      description: `Review leave balances for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Leave Balance | Final Payroll System",
      description: "Review leave balances.",
    }
  }
}

export default async function LeaveBalancesRoutePage({ params, searchParams }: LeaveBalancesRouteProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null
  let noAccess = false

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      noAccess = true
    } else {
      throw error
    }
  }

  if (noAccess || !company) {
    try {
      const fallback = await getActiveCompanyContext()
      redirect(`/${fallback.companyId}/dashboard`)
    } catch {
      return (
        <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
          <h1 className="text-lg font-semibold text-foreground">No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  const yearFromQuery = Number(parsedSearch.year)
  const selectedYear = resolveLeaveYear(Number.isFinite(yearFromQuery) ? yearFromQuery : undefined)
  const { years, balanceRows, historyRows } = await getLeaveBalanceWorkspaceData({
    companyId: company.companyId,
    year: selectedYear,
  })

  return (
    <LeaveBalancePage
      companyId={company.companyId}
      selectedYear={selectedYear}
      years={years}
      balanceRows={balanceRows}
      historyRows={historyRows}
    />
  )
}
