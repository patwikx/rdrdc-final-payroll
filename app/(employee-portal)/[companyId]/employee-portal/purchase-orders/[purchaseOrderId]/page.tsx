import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { getPurchaseOrderDetailAction } from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderDetailPage } from "@/modules/procurement/components/purchase-order-detail-page"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type PurchaseOrderDetailRouteProps = {
  params: Promise<{ companyId: string; purchaseOrderId: string }>
}

export default async function PurchaseOrderDetailRoute({ params }: PurchaseOrderDetailRouteProps) {
  const { companyId, purchaseOrderId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_orders.manage")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const [detail, companyProfile] = await Promise.all([
    getPurchaseOrderDetailAction({
      companyId: context.companyId,
      purchaseOrderId,
    }),
    db.company.findUnique({
      where: {
        id: context.companyId,
      },
      select: {
        tinNumber: true,
        addresses: {
          where: {
            isActive: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            street: true,
            barangay: true,
            city: true,
            municipality: true,
            province: true,
            region: true,
            postalCode: true,
            country: true,
          },
          take: 1,
        },
      },
    }),
  ])

  if (!detail.ok) {
    redirect(`/${context.companyId}/employee-portal/purchase-orders`)
  }

  const primaryAddress = companyProfile?.addresses[0]
  const companyAddress = primaryAddress
    ? [
        primaryAddress.street,
        primaryAddress.barangay,
        primaryAddress.city ?? primaryAddress.municipality,
        primaryAddress.province,
        primaryAddress.region,
        primaryAddress.postalCode,
        primaryAddress.country,
      ]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join(", ")
    : null

  return (
    <PurchaseOrderDetailPage
      companyId={context.companyId}
      companyName={context.companyName}
      companyAddress={companyAddress}
      companyTinNumber={companyProfile?.tinNumber ?? null}
      detail={detail.data}
    />
  )
}
