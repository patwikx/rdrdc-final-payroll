import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { getMaterialRequestById } from "@/lib/actions/mrs-actions/material-request-actions"
import { AcknowledgementDocument } from "@/components/material-requests/acknowledgement-document"
import { Skeleton } from "@/components/ui/skeleton"

interface AcknowledgementPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function AcknowledgementPage({ params }: AcknowledgementPageProps) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/sign-in")
  }

  // Allow all authenticated users to create acknowledgements
  const { id } = await params

  return (
    <div className="flex-1">
      <Suspense fallback={<AcknowledgementSkeleton />}>
        <AcknowledgementContent requestId={id} userId={session.user.id} userRole={session.user.role} />
      </Suspense>
    </div>
  )
}

async function AcknowledgementContent({ requestId, userId, userRole }: { requestId: string; userId: string; userRole: string }) {
  const materialRequest = await getMaterialRequestById(requestId)
  
  if (!materialRequest) {
    notFound()
  }

  // Transform the material request to match the expected interface
  const transformedRequest = {
    ...materialRequest,
    department: materialRequest.department ? {
      name: materialRequest.department.name,
      code: materialRequest.department.code || ""
    } : null
  }

  return <AcknowledgementDocument materialRequest={transformedRequest} userRole={userRole} />
}

function AcknowledgementSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4 border-b pb-6">
        <Skeleton className="h-8 w-[400px] mx-auto" />
        <Skeleton className="h-6 w-[300px] mx-auto" />
        <Skeleton className="h-4 w-[200px] mx-auto" />
      </div>

      {/* Document Info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-[200px]" />
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-muted/50">
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="grid grid-cols-5 gap-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Area */}
      <div className="grid grid-cols-2 gap-8 pt-8">
        <div className="space-y-4">
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-32 w-full border-2 border-dashed" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    </div>
  )
}