import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { BulkInventoryCreation } from "@/components/inventory/bulk-inventory-creation"

interface BulkInventoryPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function BulkInventoryPage({ params }: BulkInventoryPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId } = await params
  
  return <BulkInventoryCreation businessUnitId={businessUnitId} />
}
