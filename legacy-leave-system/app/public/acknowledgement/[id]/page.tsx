import { notFound } from "next/navigation"
import { getMaterialRequestById } from "@/lib/actions/mrs-actions/material-request-actions"
import { AcknowledgementDocument } from "@/components/material-requests/acknowledgement-document"

interface PublicAcknowledgementPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function PublicAcknowledgementPage({
  params,
}: PublicAcknowledgementPageProps) {
  const { id } = await params
  const materialRequest = await getMaterialRequestById(id)

  if (!materialRequest) {
    notFound()
  }

  // Only allow acknowledgement for POSTED status requests
  if (materialRequest.status !== "POSTED") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Request</h1>
          <p className="text-muted-foreground">
            This material request is not available for acknowledgement.
          </p>
        </div>
      </div>
    )
  }

  // Transform the data to match the expected type
  const transformedRequest = {
    ...materialRequest,
    department: materialRequest.department ? {
      name: materialRequest.department.name,
      code: materialRequest.department.code || ''
    } : null
  }

  // If already acknowledged, show read-only view
  if (materialRequest.acknowledgedAt) {
    return (
      <div className="min-h-screen bg-muted/30 py-8">
        <AcknowledgementDocument 
          materialRequest={transformedRequest}
          userRole="PUBLIC"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <AcknowledgementDocument 
        materialRequest={transformedRequest}
        userRole="PUBLIC"
      />
    </div>
  )
}
