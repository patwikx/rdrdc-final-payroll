import { notFound, redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { StandaloneUserAccessDetailPage } from "@/modules/employees/user-access/components/standalone-user-access-detail-page"
import { getStandaloneUserAccessCreateData } from "@/modules/employees/user-access/utils/get-standalone-user-access-create-data"

type StandaloneUserAccessCreateRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function StandaloneUserAccessCreateRoutePage({
  params,
}: StandaloneUserAccessCreateRouteProps) {
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
      notFound()
    }
  }

  if (!company || !hasModuleAccess(company.companyRole as CompanyRole, "employees")) {
    redirect(`/${companyId}/dashboard`)
  }

  const data = await getStandaloneUserAccessCreateData(company.companyId)
  if (!data) {
    notFound()
  }

  return <StandaloneUserAccessDetailPage data={data} mode="create" />
}
