import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getRetirableAssets } from "@/lib/actions/asset-retirement-actions"
import { getDisposableAssets } from "@/lib/actions/asset-disposal-actions"
import { AssetRetirementDisposalView } from "@/components/asset-management/asset-retirement-disposal-view"

interface AssetRetirementDisposalPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    tab?: 'retirements' | 'disposals'
    categoryId?: string
    search?: string
    page?: string
  }>
}

export default async function AssetRetirementDisposalPage({ params, searchParams }: AssetRetirementDisposalPageProps) {
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

  const { tab = 'retirements', categoryId, search, page = "1" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get both retirable and disposable assets
    const [retirableAssetsData, disposableAssetsData] = await Promise.all([
      getRetirableAssets({
        businessUnitId,
        categoryId,
        search,
        page: parseInt(page),
        limit: 10
      }),
      getDisposableAssets({
        businessUnitId,
        categoryId,
        search,
        page: parseInt(page),
        limit: 10
      })
    ])
    
    return (
      <div className="space-y-6">
        <AssetRetirementDisposalView 
          retirableAssetsData={retirableAssetsData}
          disposableAssetsData={disposableAssetsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            tab,
            categoryId,
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset retirement/disposal page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Retirements & Disposals</h1>
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