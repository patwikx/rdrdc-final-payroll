import { redirect } from "next/navigation"

import { MaterialRequestClient } from "@/modules/material-requests/components/material-request-client"
import { getEmployeePortalMaterialRequestsReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestsPage({ params }: MaterialRequestsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  const requests = await getEmployeePortalMaterialRequestsReadModel({
    companyId: context.companyId,
    userId: context.userId,
  })

  return (
    <MaterialRequestClient
      companyId={context.companyId}
      requests={requests}
    />
  )
}
