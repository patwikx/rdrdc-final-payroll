import { redirect } from "next/navigation"

import { getProcurementItemCatalogAction } from "@/modules/procurement/actions/procurement-item-catalog-actions"
import { ProcurementItemCatalogSettingsPage } from "@/modules/procurement/components/procurement-item-catalog-settings-page"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type ProcurementItemCatalogPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ProcurementItemCatalogPage({ params }: ProcurementItemCatalogPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "procurement_item_catalog.manage")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const data = await getProcurementItemCatalogAction({
    companyId: context.companyId,
    includeInactive: true,
  })

  if (!data.ok) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Item Catalog Access Restricted</h1>
        <p className="text-sm text-muted-foreground">{data.error}</p>
      </main>
    )
  }

  return <ProcurementItemCatalogSettingsPage companyId={context.companyId} data={data.data} />
}
