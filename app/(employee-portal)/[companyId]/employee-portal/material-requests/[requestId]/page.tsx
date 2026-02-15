import { redirect } from "next/navigation"

import { MaterialRequestDetailPage } from "@/modules/material-requests/components/material-request-detail-page"
import { getEmployeePortalMaterialRequestsReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestDetailRouteProps = {
  params: Promise<{ companyId: string; requestId: string }>
}

export default async function MaterialRequestDetailRoute({ params }: MaterialRequestDetailRouteProps) {
  const { companyId, requestId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  const requests = await getEmployeePortalMaterialRequestsReadModel({
    companyId: context.companyId,
    userId: context.userId,
  })

  const request = requests.find((item) => item.id === requestId)

  if (!request) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  if (request.status === "DRAFT") {
    redirect(`/${context.companyId}/employee-portal/material-requests/${request.id}/edit`)
  }

  return (
    <MaterialRequestDetailPage
      companyId={context.companyId}
      companyName={context.companyName}
      request={request}
    />
  )
}
