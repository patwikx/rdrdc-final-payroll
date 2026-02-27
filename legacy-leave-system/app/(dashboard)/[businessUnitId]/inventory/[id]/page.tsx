import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getInventoryItemById } from "@/lib/actions/inventory-actions"
import { InventoryItemDetail } from "@/components/inventory/inventory-item-detail"

interface InventoryItemPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function InventoryItemPage({ params }: InventoryItemPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }

  const { businessUnitId, id } = await params

  try {
    const item = await getInventoryItemById(id)

    if (!item) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Item Not Found</h1>
            <p className="text-muted-foreground mt-1">
              The inventory item you're looking for doesn't exist.
            </p>
          </div>
        </div>
      )
    }

    return (
      <InventoryItemDetail
        businessUnitId={businessUnitId}
        item={item}
      />
    )
  } catch (error) {
    console.error("Error loading inventory item:", error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
          <p className="text-muted-foreground mt-1">
            Unable to load inventory item. Please try again later.
          </p>
        </div>
      </div>
    )
  }
}
