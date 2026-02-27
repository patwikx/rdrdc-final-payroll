import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAssets } from "@/lib/actions/asset-management-actions"
// We'll implement getBusinessUnit inline
import { AssetPrintingView } from "@/components/asset-management/asset-printing-view"

interface AssetPrintingPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    categoryId?: string
    search?: string
    page?: string
  }>
}

export default async function AssetPrintingPage({ params, searchParams }: AssetPrintingPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has asset management permissions
  if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const { businessUnitId } = await params
  const { categoryId, search, page = "1" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get assets for selection
    const assetsData = await getAssets({
      businessUnitId,
      categoryId,
      search,
      page: parseInt(page),
      limit: 10,
      isActive: true // Only show active assets
    })
    
    return (
      <div className="space-y-6">
        <AssetPrintingView 
          assetsData={assetsData}
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
    console.error("Error loading asset printing page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset QR Code Printing</h1>
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
  // This function should be implemented in your business unit actions
  // For now, I'll create a simple version
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