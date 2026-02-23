import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getMaterialRequestApprovalQueueDetailsAction } from "@/modules/material-requests/actions/material-request-approval-actions"
import { MaterialRequestApprovalHistoryDetailPage } from "@/modules/material-requests/components/material-request-approval-history-detail-page"

type MaterialRequestApprovalQueueDetailPageProps = {
  params: Promise<{
    companyId: string
    requestId: string
  }>
}

export default async function MaterialRequestApprovalQueueDetailPage({
  params,
}: MaterialRequestApprovalQueueDetailPageProps) {
  const { companyId, requestId } = await params
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

  if (!isHR && !context.employee) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Your user account is not linked to an employee record. Please contact HR to link your account.
        </CardContent>
      </Card>
    )
  }

  const response = await getMaterialRequestApprovalQueueDetailsAction({
    companyId: context.companyId,
    requestId,
  })

  if (!response.ok) {
    redirect(`/${context.companyId}/employee-portal/material-request-approvals`)
  }

  return (
    <MaterialRequestApprovalHistoryDetailPage
      companyId={context.companyId}
      companyName={context.companyName}
      requestId={requestId}
      detail={response.data}
      pageTitle="Material Request Approval Detail"
      primaryBackHref={`/${context.companyId}/employee-portal/material-request-approvals`}
      primaryBackLabel="Back to Queue"
      secondaryBackHref={`/${context.companyId}/employee-portal/approval-history`}
      secondaryBackLabel="Open Approval History"
      showDecisionActions
    />
  )
}
