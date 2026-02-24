import { redirect } from "next/navigation"

import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { LeaveApprovalHistoryDetailPage } from "@/modules/leave/components/leave-approval-history-detail-page"
import { getEmployeePortalLeaveApprovalHistoryDetailReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"
import { getMaterialRequestApprovalHistoryDetailsAction } from "@/modules/material-requests/actions/material-request-approval-actions"
import { MaterialRequestApprovalHistoryDetailPage } from "@/modules/material-requests/components/material-request-approval-history-detail-page"
import { OvertimeApprovalHistoryDetailPage } from "@/modules/overtime/components/overtime-approval-history-detail-page"
import { getEmployeePortalOvertimeApprovalHistoryDetailReadModel } from "@/modules/overtime/utils/overtime-domain"

type ApprovalTypeParam = "leave" | "overtime" | "material"

type ApprovalHistoryRequestDetailPageProps = {
  params: Promise<{
    companyId: string
    approvalType: string
    requestId: string
  }>
}

const parseApprovalType = (value: string): ApprovalTypeParam | null => {
  const normalized = value.toLowerCase()
  if (normalized === "leave" || normalized === "overtime" || normalized === "material") {
    return normalized
  }

  return null
}

export default async function ApprovalHistoryRequestDetailPage({
  params,
}: ApprovalHistoryRequestDetailPageProps) {
  const { companyId, approvalType: approvalTypeRaw, requestId } = await params
  const approvalType = parseApprovalType(approvalTypeRaw)
  if (!approvalType) {
    redirect(`/${companyId}/employee-portal/approval-history`)
  }

  const context = await getEmployeePortalContext(companyId)
  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canApprove = isHR || context.isRequestApprover

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  if (approvalType === "material") {
    const materialHistoryResponse = await getMaterialRequestApprovalHistoryDetailsAction({
      companyId: context.companyId,
      requestId,
    })

    if (!materialHistoryResponse.ok) {
      redirect(`/${context.companyId}/employee-portal/approval-history`)
    }

    return (
      <MaterialRequestApprovalHistoryDetailPage
        companyId={context.companyId}
        companyName={context.companyName}
        requestId={requestId}
        detail={materialHistoryResponse.data}
      />
    )
  }

  if (approvalType === "leave") {
    const leaveDetail = await getEmployeePortalLeaveApprovalHistoryDetailReadModel({
      companyId: context.companyId,
      isHR,
      approverUserId: context.userId,
      requestId,
    })

    if (!leaveDetail) {
      redirect(`/${context.companyId}/employee-portal/approval-history`)
    }

    return (
      <LeaveApprovalHistoryDetailPage
        companyId={context.companyId}
        requestId={requestId}
        detail={leaveDetail}
      />
    )
  }

  const overtimeDetail = await getEmployeePortalOvertimeApprovalHistoryDetailReadModel({
    companyId: context.companyId,
    isHR,
    approverUserId: context.userId,
    requestId,
  })

  if (!overtimeDetail) {
    redirect(`/${context.companyId}/employee-portal/approval-history`)
  }

  return (
    <OvertimeApprovalHistoryDetailPage
      companyId={context.companyId}
      requestId={requestId}
      detail={overtimeDetail}
    />
  )
}
