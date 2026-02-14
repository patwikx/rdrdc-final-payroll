import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import {
  LeaveApprovalClient,
} from "@/modules/employee-portal/components/leave-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getEmployeePortalLeaveApprovalReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"

type LeaveApprovalsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function LeaveApprovalsPage({ params }: LeaveApprovalsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR = context.companyRole === "COMPANY_ADMIN" || context.companyRole === "HR_ADMIN" || context.companyRole === "PAYROLL_ADMIN"
  const canApprove = Boolean(context.employee?.user?.isRequestApprover)

  if (!isHR && !canApprove) {
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

  const leaveApprovalData = await getEmployeePortalLeaveApprovalReadModel({
    companyId: context.companyId,
    isHR,
    approverEmployeeId: context.employee?.id,
  })

  return (
    <LeaveApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      rows={leaveApprovalData.rows}
      historyRows={leaveApprovalData.historyRows}
      initialHistoryTotal={leaveApprovalData.historyTotal}
      initialHistoryPage={leaveApprovalData.historyPage}
      initialHistoryPageSize={leaveApprovalData.historyPageSize}
    />
  )
}
