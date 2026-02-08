import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { OrganizationEntityListPage } from "@/modules/settings/organization/components/organization-entity-list-page"
import {
  getOrganizationEntityList,
  type OrganizationEntityKey,
} from "@/modules/settings/organization/utils/get-organization-entity-list"

type OrganizationEntityRouteProps = {
  params: Promise<{ companyId: string; entity: string }>
}

const isOrganizationEntityKey = (value: string): value is OrganizationEntityKey => {
  return ["departments", "positions", "branches", "divisions", "ranks"].includes(value)
}

export async function generateMetadata({ params }: OrganizationEntityRouteProps): Promise<Metadata> {
  const { entity } = await params

  if (!isOrganizationEntityKey(entity)) {
    return {
      title: "Organization | Final Payroll System",
      description: "Organization records.",
    }
  }

  const titleByEntity: Record<OrganizationEntityKey, string> = {
    departments: "Departments",
    positions: "Positions",
    branches: "Branches",
    divisions: "Divisions",
    ranks: "Ranks",
  }

  return {
    title: `${titleByEntity[entity]} | Organization | Final Payroll System`,
    description: `Company-scoped ${titleByEntity[entity].toLowerCase()} records.`,
  }
}

export default async function OrganizationEntityRoutePage({ params }: OrganizationEntityRouteProps) {
  const { companyId, entity } = await params

  if (!isOrganizationEntityKey(entity)) {
    notFound()
  }

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

  const data = await getOrganizationEntityList(company.companyId, entity)

  return <OrganizationEntityListPage data={data} />
}
