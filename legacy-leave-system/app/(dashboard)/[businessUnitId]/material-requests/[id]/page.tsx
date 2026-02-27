import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { getMaterialRequestById } from "@/lib/actions/mrs-actions/material-request-actions"
import { MaterialRequestDetailPage } from "@/components/material-requests/material-request-detail-page"

interface MaterialRequestDetailPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function MaterialRequestDetail({
  params,
}: MaterialRequestDetailPageProps) {
  const session = await auth()
  const { businessUnitId, id } = await params
  const materialRequest = await getMaterialRequestById(id)

  if (!materialRequest) {
    notFound()
  }

  // Ensure the material request belongs to the current business unit
  if (materialRequest.businessUnitId !== businessUnitId) {
    notFound()
  }

  return (
    <MaterialRequestDetailPage 
      materialRequest={materialRequest}
      businessUnitId={businessUnitId}
      currentUserId={session?.user?.id || ""}
      isPurchaser={session?.user?.isPurchaser || false}
    />
  )
}