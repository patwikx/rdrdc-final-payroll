import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { OvertimeRequestClient } from "@/modules/employee-portal/components/overtime-request-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type OvertimePageProps = {
  params: Promise<{ companyId: string }>
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

export default async function OvertimePage({ params }: OvertimePageProps) {
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

  const requests = await db.overtimeRequest.findMany({
    where: { employeeId: context.employee.id },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      requestNumber: true,
      overtimeDate: true,
      startTime: true,
      endTime: true,
      hours: true,
      reason: true,
      statusCode: true,
      supervisorApprovedAt: true,
      supervisorApprovalRemarks: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
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
    },
  })

  return (
    <OvertimeRequestClient
      companyId={context.companyId}
      requests={requests.map((item) => ({
        id: item.id,
        requestNumber: item.requestNumber,
        overtimeDate: dateLabel.format(item.overtimeDate),
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
        hours: Number(item.hours),
        reason: item.reason,
        statusCode: item.statusCode,
        supervisorApproverName: item.supervisorApprover ? `${item.supervisorApprover.firstName} ${item.supervisorApprover.lastName}` : null,
        supervisorApprovedAt: item.supervisorApprovedAt ? dateLabel.format(item.supervisorApprovedAt) : null,
        supervisorApprovalRemarks: item.supervisorApprovalRemarks,
        hrApproverName: item.hrApprover ? `${item.hrApprover.firstName} ${item.hrApprover.lastName}` : null,
        hrApprovedAt: item.hrApprovedAt ? dateLabel.format(item.hrApprovedAt) : null,
        hrApprovalRemarks: item.hrApprovalRemarks,
        hrRejectedAt: item.hrRejectedAt ? dateLabel.format(item.hrRejectedAt) : null,
        hrRejectionReason: item.hrRejectionReason,
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
