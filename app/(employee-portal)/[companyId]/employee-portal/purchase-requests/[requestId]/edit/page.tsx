import { redirect } from "next/navigation"

import { PurchaseRequestDraftFormClient } from "@/modules/procurement/components/purchase-request-draft-form-client"
import {
  getPurchaseRequestFormOptions,
  getPurchaseRequestById,
  getPurchaseRequestNumberPreview,
} from "@/modules/procurement/utils/purchase-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type EditPurchaseRequestPageProps = {
  params: Promise<{ companyId: string; requestId: string }>
}

export default async function EditPurchaseRequestPage({ params }: EditPurchaseRequestPageProps) {
  const { companyId, requestId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_requests.create")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  const [request, formOptions, requestNumberPreviewBySeries] = await Promise.all([
    getPurchaseRequestById({
      companyId: context.companyId,
      requestId,
      actorUserId: context.userId,
    }),
    getPurchaseRequestFormOptions({ companyId: context.companyId }),
    getPurchaseRequestNumberPreview({
      companyId: context.companyId,
    }),
  ])

  if (!request || request.requesterUserId !== context.userId || request.status !== "DRAFT") {
    redirect(`/${context.companyId}/employee-portal/purchase-requests`)
  }

  return (
    <PurchaseRequestDraftFormClient
      companyId={context.companyId}
      departments={formOptions.departments}
      departmentFlowPreviews={formOptions.departmentFlowPreviews}
      requestNumberPreviewBySeries={requestNumberPreviewBySeries}
      requesterBranchName={context.requesterBranchName}
      initialRequest={request}
    />
  )
}
