import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { getMaterialRequestById } from "@/lib/actions/mrs-actions/material-request-actions"
import { PostedRequestDetailPage } from "@/components/mrs-coordinator/posted-request-detail-page"
import { Skeleton } from "@/components/ui/skeleton"

interface PostedRequestDetailProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function PostedRequestDetail({ params }: PostedRequestDetailProps) {
  const session = await auth()
  
  const { businessUnitId, id } = await params
  if (!session) {
    redirect("/auth/sign-in")
  }

  // Check if user can view posted requests (ADMIN or users with isAcctg permission)
  if (session.user.role !== "ADMIN" && !session.user.isAcctg) {
    redirect(`/${businessUnitId}/unauthorized`)
  }


  return (
    <div className="flex-1 space-y-4">
      <Suspense fallback={<PostedRequestDetailSkeleton />}>
        <PostedRequestDetailContent 
          requestId={id} 
          userRole={session.user.role} 
          businessUnitId={businessUnitId} 
        />
      </Suspense>
    </div>
  )
}

async function PostedRequestDetailContent({ 
  requestId, 
  userRole, 
  businessUnitId 
}: { 
  requestId: string
  userRole: string
  businessUnitId: string 
}) {
  const request = await getMaterialRequestById(requestId)
  
  if (!request) {
    notFound()
  }

  // Ensure this is a posted request
  if (request.status !== "POSTED") {
    redirect(`/${businessUnitId}/mrs-coordinator/posted`)
  }
  
  return (
    <PostedRequestDetailPage 
      request={request} 
      userRole={userRole} 
      businessUnitId={businessUnitId} 
    />
  )
}

function PostedRequestDetailSkeleton() {
  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[300px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
      </div>

      {/* Request Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
      </div>

      {/* Items Table */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-[200px]" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  )
}