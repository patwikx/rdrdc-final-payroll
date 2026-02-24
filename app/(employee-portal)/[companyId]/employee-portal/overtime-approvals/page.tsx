import { redirect } from "next/navigation"

import {
  OvertimeApprovalClient,
} from "@/modules/employee-portal/components/overtime-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import {
  getEmployeePortalOvertimeApprovalDepartmentOptions,
  getEmployeePortalOvertimeApprovalReadModel,
} from "@/modules/overtime/utils/overtime-domain"

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
  const canApprove = context.isRequestApprover || isHR
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

  const [overtimeApprovalData, departmentOptions] = await Promise.all([
    getEmployeePortalOvertimeApprovalReadModel({
      companyIds: scopedApprovalCompanyIds,
      isHR,
      approverUserId: context.userId,
    }),
    getEmployeePortalOvertimeApprovalDepartmentOptions({
      companyIds: scopedApprovalCompanyIds,
    }),
  ])

  return (
    <OvertimeApprovalClient
      companyId={context.companyId}
      isHR={isHR}
      companyOptions={context.companies
        .filter((company) => scopedApprovalCompanyIds.includes(company.companyId))
        .map((company) => ({
          id: company.companyId,
          name: company.companyName,
        }))}
      departmentOptions={departmentOptions}
      rows={overtimeApprovalData.rows}
      initialQueueTotal={overtimeApprovalData.queueTotal}
      initialQueuePage={overtimeApprovalData.queuePage}
      initialQueuePageSize={overtimeApprovalData.queuePageSize}
      historyRows={overtimeApprovalData.historyRows}
      initialHistoryTotal={overtimeApprovalData.historyTotal}
      initialHistoryPage={overtimeApprovalData.historyPage}
      initialHistoryPageSize={overtimeApprovalData.historyPageSize}
      view="queue"
    />
  )
}
