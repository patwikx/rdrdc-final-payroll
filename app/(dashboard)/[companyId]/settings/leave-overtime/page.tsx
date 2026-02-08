import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { LeaveOtPoliciesPage } from "@/modules/settings/leave-overtime/components/leave-ot-policies-page"
import { getLeaveOtPoliciesViewModel } from "@/modules/settings/leave-overtime/utils/get-leave-ot-policies-view-model"

type LeaveOtPoliciesRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Leave / OT Policies | ${company.companyName} | Final Payroll System`,
      description: `Manage leave and overtime policies for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Leave / OT Policies | Final Payroll System",
      description: "Manage leave and overtime policies.",
    }
  }
}

export default async function LeaveOtPoliciesRoutePage({ params }: LeaveOtPoliciesRouteProps) {
  const { companyId } = await params

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

  const viewModel = await getLeaveOtPoliciesViewModel(company.companyId)

  return (
    <LeaveOtPoliciesPage
      companyId={company.companyId}
      companyName={company.companyName}
      leaveTypes={viewModel.leaveTypes}
      employmentStatuses={viewModel.employmentStatuses}
      overtimeRates={viewModel.overtimeRates}
    />
  )
}
