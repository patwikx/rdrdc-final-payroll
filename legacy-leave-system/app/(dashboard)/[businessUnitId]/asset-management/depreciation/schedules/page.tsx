import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DepreciationSchedulesView } from "@/components/asset-management/depreciation-schedules-view"

interface DepreciationSchedulesPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function DepreciationSchedulesPage({ 
  params 
}: DepreciationSchedulesPageProps) {
  const session = await auth()
    const { businessUnitId } = await params
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }
  
 // Check if user has asset management permissions (ADMIN, MANAGER, HR, or users with accounting access)
  const hasAccess = ["ADMIN", "MANAGER", "HR"].includes(session.user.role) || session.user.isAcctg
  
  if (!hasAccess) {
    redirect(`/${businessUnitId}/unauthorized`)
  }

  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get schedules data
    const schedulesData = await getSchedulesData(businessUnitId)
    
    return (
      <div className="space-y-6">
        <DepreciationSchedulesView 
          schedulesData={schedulesData}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading depreciation schedules:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Depreciation Schedules</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load schedules. Please try again later.</p>
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

async function getSchedulesData(businessUnitId: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    
    // Get schedules
    const schedules = await prisma.depreciationSchedule.findMany({
      where: { businessUnitId },
      include: {
        creator: {
          select: {
            name: true
          }
        },
        executions: {
          select: {
            id: true,
            executionDate: true,
            status: true,
            totalAssetsProcessed: true,
            successfulCalculations: true,
            totalDepreciationAmount: true
          },
          orderBy: { executionDate: 'desc' },
          take: 5
        },
        _count: {
          select: { executions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get categories for creating new schedules
    const categories = await prisma.assetCategory.findMany({
      where: { businessUnitId },
      select: {
        id: true,
        name: true,
        _count: {
          select: { assets: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return {
      schedules: schedules.map(schedule => ({
        ...schedule,
        description: schedule.description ?? undefined,
        executions: schedule.executions.map(execution => ({
          ...execution,
          status: execution.status as string,
          totalDepreciationAmount: execution.totalDepreciationAmount.toNumber()
        }))
      })),
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        count: cat._count.assets
      }))
    }
  } catch (error) {
    console.error("Error fetching schedules data:", error)
    return {
      schedules: [],
      categories: []
    }
  }
}