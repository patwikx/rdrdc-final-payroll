import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAssets } from "@/lib/actions/asset-management-actions"
import { QRCodePrintPage } from "@/components/asset-management/qr-code-print-page"

interface PrintPreviewPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    assets?: string // Comma-separated asset IDs
  }>
}

export default async function PrintPreviewPage({ params, searchParams }: PrintPreviewPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has asset management permissions
  if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const { businessUnitId } = await params
  const { assets: assetIds } = await searchParams
  
  if (!assetIds) {
    redirect(`/${businessUnitId}/asset-management/asset-printing`)
  }

  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get all assets first, then filter by selected IDs
    const assetsData = await getAssets({
      businessUnitId,
      limit: 1000, // Get all assets
      isActive: true
    })

    // Filter to only selected assets
    const selectedAssetIds = assetIds.split(',')
    const selectedAssets = assetsData.assets.filter(asset => 
      selectedAssetIds.includes(asset.id)
    )
    
    return (
      <QRCodePrintPage 
        assets={selectedAssets}
        businessUnit={businessUnit}
        businessUnitId={businessUnitId}
      />
    )
  } catch (error) {
    console.error("Error loading print preview:", error)
    redirect(`/${businessUnitId}/asset-management/asset-printing`)
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