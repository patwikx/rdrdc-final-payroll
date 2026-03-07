import { redirect } from "next/navigation"

import { MaterialRequestProcessingDetailPage } from "@/modules/material-requests/components/material-request-processing-detail-page"
import { getEmployeePortalMaterialRequestProcessingDetailReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type MaterialRequestProcessingDetailRouteProps = {
  params: Promise<{ companyId: string; requestId: string }>
}

export default async function MaterialRequestProcessingDetailRoute({
  params,
}: MaterialRequestProcessingDetailRouteProps) {
  const { companyId, requestId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const canProcess = hasEmployeePortalCapability(context.capabilities, "material_requests.processing.manage")

  if (!canProcess) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const detail = await getEmployeePortalMaterialRequestProcessingDetailReadModel({
    companyId: context.companyId,
    requestId,
  })

  if (!detail) {
    redirect(`/${context.companyId}/employee-portal/material-request-processing`)
  }

  return <MaterialRequestProcessingDetailPage companyId={context.companyId} companyName={context.companyName} detail={detail} />
}
