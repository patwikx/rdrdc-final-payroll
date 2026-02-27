import { auth } from "@/auth"
import { CreateAssetForm } from "@/components/asset-management/create-asset-form"
import { redirect } from "next/navigation"


interface CreateAssetPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function CreateAssetPage({ params }: CreateAssetPageProps) {
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
      <CreateAssetForm businessUnitId={businessUnitId} />
    </div>
  )
}