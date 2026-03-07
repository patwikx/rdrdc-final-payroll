import { redirect } from "next/navigation"

import {
  getNextPurchaseOrderGoodsReceiptNumberPreview,
  getPurchaseOrderGoodsReceiptWorkspaceAction,
} from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderGoodsReceiptCreatePage } from "@/modules/procurement/components/purchase-order-goods-receipt-create-page"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseOrderGoodsReceiptCreateRouteProps = {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ purchaseOrderId?: string }>
}

export default async function PurchaseOrderGoodsReceiptCreateRoute({
  params,
  searchParams,
}: PurchaseOrderGoodsReceiptCreateRouteProps) {
  const { companyId } = await params
  const { purchaseOrderId } = await searchParams
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "goods_receipt_pos.manage")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const [workspace, nextGrpoNumber] = await Promise.all([
    getPurchaseOrderGoodsReceiptWorkspaceAction({
      companyId: context.companyId,
    }),
    getNextPurchaseOrderGoodsReceiptNumberPreview(context.companyId),
  ])

  if (!workspace.ok) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Create Goods Receipt PO</h1>
        <p className="text-sm text-muted-foreground">{workspace.error}</p>
      </main>
    )
  }

  return (
    <PurchaseOrderGoodsReceiptCreatePage
      companyId={context.companyId}
      availableOrders={workspace.data.availableOrders}
      nextGrpoNumber={nextGrpoNumber}
      initialPurchaseOrderId={purchaseOrderId}
    />
  )
}
