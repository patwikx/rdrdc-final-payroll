import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAssets } from "@/lib/actions/asset-management-actions"
import { AssetsManagementView } from "@/components/asset-management/assets-management-view"
import { AssetStatus } from "@prisma/client"

interface AssetManagementPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    categoryId?: string
    status?: AssetStatus
    isActive?: string
    search?: string
    assignedTo?: string
    page?: string
  }>
}

export default async function AssetManagementPage({ params, searchParams }: AssetManagementPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId } = await params
  
  // Check if user has asset management permissions (ADMIN, MANAGER, or users with accounting access)
  const hasAccess = ["ADMIN", "MANAGER"].includes(session.user.role) || session.user.isAcctg
  
  if (!hasAccess) {
    redirect(`/${businessUnitId}/unauthorized`)
  }
  const { categoryId, status, isActive, search, assignedTo, page = "1" } = await searchParams
  
  try {
    const assetsData = await getAssets({
      businessUnitId,
      categoryId,
      status,
      isActive: isActive ? isActive === 'true' : undefined,
      search,
      assignedTo,
      page: parseInt(page),
      limit: 10
    })
    
    return (
      <div className="space-y-6">
        <AssetsManagementView 
          assetsData={assetsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            categoryId,
            status,
            isActive: isActive ? isActive === 'true' : undefined,
            search,
            assignedTo,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading assets:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assets Management</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load assets. Please try again later.</p>
        </div>
      </div>
    )
  }
}