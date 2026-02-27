import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AssetStatus } from "@prisma/client"
import { getAssets } from "@/lib/actions/asset-management-actions"
import { AssetDeploymentView } from "@/components/asset-management/asset-deployment-view"

interface AssetDeploymentPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    categoryId?: string
    search?: string
    page?: string
  }>
}

export default async function AssetDeploymentPage({ params, searchParams }: AssetDeploymentPageProps) {
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

  const { categoryId, search, page = "1" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get available assets for deployment (only ACTIVE and not currently deployed)
    const assetsData = await getAssets({
      businessUnitId,
      categoryId,
      search,
      page: parseInt(page),
      limit: 100,
      isActive: true,
      status: AssetStatus.AVAILABLE // Only AVAILABLE assets can be deployed
    })

    // Filter out assets that are already deployed
    const availableAssets = {
      ...assetsData,
      assets: assetsData.assets.filter(asset => {
        // Asset is available if it has no current deployment and is not assigned to anyone
        return !asset.currentDeployment && !asset.currentlyAssignedTo
      })
    }
    
    return (
      <div className="space-y-6">
        <AssetDeploymentView 
          assetsData={availableAssets}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          currentFilters={{
            categoryId,
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset deployment page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Deployment</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load assets. Please try again later.</p>
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