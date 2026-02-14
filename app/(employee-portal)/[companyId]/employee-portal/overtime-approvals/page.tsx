import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import {
  OvertimeApprovalClient,
} from "@/modules/employee-portal/components/overtime-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getEmployeePortalOvertimeApprovalReadModel } from "@/modules/overtime/utils/overtime-domain"

type OvertimeApprovalsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function OvertimeApprovalsPage({ params }: OvertimeApprovalsPageProps) {
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

  const overtimeApprovalData = await getEmployeePortalOvertimeApprovalReadModel({
    companyId: context.companyId,
    isHR,
    approverEmployeeId: context.employee?.id,
  })

  return (
    <OvertimeApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      rows={overtimeApprovalData.rows}
      historyRows={overtimeApprovalData.historyRows}
      initialHistoryTotal={overtimeApprovalData.historyTotal}
      initialHistoryPage={overtimeApprovalData.historyPage}
      initialHistoryPageSize={overtimeApprovalData.historyPageSize}
    />
  )
}
