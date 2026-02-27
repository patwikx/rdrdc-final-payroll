import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DepreciationHistoryView } from "@/components/asset-management/depreciation-history-view"

interface DepreciationHistoryPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    page?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function DepreciationHistoryPage({ 
  params, 
  searchParams 
}: DepreciationHistoryPageProps) {
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


  const { page = "1", status, dateFrom, dateTo } = await searchParams
  
  try {
    // Get business unit info
    const businessUnit = await getBusinessUnit(businessUnitId)
    
    if (!businessUnit) {
      redirect("/unauthorized")
    }

    // Get depreciation execution history
    const historyData = await getDepreciationHistory({
      businessUnitId,
      page: parseInt(page),
      status,
      dateFrom,
      dateTo
    })
    
    return (
      <div className="space-y-6">
        <DepreciationHistoryView 
          historyData={historyData}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
          currentFilters={{
            page: parseInt(page),
            status,
            dateFrom,
            dateTo
          }}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading depreciation history:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Depreciation History</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load depreciation history. Please try again later.</p>
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

async function getDepreciationHistory({
  businessUnitId,
  page = 1,
  status,
  dateFrom,
  dateTo
}: {
  businessUnitId: string
  page?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}) {
  try {
    const { prisma } = await import("@/lib/prisma")
    
    const limit = 20
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      businessUnitId
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.executionDate = {}
      if (dateFrom) {
        where.executionDate.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.executionDate.lte = new Date(dateTo)
      }
    }

    // Get executions with related data
    const executions = await prisma.depreciationExecution.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            scheduleType: true
          }
        },
        executor: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assetDetails: true
          }
        }
      },
      orderBy: {
        executionDate: 'desc'
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.depreciationExecution.count({ where })

    // Get summary statistics
    const summary = await prisma.depreciationExecution.aggregate({
      where: { businessUnitId },
      _count: {
        id: true
      },
      _sum: {
        totalAssetsProcessed: true,
        successfulCalculations: true,
        totalDepreciationAmount: true
      }
    })

    return {
      executions: executions.map(execution => ({
        ...execution,
        totalDepreciationAmount: Number(execution.totalDepreciationAmount),
        executionDurationMs: execution.executionDurationMs ?? undefined,
        errorMessage: execution.errorMessage ?? undefined,
        executor: execution.executor ?? undefined
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      summary: {
        totalExecutions: summary._count.id || 0,
        totalAssetsProcessed: summary._sum.totalAssetsProcessed || 0,
        totalSuccessfulCalculations: summary._sum.successfulCalculations || 0,
        totalDepreciationAmount: Number(summary._sum.totalDepreciationAmount || 0)
      }
    }
  } catch (error) {
    console.error("Error fetching depreciation history:", error)
    return {
      executions: [],
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      summary: {
        totalExecutions: 0,
        totalAssetsProcessed: 0,
        totalSuccessfulCalculations: 0,
        totalDepreciationAmount: 0
      }
    }
  }
}