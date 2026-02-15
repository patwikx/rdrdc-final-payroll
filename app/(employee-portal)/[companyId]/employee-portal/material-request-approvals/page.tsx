import { redirect } from "next/navigation"

import { MaterialRequestApprovalClient } from "@/modules/material-requests/components/material-request-approval-client"
import { getEmployeePortalMaterialRequestApprovalReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestApprovalsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestApprovalsPage({ params }: MaterialRequestApprovalsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canApprove = Boolean(context.employee?.user?.isRequestApprover) || isHR

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const approvalData = await getEmployeePortalMaterialRequestApprovalReadModel({
    companyId: context.companyId,
    approverUserId: context.userId,
    isHR,
  })

  return (
    <MaterialRequestApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      rows={approvalData.rows}
      historyRows={approvalData.historyRows}
      initialHistoryTotal={approvalData.historyTotal}
      initialHistoryPage={approvalData.historyPage}
      initialHistoryPageSize={approvalData.historyPageSize}
    />
  )
}
