import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAssetDetails } from "@/lib/actions/asset-details-actions"
import { AssetDetailsView } from "@/components/asset-management/asset-details-view"

interface AssetDetailsPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function AssetDetailsPage({ params }: AssetDetailsPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId, id } = await params
  
  // Check if user has asset management permissions (ADMIN, MANAGER, HR, or users with accounting access)
  const hasAccess = ["ADMIN", "MANAGER", "HR"].includes(session.user.role) || session.user.isAcctg
  
  if (!hasAccess) {
    redirect(`/${businessUnitId}/unauthorized`)
  }
  
  try {
    const assetData = await getAssetDetails(id, businessUnitId)
    
    if (!assetData) {
      redirect(`/${businessUnitId}/asset-management/assets`)
    }
    
    return (
      <div className="space-y-6">
        <AssetDetailsView 
          asset={assetData}
          businessUnitId={businessUnitId}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading asset details:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Asset Details</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load asset details. The asset may not exist or you may not have permission to view it.</p>
          <div className="mt-4">
            <a 
              href={`/${businessUnitId}/asset-management/assets`}
              className="text-primary hover:underline"
            >
              Return to Assets List
            </a>
          </div>
        </div>
      </div>
    )
  }
}