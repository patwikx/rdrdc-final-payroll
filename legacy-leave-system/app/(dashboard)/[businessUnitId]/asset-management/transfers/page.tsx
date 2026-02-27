import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getDeployedAssets } from "@/lib/actions/asset-return-actions"
import { AssetTransferView } from "@/components/asset-management/asset-transfer-view"

interface AssetTransferPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    employeeId?: string
    search?: string
    page?: string
  }>
}

export default async function AssetTransferPage({ params, searchParams }: AssetTransferPageProps) {
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


  const { employeeId, search, page = "1" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get deployed assets for transfer (reuse the same logic as returns)
    const deployedAssetsData = await getDeployedAssets({
      businessUnitId,
      employeeId,
      search,
      page: parseInt(page),
      limit: 100
    })
    
    return (
      <div className="space-y-6">
        <AssetTransferView 
          deployedAssetsData={deployedAssetsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            employeeId,
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset transfer page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Transfers</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load deployed assets. Please try again later.</p>
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