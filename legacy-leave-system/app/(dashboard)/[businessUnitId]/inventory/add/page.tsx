import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AddInventoryForm } from "@/components/inventory/add-inventory-form"

interface AddInventoryPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function AddInventoryPage({ params }: AddInventoryPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId } = await params
  
  return (
    <AddInventoryForm businessUnitId={businessUnitId} />
  )
}
