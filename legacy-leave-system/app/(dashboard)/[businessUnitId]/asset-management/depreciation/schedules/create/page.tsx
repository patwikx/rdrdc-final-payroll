import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CreateDepreciationScheduleView } from "@/components/asset-management/create-depreciation-schedule-view"
import { getScheduleCategories } from "@/lib/actions/depreciation-schedule-actions"

interface CreateDepreciationSchedulePageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function CreateDepreciationSchedulePage({ 
  params 
}: CreateDepreciationSchedulePageProps) {
  const session = await auth()
    const { businessUnitId } = await params
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

    // Get categories for the form
    const categories = await getScheduleCategories(businessUnitId)
    
    return (
      <div className="space-y-6">
        <CreateDepreciationScheduleView 
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          categories={categories}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading create schedule page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Depreciation Schedule</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load the form. Please try again later.</p>
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