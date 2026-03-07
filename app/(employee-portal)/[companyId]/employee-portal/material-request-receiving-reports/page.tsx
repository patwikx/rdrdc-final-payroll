import { redirect } from "next/navigation"

import { MaterialRequestReceivingReportClient } from "@/modules/material-requests/components/material-request-receiving-report-client"
import {
  getEmployeePortalMaterialRequestDepartmentOptions,
  getEmployeePortalMaterialRequestReceivingReportPageReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type MaterialRequestReceivingReportsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestReceivingReportsPage({
  params,
}: MaterialRequestReceivingReportsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "material_requests.receiving_reports.view")) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const canViewCompanyWide = hasEmployeePortalCapability(
    context.capabilities,
    "material_requests.receiving_reports.view_company"
  )

  const [receivingPage, departmentOptions] = await Promise.all([
    getEmployeePortalMaterialRequestReceivingReportPageReadModel({
      companyId: context.companyId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
      requesterUserId: canViewCompanyWide ? undefined : context.userId,
    }),
    getEmployeePortalMaterialRequestDepartmentOptions({
      companyId: context.companyId,
    }),
  ])

  return (
    <MaterialRequestReceivingReportClient
      companyId={context.companyId}
      departmentOptions={departmentOptions}
      initialRows={receivingPage.rows}
      initialTotal={receivingPage.total}
      initialPage={receivingPage.page}
      initialPageSize={receivingPage.pageSize}
      canViewCompanyWide={canViewCompanyWide}
    />
  )
}
