import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { RoleDetailView } from "@/components/admin/role-detail-view"
import { Skeleton } from "@/components/ui/skeleton"

interface RoleDetailPageProps {
  params: Promise<{
    businessUnitId: string
    id: string
  }>
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has admin or HR permissions
  if (!["ADMIN", "HR"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const { businessUnitId, id } = await params

  return (
    <Suspense fallback={<RoleDetailSkeleton />}>
      <RoleDetailContent businessUnitId={businessUnitId} roleId={id} />
    </Suspense>
  )
}

async function RoleDetailContent({ businessUnitId, roleId }: { businessUnitId: string; roleId: string }) {
  try {
    const [businessUnit, roleData] = await Promise.all([
      getBusinessUnit(businessUnitId),
      getRoleWithUsers(roleId)
    ])
    
    if (!businessUnit || !roleData) {
      redirect("/unauthorized")
    }

    return (
      <RoleDetailView 
        role={roleData.role}
        users={roleData.users}
        businessUnit={businessUnit}
        businessUnitId={businessUnitId}
      />
    )
  } catch (error) {
    console.error("Error loading role detail:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Role Details</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load role details. Please try again later.</p>
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

async function getRoleWithUsers(roleId: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        employees: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            isActive: true,
            createdAt: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!role) {
      return null
    }

    return {
      role,
      users: role.employees
    }
  } catch (error) {
    console.error("Error fetching role with users:", error)
    return null
  }
}

function RoleDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[80px]" />
        </div>
      </div>

      {/* Role Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-[200px]" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
              </div>
              <Skeleton className="h-8 w-[80px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}