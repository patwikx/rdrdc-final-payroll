import { notFound, redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { StandaloneUserAccessDetailPage } from "@/modules/employees/user-access/components/standalone-user-access-detail-page"
import { getStandaloneUserAccessDetailData } from "@/modules/employees/user-access/utils/get-standalone-user-access-detail-data"

type AgencyUserAccessDetailRouteProps = {
  params: Promise<{ companyId: string; userId: string }>
}

export default async function AgencyUserAccessDetailRoutePage({
  params,
}: AgencyUserAccessDetailRouteProps) {
  const { companyId, userId } = await params

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

  const data = await getStandaloneUserAccessDetailData(company.companyId, userId)
  if (!data) {
    notFound()
  }

  if (data.user.linkedEmployeeId) {
    redirect(`/${companyId}/employees/user-access/${data.user.linkedEmployeeId}`)
  }

  return <StandaloneUserAccessDetailPage data={data} />
}
