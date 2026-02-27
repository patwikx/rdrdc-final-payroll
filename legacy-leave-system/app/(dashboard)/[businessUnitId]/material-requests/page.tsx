import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getMaterialRequests } from "@/lib/actions/mrs-actions/material-request-actions"
import { MaterialRequestsClient } from "@/components/material-requests/material-requests-client"
import { Skeleton } from "@/components/ui/skeleton"

interface MaterialRequestsPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function MaterialRequestsPage({ params }: MaterialRequestsPageProps) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/sign-in")
  }

  const { businessUnitId } = await params

  return (
    <div className="flex-1 space-y-4">
      <Suspense fallback={<MaterialRequestsSkeleton />}>
        <MaterialRequestsContent businessUnitId={businessUnitId} />
      </Suspense>
    </div>
  )
}

async function MaterialRequestsContent({ businessUnitId }: { businessUnitId: string }) {
  const session = await auth()
  
  // Filter material requests by business unit ID and current user
  const requests = await getMaterialRequests({
    businessUnitId: businessUnitId,
    requestedById: session?.user?.id
  })
  
  return <MaterialRequestsClient initialRequests={requests} />
}

function MaterialRequestsSkeleton() {
  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-[150px]" />
        <Skeleton className="h-10 w-full sm:w-[120px]" />
        <Skeleton className="h-10 w-full sm:w-[100px]" />
        <Skeleton className="h-10 w-full sm:w-[140px]" />
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-[200px]" />

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <div className="p-0">
          {/* Table header */}
          <div className="border-b bg-muted/50 px-4 py-3">
            <div className="grid grid-cols-9 gap-4">
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[60px]" />
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-[140px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[70px]" />
            </div>
          </div>
          
          {/* Table rows */}
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="grid grid-cols-9 gap-4 items-center">
                  <Skeleton className="h-4 w-[90px]" />
                  <Skeleton className="h-6 w-[50px] rounded-full" />
                  <Skeleton className="h-6 w-[60px] rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-3 w-[140px]" />
                  </div>
                  <Skeleton className="h-4 w-[160px]" />
                  <Skeleton className="h-4 w-[140px]" />
                  <Skeleton className="h-4 w-[90px]" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[70px]" />
                    <Skeleton className="h-3 w-[50px]" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
              <Skeleton className="h-6 w-[80px] rounded-full" />
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-8 w-[70px]" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-[100px]" />
          <div className="flex items-center space-x-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  )
}