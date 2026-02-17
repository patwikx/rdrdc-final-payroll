import { MovementChangeLogReportClient } from "@/modules/reports/hr/components/movement-change-log-report-client"
import { getMovementChangeLogViewModel } from "@/modules/reports/hr/utils/get-movement-change-log-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type MovementChangeLogPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    departmentId?: string
    includeInactive?: string
    movementCategory?: string
  }>
}

export default async function MovementChangeLogPage({
  params,
  searchParams,
}: MovementChangeLogPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)

  const viewModel = await getMovementChangeLogViewModel({
    companyId: company.companyId,
    startDate: parsedSearch.startDate,
    endDate: parsedSearch.endDate,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    movementCategory: parsedSearch.movementCategory,
  })

  return <MovementChangeLogReportClient {...viewModel} />
}
