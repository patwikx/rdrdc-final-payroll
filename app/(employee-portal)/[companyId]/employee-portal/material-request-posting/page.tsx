import { redirect } from "next/navigation"

import { MaterialRequestPostingClient } from "@/modules/material-requests/components/material-request-posting-client"
import {
  getEmployeePortalMaterialRequestDepartmentOptions,
  getEmployeePortalMaterialRequestPostingPageReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type MaterialRequestPostingPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function MaterialRequestPostingPage({ params }: MaterialRequestPostingPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const canPost = hasEmployeePortalCapability(context.capabilities, "material_requests.posting.manage")

  if (!canPost) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  const [postingData, departmentOptions] = await Promise.all([
    getEmployeePortalMaterialRequestPostingPageReadModel({
      companyId: context.companyId,
      page: 1,
      pageSize: 10,
      search: "",
      status: "ALL",
    }),
    getEmployeePortalMaterialRequestDepartmentOptions({
      companyId: context.companyId,
    }),
  ])

  return (
    <MaterialRequestPostingClient
      companyId={context.companyId}
      departmentOptions={departmentOptions}
      initialRows={postingData.rows}
      initialTotal={postingData.total}
      initialPage={postingData.page}
      initialPageSize={postingData.pageSize}
    />
  )
}
