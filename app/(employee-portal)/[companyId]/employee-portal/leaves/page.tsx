import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { LeaveRequestClient } from "@/modules/employee-portal/components/leave-request-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type LeavesPageProps = {
  params: Promise<{ companyId: string }>
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

export default async function LeavesPage({ params }: LeavesPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  if (!context.employee) {
    return <EmptyEmployeeState />
  }

  const [leaveRequests, leaveBalances, leaveTypes] = await Promise.all([
    db.leaveRequest.findMany({
      where: { employeeId: context.employee.id },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        requestNumber: true,
        isHalfDay: true,
        halfDayPeriod: true,
        startDate: true,
        endDate: true,
        numberOfDays: true,
        reason: true,
        statusCode: true,
        submittedAt: true,
        supervisorApprovedAt: true,
        supervisorApprovalRemarks: true,
        hrApprovedAt: true,
        hrApprovalRemarks: true,
        hrRejectedAt: true,
        hrRejectionReason: true,
        approver: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        supervisorApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        hrApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        rejectionReason: true,
        leaveType: { select: { name: true } },
      },
    }),
    db.leaveBalance.findMany({
      where: {
        employeeId: context.employee.id,
        year: new Date().getFullYear(),
      },
      orderBy: { leaveType: { name: "asc" } },
      select: {
        id: true,
        leaveTypeId: true,
        currentBalance: true,
        availableBalance: true,
        creditsEarned: true,
        creditsUsed: true,
        leaveType: { select: { name: true } },
      },
    }),
    db.leaveType.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      orderBy: [{ companyId: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isPaid: true,
        requiresApproval: true,
      },
    }),
  ])

  return (
    <LeaveRequestClient
      companyId={context.companyId}
      leaveTypes={leaveTypes.map((item) => ({ id: item.id, code: item.code, name: item.name, isPaid: item.isPaid, requiresApproval: item.requiresApproval }))}
      leaveBalances={leaveBalances.map((item) => ({
        id: item.id,
        leaveTypeId: item.leaveTypeId,
        leaveTypeName: item.leaveType.name,
        currentBalance: Number(item.currentBalance),
        availableBalance: Number(item.availableBalance),
        creditsEarned: Number(item.creditsEarned),
        creditsUsed: Number(item.creditsUsed),
      }))}
      requests={leaveRequests.map((item) => ({
        id: item.id,
        requestNumber: item.requestNumber,
        isHalfDay: item.isHalfDay,
        halfDayPeriod: item.halfDayPeriod,
        startDate: dateLabel.format(item.startDate),
        endDate: dateLabel.format(item.endDate),
        numberOfDays: Number(item.numberOfDays),
        reason: item.reason,
        statusCode: item.statusCode,
        leaveTypeName: item.leaveType.name,
        supervisorApproverName: item.supervisorApprover ? `${item.supervisorApprover.firstName} ${item.supervisorApprover.lastName}` : null,
        supervisorApprovedAt: item.supervisorApprovedAt ? dateLabel.format(item.supervisorApprovedAt) : null,
        supervisorApprovalRemarks: item.supervisorApprovalRemarks,
        hrApproverName: item.hrApprover ? `${item.hrApprover.firstName} ${item.hrApprover.lastName}` : null,
        hrApprovedAt: item.hrApprovedAt ? dateLabel.format(item.hrApprovedAt) : null,
        hrApprovalRemarks: item.hrApprovalRemarks,
        hrRejectedAt: item.hrRejectedAt ? dateLabel.format(item.hrRejectedAt) : null,
        hrRejectionReason: item.hrRejectionReason,
        approverName: item.approver ? `${item.approver.firstName} ${item.approver.lastName}` : null,
        rejectionReason: item.rejectionReason,
      }))}
    />
  )
}

function EmptyEmployeeState() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        Your account is not linked to an employee profile for this company yet.
      </CardContent>
    </Card>
  )
}
