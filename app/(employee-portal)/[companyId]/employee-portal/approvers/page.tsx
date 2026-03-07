import { redirect } from "next/navigation"

import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type ApproversPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ApproversPage({ params }: ApproversPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const canManageApprovers = hasEmployeePortalCapability(context.capabilities, "request_settings.manage")

  if (!canManageApprovers) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  redirect(`/${context.companyId}/dashboard/system/approvers`)
}
