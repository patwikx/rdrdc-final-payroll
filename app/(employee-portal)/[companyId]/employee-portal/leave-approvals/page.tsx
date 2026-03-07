import { redirect } from "next/navigation"

import {
  LeaveApprovalClient,
} from "@/modules/employee-portal/components/leave-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import {
  hasEmployeePortalCapability,
  isEmployeePortalHrRole,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import {
  getEmployeePortalLeaveApprovalDepartmentOptions,
  getEmployeePortalLeaveApprovalReadModel,
} from "@/modules/leave/utils/employee-portal-leave-read-models"

type LeaveApprovalsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function LeaveApprovalsPage({ params }: LeaveApprovalsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR = isEmployeePortalHrRole(context.companyRole)
  const canApprove = hasEmployeePortalCapability(context.capabilities, "leave_approvals.view")
  const approverCompanyIds = context.companies.map((company) => company.companyId)
  const hrApproverCompanyIds = context.companies
    .filter(
      (company) =>
        company.role === "COMPANY_ADMIN" || company.role === "HR_ADMIN" || company.role === "PAYROLL_ADMIN"
    )
    .map((company) => company.companyId)
  const scopedApprovalCompanyIds = isHR ? hrApproverCompanyIds : approverCompanyIds

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const [leaveApprovalData, departmentOptions] = await Promise.all([
    getEmployeePortalLeaveApprovalReadModel({
      companyIds: scopedApprovalCompanyIds,
      isHR,
      approverUserId: context.userId,
    }),
    getEmployeePortalLeaveApprovalDepartmentOptions({
      companyIds: scopedApprovalCompanyIds,
    }),
  ])

  return (
    <LeaveApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      companyOptions={context.companies
        .filter((company) => scopedApprovalCompanyIds.includes(company.companyId))
        .map((company) => ({
          id: company.companyId,
          name: company.companyName,
        }))}
      departmentOptions={departmentOptions}
      rows={leaveApprovalData.rows}
      initialQueueTotal={leaveApprovalData.queueTotal}
      initialQueuePage={leaveApprovalData.queuePage}
      initialQueuePageSize={leaveApprovalData.queuePageSize}
      historyRows={leaveApprovalData.historyRows}
      initialHistoryTotal={leaveApprovalData.historyTotal}
      initialHistoryPage={leaveApprovalData.historyPage}
      initialHistoryPageSize={leaveApprovalData.historyPageSize}
      view="queue"
    />
  )
}
