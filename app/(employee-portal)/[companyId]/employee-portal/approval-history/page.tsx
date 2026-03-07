import { redirect } from "next/navigation"

import { ApprovalHistoryClient } from "@/modules/employee-portal/components/approval-history-client"
import { getEmployeePortalConsolidatedApprovalHistoryPageReadModel } from "@/modules/employee-portal/utils/approval-history-read-model"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import {
  hasEmployeePortalCapability,
  isEmployeePortalHrRole,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

type ApprovalHistoryPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ApprovalHistoryPage({ params }: ApprovalHistoryPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR = isEmployeePortalHrRole(context.companyRole)
  const canApprove = hasEmployeePortalCapability(context.capabilities, "approval_history.view")

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const initialHistoryPage = await getEmployeePortalConsolidatedApprovalHistoryPageReadModel({
    companyId: context.companyId,
    approverUserId: context.userId,
    isHR,
    page: 1,
    pageSize: 20,
    search: "",
    type: "ALL",
    status: "ALL",
  })

  return (
    <ApprovalHistoryClient
      companyId={context.companyId}
      initialRows={initialHistoryPage.rows}
      initialTotal={initialHistoryPage.total}
      initialPage={initialHistoryPage.page}
      initialPageSize={initialHistoryPage.pageSize}
      initialStats={initialHistoryPage.stats}
      initialStatusOptions={initialHistoryPage.statusOptions}
    />
  )
}
