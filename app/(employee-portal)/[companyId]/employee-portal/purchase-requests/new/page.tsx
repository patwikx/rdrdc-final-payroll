import { redirect } from "next/navigation"

import { PurchaseRequestDraftFormClient } from "@/modules/procurement/components/purchase-request-draft-form-client"
import {
  getPurchaseRequestFormOptions,
  getPurchaseRequestNumberPreview,
} from "@/modules/procurement/utils/purchase-request-read-models"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"
import { hasEmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"

type NewPurchaseRequestPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function NewPurchaseRequestPage({ params }: NewPurchaseRequestPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_requests.view")) {
    redirect(`/${context.companyId}/employee-portal/material-requests`)
  }

  if (!hasEmployeePortalCapability(context.capabilities, "purchase_requests.create")) {
    redirect(`/${context.companyId}/employee-portal/purchase-requests`)
  }

  const [formOptions, requestNumberPreviewBySeries] = await Promise.all([
    getPurchaseRequestFormOptions({ companyId: context.companyId }),
    getPurchaseRequestNumberPreview({ companyId: context.companyId }),
  ])

  return (
    <PurchaseRequestDraftFormClient
      companyId={context.companyId}
      departments={formOptions.departments}
      departmentFlowPreviews={formOptions.departmentFlowPreviews}
      requestNumberPreviewBySeries={requestNumberPreviewBySeries}
      requesterBranchName={context.employee?.branch?.name ?? null}
    />
  )
}
