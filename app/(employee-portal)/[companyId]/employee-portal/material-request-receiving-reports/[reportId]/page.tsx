import { redirect } from "next/navigation"

import { MaterialRequestReceivingReportDetailPage } from "@/modules/material-requests/components/material-request-receiving-report-detail-page"
import { getEmployeePortalMaterialRequestReceivingReportDetailReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestReceivingReportDetailRouteProps = {
  params: Promise<{ companyId: string; reportId: string }>
}

export default async function MaterialRequestReceivingReportDetailRoute({
  params,
}: MaterialRequestReceivingReportDetailRouteProps) {
  const { companyId, reportId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canViewCompanyWide =
    isHR ||
    context.isMaterialRequestPurchaser ||
    context.isMaterialRequestPoster

  const detail = await getEmployeePortalMaterialRequestReceivingReportDetailReadModel({
    companyId: context.companyId,
    reportId,
    requesterUserId: canViewCompanyWide ? undefined : context.userId,
  })

  if (!detail) {
    redirect(`/${context.companyId}/employee-portal/material-request-receiving-reports`)
  }

  return (
    <MaterialRequestReceivingReportDetailPage
      companyId={context.companyId}
      companyName={context.companyName}
      detail={detail}
    />
  )
}
