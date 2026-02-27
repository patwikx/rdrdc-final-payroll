import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { RolesManagementView } from "@/components/admin/roles-management-view"

interface RolesPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}

export default async function RolesPage({ params, searchParams }: RolesPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
  // Check if user has admin or HR permissions
  if (!["ADMIN", "HR"].includes(session.user.role)) {
    redirect("/unauthorized")
  }

  const { businessUnitId } = await params
  const { search, page = "1" } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get roles data
    const rolesData = await getRoles({
      search,
      page: parseInt(page),
      limit: 20
    })
    
    return (
      <div className="space-y-6">
        <RolesManagementView 
          rolesData={rolesData}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          currentFilters={{
            search,
            page: parseInt(page)
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading roles page:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load roles. Please try again later.</p>
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

async function getRoles({
  search,
  page,
  limit
}: {
  search?: string
  page: number
  limit: number
}) {
  try {
    const { prisma } = await import("@/lib/prisma")
    
    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          _count: {
            select: {
              employees: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.role.count({ where })
    ])

    return {
      roles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    console.error("Error fetching roles:", error)
    return {
      roles: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    }
  }
}