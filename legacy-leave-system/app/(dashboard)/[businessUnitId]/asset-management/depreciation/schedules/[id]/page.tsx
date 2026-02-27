import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DepreciationScheduleDetailView } from "@/components/asset-management/depreciation-schedule-detail-view"
import { getScheduleDetails, getScheduleCategories } from "@/lib/actions/depreciation-schedule-actions"

interface DepreciationScheduleDetailPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function DepreciationScheduleDetailPage({ 
  params 
}: DepreciationScheduleDetailPageProps) {
  const session = await auth()
    const { businessUnitId, id } = await params
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
 // Check if user has asset management permissions (ADMIN, MANAGER, HR, or users with accounting access)
  const hasAccess = ["ADMIN", "MANAGER", "HR"].includes(session.user.role) || session.user.isAcctg
  
  if (!hasAccess) {
    redirect(`/${businessUnitId}/unauthorized`)
  }


  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get schedule details and categories
    const [scheduleDetails, categories] = await Promise.all([
      getScheduleDetails(id, businessUnitId),
      getScheduleCategories(businessUnitId)
    ])
    
    if (!scheduleDetails) {
      notFound()
    }
    
    return (
      <div className="space-y-6">
        <DepreciationScheduleDetailView 
          scheduleDetails={scheduleDetails}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          categories={categories}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading schedule details:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Schedule Details</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load schedule details. Please try again later.</p>
        </div>
      </div>
    )
  }
}

async function getBusinessUnit(businessUnitId: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    return await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: {
        id: true,
        name: true,
        code: true
      }
    })
  } catch (error) {
    console.error("Error fetching business unit:", error)
    return null
  }
}