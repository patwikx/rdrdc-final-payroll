import { redirect } from "next/navigation"

import { MaterialRequestApprovalClient } from "@/modules/material-requests/components/material-request-approval-client"
import {
  getEmployeePortalMaterialRequestApprovalReadModel,
  getEmployeePortalMaterialRequestDepartmentOptions,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
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
  const approverCompanyIds = context.companies.map((company) => company.companyId)
  const hrApproverCompanyIds = context.companies
    .filter(
      (company) =>
        company.role === "COMPANY_ADMIN" || company.role === "HR_ADMIN" || company.role === "PAYROLL_ADMIN"
    )
    .map((company) => company.companyId)
  const canApprove = context.isRequestApprover || isHR

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const [approvalData, departmentOptions] = await Promise.all([
    getEmployeePortalMaterialRequestApprovalReadModel({
      companyIds: approverCompanyIds,
      approverUserId: context.userId,
      hrCompanyIds: hrApproverCompanyIds,
    }),
    getEmployeePortalMaterialRequestDepartmentOptions({
      companyIds: approverCompanyIds,
    }),
  ])

  return (
    <MaterialRequestApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      companyOptions={context.companies.map((company) => ({
        id: company.companyId,
        name: company.companyName,
      }))}
      departmentOptions={departmentOptions}
      rows={approvalData.rows}
      initialQueueTotal={approvalData.queueTotal}
      initialQueuePage={approvalData.queuePage}
      initialQueuePageSize={approvalData.queuePageSize}
      historyRows={approvalData.historyRows}
      initialHistoryTotal={approvalData.historyTotal}
      initialHistoryPage={approvalData.historyPage}
      initialHistoryPageSize={approvalData.historyPageSize}
      view="queue"
    />
  )
}
