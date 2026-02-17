import { ContactEmergencyDirectoryReportClient } from "@/modules/reports/hr/components/contact-emergency-directory-report-client"
import { getContactEmergencyDirectoryViewModel } from "@/modules/reports/hr/utils/get-contact-emergency-directory-view-model"
import { requireReportsPageContext } from "@/modules/reports/hr/utils/require-reports-page-context"

type ContactEmergencyDirectoryPageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{
    departmentId?: string
    includeInactive?: string
    directoryScope?: string
  }>
}

export default async function ContactEmergencyDirectoryPage({
  params,
  searchParams,
}: ContactEmergencyDirectoryPageProps) {
  const { companyId } = await params
  const parsedSearch = (await searchParams) ?? {}
  const company = await requireReportsPageContext(companyId)

  const viewModel = await getContactEmergencyDirectoryViewModel({
    companyId: company.companyId,
    departmentId: parsedSearch.departmentId,
    includeInactive: parsedSearch.includeInactive,
    directoryScope: parsedSearch.directoryScope,
  })

  return <ContactEmergencyDirectoryReportClient {...viewModel} />
}
