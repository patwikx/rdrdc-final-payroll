import { TrainingCertificationComplianceReportClient } from "@/modules/reports/hr/components/training-certification-compliance-report-client"
import { getTrainingCertificationComplianceViewModel } from "@/modules/reports/hr/utils/get-training-certification-compliance-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type TrainingCertificationCompliancePageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    departmentId?: string
    includeInactive?: string
    complianceScope?: string
  }>
}

export default async function TrainingCertificationCompliancePage({
  params,
  searchParams,
}: TrainingCertificationCompliancePageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)
  const viewModel = await getTrainingCertificationComplianceViewModel({
    companyId: company.companyId,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    complianceScope: parsedSearch.complianceScope,
  })

  return <TrainingCertificationComplianceReportClient {...viewModel} />
}
