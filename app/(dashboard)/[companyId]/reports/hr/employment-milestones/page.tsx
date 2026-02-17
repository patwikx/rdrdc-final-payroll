import { EmploymentMilestonesReportClient } from "@/modules/reports/hr/components/employment-milestones-report-client"
import { getEmploymentMilestonesViewModel } from "@/modules/reports/hr/utils/get-employment-milestones-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type EmploymentMilestonesPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    departmentId?: string
    includeInactive?: string
    milestoneScope?: string
  }>
}

export default async function EmploymentMilestonesPage({
  params,
  searchParams,
}: EmploymentMilestonesPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)

  const viewModel = await getEmploymentMilestonesViewModel({
    companyId: company.companyId,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    milestoneScope: parsedSearch.milestoneScope,
  })

  return <EmploymentMilestonesReportClient {...viewModel} />
}
