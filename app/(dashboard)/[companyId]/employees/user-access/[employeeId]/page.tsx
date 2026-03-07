import { notFound, redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { EmployeeUserAccessDetailPage } from "@/modules/employees/user-access/components/employee-user-access-detail-page"
import { getUserAccessDetailData } from "@/modules/employees/user-access/utils/get-user-access-detail-data"

type UserAccessDetailRouteProps = {
  params: Promise<{ companyId: string; employeeId: string }>
}

export default async function UserAccessDetailRoutePage({
  params,
}: UserAccessDetailRouteProps) {
  const { companyId, employeeId } = await params

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

  const data = await getUserAccessDetailData(company.companyId, employeeId)
  if (!data) {
    notFound()
  }

  return <EmployeeUserAccessDetailPage data={data} />
}
