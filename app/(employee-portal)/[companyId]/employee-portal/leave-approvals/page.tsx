import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import {
  LeaveApprovalClient,
  type LeaveApprovalHistoryRow,
  type LeaveApprovalRow,
} from "@/modules/employee-portal/components/leave-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

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

  const [requests, historyRequests] = await Promise.all([
    db.leaveRequest.findMany({
      where: isHR
        ? {
            statusCode: "SUPERVISOR_APPROVED",
            employee: { companyId: context.companyId },
          }
        : {
            statusCode: "PENDING",
            supervisorApproverId: context.employee!.id,
            employee: { companyId: context.companyId },
          },
      orderBy: isHR ? [{ supervisorApprovedAt: "asc" }, { submittedAt: "asc" }] : [{ submittedAt: "asc" }, { createdAt: "asc" }],
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
      take: 100,
    }),
    db.leaveRequest.findMany({
      where: isHR
        ? {
            employee: { companyId: context.companyId },
            statusCode: { in: ["APPROVED", "REJECTED"] },
            ...(context.employee ? { hrApproverId: context.employee.id } : {}),
          }
        : {
            employee: { companyId: context.companyId },
            supervisorApproverId: context.employee!.id,
            statusCode: { in: ["SUPERVISOR_APPROVED", "APPROVED", "REJECTED"] },
          },
      orderBy: isHR ? [{ hrApprovedAt: "desc" }, { hrRejectedAt: "desc" }] : [{ updatedAt: "desc" }],
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        leaveType: {
          select: {
            name: true,
          },
        },
      },
      take: 300,
    }),
  ])

  const rows: LeaveApprovalRow[] = requests.map((item) => ({
    id: item.id,
    requestNumber: item.requestNumber,
    startDate: new Date(item.startDate).toLocaleDateString("en-PH"),
    endDate: new Date(item.endDate).toLocaleDateString("en-PH"),
    numberOfDays: Number(item.numberOfDays),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    leaveTypeName: item.leaveType.name,
  }))

  const historyRows: LeaveApprovalHistoryRow[] = historyRequests.map((item) => {
    const decidedAt = isHR
      ? item.hrApprovedAt ?? item.hrRejectedAt ?? item.approvedAt ?? item.rejectedAt ?? item.updatedAt
      : item.supervisorApprovedAt ?? item.rejectedAt ?? item.updatedAt
    return {
      id: item.id,
      requestNumber: item.requestNumber,
      startDate: new Date(item.startDate).toLocaleDateString("en-PH"),
      endDate: new Date(item.endDate).toLocaleDateString("en-PH"),
      numberOfDays: Number(item.numberOfDays),
      reason: item.reason,
      statusCode: item.statusCode,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
      employeeNumber: item.employee.employeeNumber,
      leaveTypeName: item.leaveType.name,
      decidedAtIso: decidedAt.toISOString(),
      decidedAtLabel: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }).format(decidedAt),
    }
  })

  return <LeaveApprovalClient companyId={context.companyId} isHR={isHR} rows={rows} historyRows={historyRows} />
}
