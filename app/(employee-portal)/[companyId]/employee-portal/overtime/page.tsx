import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { OvertimeRequestClient } from "@/modules/employee-portal/components/overtime-request-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { getEmployeePortalOvertimeRequestsReadModel } from "@/modules/overtime/utils/overtime-domain"

type OvertimePageProps = {
  params: Promise<{ companyId: string }>
}

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

  const requests = await getEmployeePortalOvertimeRequestsReadModel({
    employeeId: context.employee.id,
  })

  return (
    <OvertimeRequestClient
      companyId={context.companyId}
      requests={requests}
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
