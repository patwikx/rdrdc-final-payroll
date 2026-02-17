import { SeparationAttritionDetailReportClient } from "@/modules/reports/hr/components/separation-attrition-detail-report-client"
import { getSeparationAttritionDetailViewModel } from "@/modules/reports/hr/utils/get-separation-attrition-detail-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type SeparationAttritionDetailPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    departmentId?: string
    includeInactive?: string
    attritionScope?: string
  }>
}

export default async function SeparationAttritionDetailPage({
  params,
  searchParams,
}: SeparationAttritionDetailPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)
  const viewModel = await getSeparationAttritionDetailViewModel({
    companyId: company.companyId,
    startDate: parsedSearch.startDate,
    endDate: parsedSearch.endDate,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    attritionScope: parsedSearch.attritionScope,
  })

  return <SeparationAttritionDetailReportClient {...viewModel} />
}
