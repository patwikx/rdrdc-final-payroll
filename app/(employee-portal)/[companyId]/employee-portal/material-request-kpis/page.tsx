import { redirect } from "next/navigation"

import { MaterialRequestKpiDashboardPage } from "@/modules/material-requests/components/material-request-kpi-dashboard-page"
import {
  getEmployeePortalMaterialRequestKpiDashboardReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import type { EmployeePortalMaterialRequestKpiRange } from "@/modules/material-requests/types/employee-portal-material-request-types"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type MaterialRequestKpiPageProps = {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ range?: string }>
}

const KPI_RANGE_VALUES: EmployeePortalMaterialRequestKpiRange[] = [
  "LAST_30_DAYS",
  "LAST_90_DAYS",
  "LAST_180_DAYS",
  "YTD",
  "ALL",
]

export default async function MaterialRequestKpiPage({ params, searchParams }: MaterialRequestKpiPageProps) {
  const { companyId } = await params
  const query = await searchParams
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "material_requests.kpi.view")) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const canViewCompanyWide = hasEmployeePortalCapability(
    context.capabilities,
    "material_requests.kpi.view_company"
  )

  const rangeCandidate = query.range
  const range = KPI_RANGE_VALUES.includes(rangeCandidate as EmployeePortalMaterialRequestKpiRange)
    ? (rangeCandidate as EmployeePortalMaterialRequestKpiRange)
    : "LAST_90_DAYS"

  const dashboard = await getEmployeePortalMaterialRequestKpiDashboardReadModel({
    companyId: context.companyId,
    range,
    requesterUserId: canViewCompanyWide ? undefined : context.userId,
  })

  return (
    <MaterialRequestKpiDashboardPage
      companyId={context.companyId}
      canViewCompanyWide={canViewCompanyWide}
      dashboard={dashboard}
    />
  )
}
