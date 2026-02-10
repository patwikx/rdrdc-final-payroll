import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { DashboardActionCenter } from "@/modules/dashboard/components/dashboard-page-iterations"
import { getDashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

type CompanyDashboardPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ cycle?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Dashboard | ${company.companyName} | Final Payroll System`,
      description: `Payroll workspace for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Dashboard | Final Payroll System",
      description: "Payroll workspace.",
    }
  }
}

export default async function CompanyDashboardPage({ params, searchParams }: CompanyDashboardPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const cycleMode = parsedSearch.cycle === "previous" || parsedSearch.cycle === "month" ? parsedSearch.cycle : "current"

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null
  let hasCompanyAccessError = false

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      hasCompanyAccessError = true
    } else {
      throw error
    }
  }

  if (hasCompanyAccessError || !company) {
    try {
      const fallbackCompany = await getActiveCompanyContext()
      redirect(`/${fallbackCompany.companyId}/dashboard`)
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

  return (
    <DashboardActionCenter
      companyId={company.companyId}
      companyName={company.companyName}
      companyCode={company.companyCode}
      companyRole={company.companyRole}
      data={await getDashboardActionCenterData(company.companyId, cycleMode)}
    />
  )
}
