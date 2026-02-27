import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getInventoryVerifications } from "@/lib/actions/inventory-verification-actions"
import { InventoryVerificationView } from "@/components/asset-management/inventory-verification-view"

interface InventoryVerificationPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    status?: string
    search?: string
    page?: string
    view?: string
  }>
}

export default async function InventoryVerificationPage({ params, searchParams }: InventoryVerificationPageProps) {
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

  const { status, search, page = "1", view = "overview" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get inventory verifications
    const verificationsData = await getInventoryVerifications({
      businessUnitId,
      status,
      search,
      page: parseInt(page),
      limit: 20
    })
    
    return (
      <div className="space-y-6">
        <InventoryVerificationView 
          verificationsData={verificationsData}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          currentFilters={{
            status,
            search,
            page: parseInt(page),
            view: view as 'overview' | 'active' | 'completed'
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading inventory verification page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Verification</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load inventory verifications. Please try again later.</p>
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