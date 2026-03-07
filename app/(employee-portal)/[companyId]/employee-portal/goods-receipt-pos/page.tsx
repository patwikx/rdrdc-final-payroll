import { redirect } from "next/navigation"

import { getPurchaseOrderGoodsReceiptWorkspaceAction } from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderGoodsReceiptWorkspacePage } from "@/modules/procurement/components/purchase-order-goods-receipt-workspace-page"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseOrderGoodsReceiptWorkspaceRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function PurchaseOrderGoodsReceiptWorkspaceRoute({
  params,
}: PurchaseOrderGoodsReceiptWorkspaceRouteProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "goods_receipt_pos.manage")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const workspace = await getPurchaseOrderGoodsReceiptWorkspaceAction({
    companyId: context.companyId,
  })

  if (!workspace.ok) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Goods Receipt PO</h1>
        <p className="text-sm text-muted-foreground">{workspace.error}</p>
      </main>
    )
  }

  return (
    <PurchaseOrderGoodsReceiptWorkspacePage
      companyId={context.companyId}
      rows={workspace.data.rows}
      availableOrders={workspace.data.availableOrders}
      availableOrderCount={workspace.data.availableOrders.length}
    />
  )
}
