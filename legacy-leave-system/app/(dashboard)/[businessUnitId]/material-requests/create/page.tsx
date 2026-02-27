import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { MaterialRequestCreateForm } from "@/components/material-requests/material-request-create-form"
import { Skeleton } from "@/components/ui/skeleton"

export default async function CreateRequestPage() {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/sign-in")
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Create Material Request</h2>
      </div>
      
      <Suspense fallback={<CreateRequestSkeleton />}>
        <MaterialRequestCreateForm />
      </Suspense>
    </div>
  )
}

function CreateRequestSkeleton() {
  return (
    <div className="w-full max-w-none px-2 sm:px-4 space-y-4 sm:space-y-6">
      {/* Header with Cancel and Create buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-[80px] rounded-full" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-10 w-full sm:w-[80px]" />
          <Skeleton className="h-10 w-full sm:w-[80px]" />
          <Skeleton className="h-10 w-full sm:w-[160px]" />
        </div>
      </div>

      {/* Basic Information Card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 pb-4">
          <Skeleton className="h-6 w-[140px] mb-4" />
        </div>
        <div className="px-6 pb-6 space-y-4">
          {/* First row of fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[60px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[40px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[90px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Second row of fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Third row - text areas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[60px]" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>

          {/* Remarks field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>

      {/* Items Card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-6 w-[60px]" />
            <Skeleton className="h-9 w-full sm:w-[120px]" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="w-12 h-12 rounded-full" />
              <Skeleton className="h-5 w-[140px]" />
              <Skeleton className="h-4 w-[180px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Totals Card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 pb-4">
          <Skeleton className="h-6 w-[60px] mb-4" />
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[50px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[60px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-[90px]" />
                <Skeleton className="h-6 w-[100px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}