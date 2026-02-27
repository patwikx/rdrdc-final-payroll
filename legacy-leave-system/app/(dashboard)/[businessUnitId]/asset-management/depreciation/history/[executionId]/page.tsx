import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DepreciationExecutionDetailView } from "@/components/asset-management/depreciation-execution-detail-view"

interface DepreciationExecutionDetailPageProps {
  params: Promise<{
    businessUnitId: string
    executionId: string
  }>
}

export default async function DepreciationExecutionDetailPage({ 
  params 
}: DepreciationExecutionDetailPageProps) {
  const session = await auth()
   const { businessUnitId, executionId } = await params
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

    // Get execution details
    const executionDetails = await getExecutionDetails(executionId, businessUnitId)
    
    if (!executionDetails) {
      notFound()
    }
    
    return (
      <div className="space-y-6">
        <DepreciationExecutionDetailView 
          executionDetails={executionDetails}
          businessUnit={businessUnit}
          businessUnitId={businessUnitId}
        />
      </div>
    )
  } catch (error) {
    console.error("Error loading execution details:", error)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Execution Details</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load execution details. Please try again later.</p>
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

async function getExecutionDetails(executionId: string, businessUnitId: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    
    const execution = await prisma.depreciationExecution.findFirst({
      where: {
        id: executionId,
        businessUnitId
      },
      include: {
        schedule: {
          select: {
            id: true,
            name: true,
            scheduleType: true,
            description: true
          }
        },
        executor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assetDetails: {
          include: {
            asset: {
              select: {
                id: true,
                itemCode: true,
                description: true,
                category: {
                  select: {
                    name: true
                  }
                }
              }
            },
            depreciationRecord: {
              select: {
                id: true,
                depreciationAmount: true,
                bookValueStart: true,
                bookValueEnd: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!execution) return null

    // Convert Decimal types to numbers and handle null values for the component
    return {
      ...execution,
      totalDepreciationAmount: Number(execution.totalDepreciationAmount),
      executionDurationMs: execution.executionDurationMs || undefined,
      errorMessage: execution.errorMessage || undefined,
      schedule: {
        ...execution.schedule,
        description: execution.schedule.description ?? undefined
      },
      executor: execution.executor ? {
        ...execution.executor,
        email: execution.executor.email ?? undefined
      } : undefined,
      assetDetails: execution.assetDetails.map(detail => ({
        ...detail,
        depreciationAmount: Number(detail.depreciationAmount),
        bookValueBefore: Number(detail.bookValueBefore),
        bookValueAfter: Number(detail.bookValueAfter),
        errorMessage: detail.errorMessage || undefined,
        depreciationRecord: detail.depreciationRecord ? {
          ...detail.depreciationRecord,
          depreciationAmount: Number(detail.depreciationRecord.depreciationAmount),
          bookValueStart: Number(detail.depreciationRecord.bookValueStart),
          bookValueEnd: Number(detail.depreciationRecord.bookValueEnd)
        } : undefined
      }))
    }
  } catch (error) {
    console.error("Error fetching execution details:", error)
    return null
  }
}