import { redirect } from "next/navigation"

import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getMaterialRequestApprovalQueueDetailsAction } from "@/modules/material-requests/actions/material-request-approval-actions"
import { MaterialRequestApprovalHistoryDetailPage } from "@/modules/material-requests/components/material-request-approval-history-detail-page"

type MaterialRequestApprovalQueueDetailPageProps = {
  params: Promise<{
    companyId: string
    requestId: string
  }>
  searchParams: Promise<{
    requestCompanyId?: string | string[]
  }>
}

export default async function MaterialRequestApprovalQueueDetailPage({
  params,
  searchParams,
}: MaterialRequestApprovalQueueDetailPageProps) {
  const { companyId, requestId } = await params
  const resolvedSearchParams = await searchParams
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canApprove = context.isRequestApprover || isHR

  if (!canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const requestCompanyIdCandidate = Array.isArray(resolvedSearchParams.requestCompanyId)
    ? resolvedSearchParams.requestCompanyId[0]
    : resolvedSearchParams.requestCompanyId
  const accessibleCompanyIds = new Set(context.companies.map((company) => company.companyId))
  const targetRequestCompanyId =
    requestCompanyIdCandidate && accessibleCompanyIds.has(requestCompanyIdCandidate)
      ? requestCompanyIdCandidate
      : context.companyId

  const response = await getMaterialRequestApprovalQueueDetailsAction({
    companyId: targetRequestCompanyId,
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
      requestCompanyId={targetRequestCompanyId}
    />
  )
}
