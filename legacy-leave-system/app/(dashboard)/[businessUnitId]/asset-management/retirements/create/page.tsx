import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getRetirableAssets } from "@/lib/actions/asset-retirement-actions"
import { AssetRetirementCreateView } from "@/components/asset-management/asset-retirement-create-view"

interface AssetRetirementCreatePageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    assetIds?: string
    categoryId?: string
    search?: string
  }>
}

export default async function AssetRetirementCreatePage({ params, searchParams }: AssetRetirementCreatePageProps) {
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


  const { assetIds, categoryId, search } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get retirable assets (for selection if no specific assets provided)
    const retirableAssetsData = await getRetirableAssets({
      businessUnitId,
      categoryId,
      search,
      page: 1,
      limit: 1000 // Get all for selection
    })
    
    // Parse selected asset IDs if provided
    const selectedAssetIds = assetIds ? assetIds.split(',') : []
    
    return (
      <div className="space-y-6">
        <AssetRetirementCreateView 
          retirableAssetsData={retirableAssetsData}
          businessUnitId={businessUnitId}
          preSelectedAssetIds={selectedAssetIds}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset retirement create page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Retirement</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load retirement form. Please try again later.</p>
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