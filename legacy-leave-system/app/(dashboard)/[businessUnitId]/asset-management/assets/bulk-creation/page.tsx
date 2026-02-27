import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { BulkAssetCreationView } from "@/components/asset-management/bulk-asset-creation-view"

interface BulkAssetCreationPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function BulkAssetCreationPage({ params }: BulkAssetCreationPageProps) {
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
  
  return (
    <div className="space-y-6">
      <BulkAssetCreationView businessUnitId={businessUnitId} />
    </div>
  )
}