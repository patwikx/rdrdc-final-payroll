import { redirect } from "next/navigation"

import { MaterialRequestDraftFormClient } from "@/modules/material-requests/components/material-request-draft-form-client"
import {
  getEmployeePortalMaterialRequestFormOptions,
  getEmployeePortalMaterialRequestNumberPreview,
  getEmployeePortalMaterialRequestsReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type EditMaterialRequestPageProps = {
  params: Promise<{ companyId: string; requestId: string }>
}

export default async function EditMaterialRequestPage({ params }: EditMaterialRequestPageProps) {
  const { companyId, requestId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  const [requests, formOptions, requestNumberPreviewBySeries] = await Promise.all([
    getEmployeePortalMaterialRequestsReadModel({
      companyId: context.companyId,
      userId: context.userId,
    }),
    getEmployeePortalMaterialRequestFormOptions({
      companyId: context.companyId,
    }),
    getEmployeePortalMaterialRequestNumberPreview({
      companyId: context.companyId,
    }),
  ])

  const request = requests.find((item) => item.id === requestId)

  if (!request || request.status !== "DRAFT") {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  return (
    <MaterialRequestDraftFormClient
      companyId={context.companyId}
      departments={formOptions.departments}
      departmentFlowPreviews={formOptions.departmentFlowPreviews}
      requestNumberPreviewBySeries={requestNumberPreviewBySeries}
      initialRequest={request}
    />
  )
}
