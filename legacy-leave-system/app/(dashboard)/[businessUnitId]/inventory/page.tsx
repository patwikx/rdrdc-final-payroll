import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getInventorySummary, getInventoryItems } from "@/lib/actions/inventory-actions"
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard"

interface InventoryPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function InventoryPage({ params }: InventoryPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  const { businessUnitId } = await params
  
  try {
    const [summary, items] = await Promise.all([
      getInventorySummary(businessUnitId),
      getInventoryItems(businessUnitId)
    ])
    
    return (
      <InventoryDashboard
        businessUnitId={businessUnitId}
        summary={summary}
        items={items}
      />
    )
  } catch (error) {
    console.error("Error loading inventory:", error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track your inventory items</p>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load inventory. Please try again later.</p>
        </div>
      </div>
    )
  }
}
