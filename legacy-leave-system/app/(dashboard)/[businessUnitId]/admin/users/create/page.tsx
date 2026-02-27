import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAllManagers, getAllBusinessUnits, getAllDepartments } from "@/lib/actions/user-management-actions"
import { getAllRoles } from "@/lib/actions/role-actions"
import { CreateUserView } from "@/components/users/create-user-view"

interface CreateUserPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function CreateUserPage({ params }: CreateUserPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has user management permissions
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

    // Fetch related data in parallel
    const [managers, businessUnits, departments, roles] = await Promise.all([
      getAllManagers(),
      getAllBusinessUnits(),
      getAllDepartments(),
      getAllRoles()
    ])

    return (
      <div className="space-y-6">
        <CreateUserView 
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          managers={managers}
          businessUnits={businessUnits}
          departments={departments}
          roles={roles}
          isAdmin={session.user.role === "ADMIN"}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading create user page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create User</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load create user page. Please try again later.</p>
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