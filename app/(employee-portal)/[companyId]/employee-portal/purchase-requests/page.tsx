import { redirect } from "next/navigation"

import { PurchaseRequestClient } from "@/modules/procurement/components/purchase-request-client"
import { getPurchaseRequestsReadModel } from "@/modules/procurement/utils/purchase-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseRequestsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PurchaseRequestsPage({ params }: PurchaseRequestsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_requests.view")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const canViewAll = hasEmployeePortalCapability(context.capabilities, "purchase_requests.view_all")
  const requests = await getPurchaseRequestsReadModel({
    companyId: context.companyId,
    userId: context.userId,
    canViewAll,
  })

  return (
    <PurchaseRequestClient
      companyId={context.companyId}
      requests={requests}
      canCreateRequest={hasEmployeePortalCapability(context.capabilities, "purchase_requests.create")}
    />
  )
}
