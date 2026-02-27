import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CreateRoleView } from "@/components/admin/create-role-view"

interface CreateRolePageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function CreateRolePage({ params }: CreateRolePageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has admin or HR permissions
  if (!["ADMIN", "HR"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const { businessUnitId } = await params
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    return (
      <div className="space-y-6">
        <CreateRoleView 
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading create role page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Role</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load create role page. Please try again later.</p>
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