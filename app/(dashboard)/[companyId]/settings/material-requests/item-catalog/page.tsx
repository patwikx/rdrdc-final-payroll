import { redirect } from "next/navigation"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

type ItemCatalogSettingsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ItemCatalogSettingsPage({ params }: ItemCatalogSettingsPageProps) {
  const { companyId } = await params
  const context = await getActiveCompanyContext({ companyId })
  redirect(`/${context.companyId}/employee-portal/procurement-item-catalog`)
}
