import { redirect } from "next/navigation"

import {
  getNextPurchaseOrderNumberPreview,
  getPurchaseOrderWorkspaceAction,
} from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderCreatePage } from "@/modules/procurement/components/purchase-order-create-page"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseOrderCreateRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function PurchaseOrderCreateRoute({ params }: PurchaseOrderCreateRouteProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_orders.manage")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const [workspace, nextPoNumber] = await Promise.all([
    getPurchaseOrderWorkspaceAction({
      companyId: context.companyId,
    }),
    getNextPurchaseOrderNumberPreview(context.companyId),
  ])

  if (!workspace.ok) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Create Purchase Order</h1>
        <p className="text-sm text-muted-foreground">{workspace.error}</p>
      </main>
    )
  }

  return (
    <PurchaseOrderCreatePage
      companyId={context.companyId}
      availableSourceRequests={workspace.data.availableSourceRequests}
      nextPoNumber={nextPoNumber}
    />
  )
}
