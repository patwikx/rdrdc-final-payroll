import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { CertificateOfEmploymentClient } from "@/modules/reports/payroll/components/certificate-of-employment-client"
import { getCertificateOfEmploymentWorkspaceViewModel } from "@/modules/reports/payroll/utils/get-certificate-of-employment-view-model"

type CertificateOfEmploymentPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    employeeId?: string
    signatoryId?: string
    signatoryDepartmentId?: string
    includeCompensation?: string
    certificateDate?: string
    purpose?: string
  }>
}

export default async function CertificateOfEmploymentPage({
  params,
  searchParams,
}: CertificateOfEmploymentPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      redirect("/login")
    }
    throw error
  }

  if (!hasModuleAccess(company.companyRole as CompanyRole, "reports")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  const viewModel = await getCertificateOfEmploymentWorkspaceViewModel({
    companyId: company.companyId,
    employeeId: parsedSearch.employeeId,
    signatoryId: parsedSearch.signatoryId,
    signatoryDepartmentId: parsedSearch.signatoryDepartmentId,
    includeCompensation: parsedSearch.includeCompensation,
    certificateDate: parsedSearch.certificateDate,
    purpose: parsedSearch.purpose,
  })

  return <CertificateOfEmploymentClient {...viewModel} />
}
