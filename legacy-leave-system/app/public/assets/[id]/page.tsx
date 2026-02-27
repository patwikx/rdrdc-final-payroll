import { notFound } from "next/navigation"
import { PublicAssetDetailsView } from "@/components/asset-management/public-asset-details-view"

interface PublicAssetPageProps {
  params: Promise<{
    id: string
  }>
}

async function getAssetDetails(assetId: string) {
  try {
    const baseUrl = process.env.AUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/public/assets/${assetId}`, {
      cache: 'no-store'
    })
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error("Error fetching asset details:", error)
    return null
  }
}

export default async function PublicAssetPage({ params }: PublicAssetPageProps) {
  const { id } = await params
  const asset = await getAssetDetails(id)

  if (!asset) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicAssetDetailsView asset={asset} />
    </div>
  )
}

export async function generateMetadata({ params }: PublicAssetPageProps) {
  const { id } = await params
  const asset = await getAssetDetails(id)

  if (!asset) {
    return {
      title: 'Asset Not Found'
    }
  }

  return {
    title: `${asset.itemCode} - ${asset.description}`,
    description: `Asset details for ${asset.itemCode}: ${asset.description}`
  }
}