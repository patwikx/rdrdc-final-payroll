import { redirect } from "next/navigation"

import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"
import { MaterialRequestApprovalSettingsPage } from "@/modules/settings/material-requests/components/material-request-approval-settings-page"
import { getMaterialRequestApprovalSettingsViewModel } from "@/modules/settings/material-requests/utils/get-material-request-approval-settings-view-model"

type EmployeePortalRequestSettingsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function EmployeePortalRequestSettingsPage({
  params,
}: EmployeePortalRequestSettingsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "request_settings.manage")) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const viewModel = await getMaterialRequestApprovalSettingsViewModel({
    companyId: context.companyId,
    companyName: context.companyName,
  })

  return <MaterialRequestApprovalSettingsPage data={viewModel} scope="employee-portal" />
}
