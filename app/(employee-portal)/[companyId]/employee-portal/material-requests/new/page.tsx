import { redirect } from "next/navigation"

import { MaterialRequestDraftFormClient } from "@/modules/material-requests/components/material-request-draft-form-client"
import {
  getEmployeePortalMaterialRequestFormOptions,
  getEmployeePortalMaterialRequestNumberPreview,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type NewMaterialRequestPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function NewMaterialRequestPage({ params }: NewMaterialRequestPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  const [formOptions, requestNumberPreviewBySeries] = await Promise.all([
    getEmployeePortalMaterialRequestFormOptions({
      companyId: context.companyId,
    }),
    getEmployeePortalMaterialRequestNumberPreview({
      companyId: context.companyId,
    }),
  ])

  return (
    <MaterialRequestDraftFormClient
      companyId={context.companyId}
      departments={formOptions.departments}
      departmentFlowPreviews={formOptions.departmentFlowPreviews}
      requestNumberPreviewBySeries={requestNumberPreviewBySeries}
    />
  )
}
