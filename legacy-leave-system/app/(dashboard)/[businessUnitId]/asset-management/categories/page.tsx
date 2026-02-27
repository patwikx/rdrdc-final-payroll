import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAssetCategories } from "@/lib/actions/asset-categories-actions"
import { AssetCategoriesView } from "@/components/asset-management/asset-categories-view"

interface AssetCategoriesPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function AssetCategoriesPage({ params, searchParams }: AssetCategoriesPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId } = await params
  
  // Check if user has asset management permissions (ADMIN, MANAGER, HR, or users with accounting access)
  const hasAccess = ["ADMIN", "MANAGER", "HR"].includes(session.user.role) || session.user.isAcctg
  
  if (!hasAccess) {
    redirect(`/${businessUnitId}/unauthorized`)
  }
  const { search, page = "1" } = await searchParams
  
  try {
    const categoriesData = await getAssetCategories({
      businessUnitId,
      search,
      page: parseInt(page),
      limit: 10
    })
    
    return (
      <div className="space-y-6">
        <AssetCategoriesView 
          categoriesData={categoriesData}
          businessUnitId={businessUnitId}
          currentFilters={{
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset categories:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Categories</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load categories. Please try again later.</p>
        </div>
      </div>
    )
  }
}