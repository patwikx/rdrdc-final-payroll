import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { OrganizationSetupPage } from "@/modules/settings/organization/components/organization-setup-page"
import { getOrganizationOverviewData } from "@/modules/settings/organization/utils/get-organization-overview-data"

type OrganizationSetupRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Organization Setup | ${company.companyName} | Final Payroll System`,
      description: `Manage organization setup for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Organization Setup | Final Payroll System",
      description: "Manage organization setup.",
    }
  }
}

export default async function OrganizationSetupRoutePage({ params }: OrganizationSetupRouteProps) {
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

  const organizationData = await getOrganizationOverviewData(company.companyId)

  return <OrganizationSetupPage data={organizationData} />
}
