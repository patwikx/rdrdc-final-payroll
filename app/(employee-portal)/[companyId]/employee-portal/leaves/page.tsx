import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { LeaveRequestClient } from "@/modules/employee-portal/components/leave-request-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getEmployeePortalLeaveRequestsReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"

type LeavesPageProps = {
  params: Promise<{ companyId: string }>
}

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

  const leaveData = await getEmployeePortalLeaveRequestsReadModel({
    companyId: context.companyId,
    employeeId: context.employee.id,
    year: new Date().getFullYear(),
  })

  return (
    <LeaveRequestClient
      companyId={context.companyId}
      leaveTypes={leaveData.leaveTypes}
      leaveBalances={leaveData.leaveBalances}
      requests={leaveData.requests}
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
