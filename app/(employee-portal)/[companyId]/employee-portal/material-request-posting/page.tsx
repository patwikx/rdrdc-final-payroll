import { redirect } from "next/navigation"

import { MaterialRequestPostingClient } from "@/modules/material-requests/components/material-request-posting-client"
import { getEmployeePortalMaterialRequestPostingPageReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type MaterialRequestPostingPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestPostingPage({ params }: MaterialRequestPostingPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR =
    context.companyRole === "COMPANY_ADMIN" ||
    context.companyRole === "HR_ADMIN" ||
    context.companyRole === "PAYROLL_ADMIN"
  const canPost = Boolean(context.employee?.user?.isMaterialRequestPoster) || isHR

  if (!canPost) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const postingData = await getEmployeePortalMaterialRequestPostingPageReadModel({
    companyId: context.companyId,
    page: 1,
    pageSize: 10,
    search: "",
    status: "ALL",
  })

  return (
    <MaterialRequestPostingClient
      companyId={context.companyId}
      initialRows={postingData.rows}
      initialTotal={postingData.total}
      initialPage={postingData.page}
      initialPageSize={postingData.pageSize}
    />
  )
}
