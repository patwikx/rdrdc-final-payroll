import { redirect } from "next/navigation"

import { PurchaseRequestDetailPage } from "@/modules/procurement/components/purchase-request-detail-page"
import { getPurchaseRequestById } from "@/modules/procurement/utils/purchase-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import {
  hasEmployeePortalCapability,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseRequestDetailRouteProps = {
  params: Promise<{ companyId: string; requestId: string }>
}

export default async function PurchaseRequestDetailRoute({ params }: PurchaseRequestDetailRouteProps) {
  const { companyId, requestId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_requests.view")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const request = await getPurchaseRequestById({
    companyId: context.companyId,
    requestId,
    actorUserId: context.userId,
  })

  if (!request) {
    redirect(`/${context.companyId}/employee-portal/purchase-requests`)
  }

  const canViewAll = hasEmployeePortalCapability(context.capabilities, "purchase_requests.view_all")

  if (!canViewAll && request.requesterUserId !== context.userId) {
    redirect(`/${context.companyId}/employee-portal/purchase-requests`)
  }

  if (request.status === "DRAFT" && request.requesterUserId === context.userId) {
    redirect(`/${context.companyId}/employee-portal/purchase-requests/${request.id}/edit`)
  }

  return (
    <PurchaseRequestDetailPage
      companyId={context.companyId}
      companyName={context.companyName}
      request={request}
    />
  )
}
