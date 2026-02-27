import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getApprovedRequestsForAcknowledgement } from "@/lib/actions/mrs-actions/material-request-actions"
import { AcknowledgementRequestsClient } from "@/components/mrs-coordinator/acknowledgement-requests-client"
import { Skeleton } from "@/components/ui/skeleton"

interface AcknowledgementPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function AcknowledgementPage({ params }: AcknowledgementPageProps) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/sign-in")
  }

  const { businessUnitId } = await params
 
  // Check if user can create acknowledgements (ADMIN or users with isPurchaser permission)
  if (session.user.role !== "ADMIN" && !session.user.isPurchaser) {
    redirect(`/${businessUnitId}/unauthorized`)
  }

  return (
    <Suspense fallback={<AcknowledgementSkeleton />}>
      <AcknowledgementContent userRole={session.user.role} businessUnitId={businessUnitId} />
    </Suspense>
  )
}

async function AcknowledgementContent({ userRole, businessUnitId }: { userRole: string; businessUnitId: string }) {
  const requests = await getApprovedRequestsForAcknowledgement({ businessUnitId })
  
  return <AcknowledgementRequestsClient initialRequests={requests} userRole={userRole} businessUnitId={businessUnitId} />
}

function AcknowledgementSkeleton() {
  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-4 w-[400px]" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-[200px]" />
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-[200px]" />
      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
              <Skeleton className="h-6 w-[80px]" />
            </div>
            
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-[80px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              ))}
            </div>
            
            <div className="bg-muted/30 rounded-md p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[80px]" />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}