import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { ApprovalHistoryClient } from "@/modules/employee-portal/components/approval-history-client"
import { getEmployeePortalConsolidatedApprovalHistoryPageReadModel } from "@/modules/employee-portal/utils/approval-history-read-model"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type ApprovalHistoryPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ApprovalHistoryPage({ params }: ApprovalHistoryPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canApprove = isHR || Boolean(context.employee?.user?.isRequestApprover)

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

  const initialHistoryPage = await getEmployeePortalConsolidatedApprovalHistoryPageReadModel({
    companyId: context.companyId,
    approverUserId: context.userId,
    isHR,
    approverEmployeeId: context.employee?.id,
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
