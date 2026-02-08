import { redirect } from "next/navigation"

import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type ApproversPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ApproversPage({ params }: ApproversPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const canManageApprovers =
    context.companyRole === "COMPANY_ADMIN" || context.companyRole === "HR_ADMIN" || context.companyRole === "PAYROLL_ADMIN"

  if (!canManageApprovers) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  redirect(`/${context.companyId}/dashboard/system/approvers`)
}
