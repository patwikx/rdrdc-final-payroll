import { GovernmentIdComplianceReportClient } from "@/modules/reports/hr/components/government-id-compliance-report-client"
import { getGovernmentIdComplianceViewModel } from "@/modules/reports/hr/utils/get-government-id-compliance-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type GovernmentIdCompliancePageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    departmentId?: string
    includeInactive?: string
    complianceScope?: string
  }>
}

export default async function GovernmentIdCompliancePage({ params, searchParams }: GovernmentIdCompliancePageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)
  const viewModel = await getGovernmentIdComplianceViewModel({
    companyId: company.companyId,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    complianceScope: parsedSearch.complianceScope,
  })

  return <GovernmentIdComplianceReportClient {...viewModel} />
}
