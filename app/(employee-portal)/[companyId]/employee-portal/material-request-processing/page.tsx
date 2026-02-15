import { redirect } from "next/navigation"

import { MaterialRequestProcessingClient } from "@/modules/material-requests/components/material-request-processing-client"
import { getEmployeePortalMaterialRequestProcessingPageReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestProcessingPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestProcessingPage({ params }: MaterialRequestProcessingPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canProcess = Boolean(context.employee?.user?.isMaterialRequestPurchaser) || isHR

  if (!canProcess) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const processingData = await getEmployeePortalMaterialRequestProcessingPageReadModel({
    companyId: context.companyId,
    page: 1,
    pageSize: 10,
    search: "",
    status: "OPEN",
  })

  return (
    <MaterialRequestProcessingClient
      companyId={context.companyId}
      companyName={context.companyName}
      isHR={isHR}
      initialRows={processingData.rows}
      initialTotal={processingData.total}
      initialPage={processingData.page}
      initialPageSize={processingData.pageSize}
    />
  )
}
