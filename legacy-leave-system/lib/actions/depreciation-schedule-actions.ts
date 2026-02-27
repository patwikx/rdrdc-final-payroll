"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

// Validation schemas
const createScheduleSchema = z.object({
  name: z.string().min(1, "Schedule name is required").max(100, "Name too long"),
  description: z.string().optional(),
  scheduleType: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]),
  executionDay: z.number().min(1).max(31),
  includeCategories: z.array(z.string()).optional().default([]),
  excludeCategories: z.array(z.string()).optional().default([]),
  isActive: z.boolean().default(true)
})

const updateScheduleSchema = createScheduleSchema.extend({
  id: z.string()
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>

export async function createDepreciationSchedule(
  businessUnitId: string,
  data: CreateScheduleInput
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate user permissions
    if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Validate input
    const validatedData = createScheduleSchema.parse(data)

    // Verify business unit exists and user has access
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId }
    })

    if (!businessUnit) {
      throw new Error("Business unit not found")
    }

    // Create the schedule
    const schedule = await prisma.depreciationSchedule.create({
      data: {
        ...validatedData,
        businessUnitId,
        createdBy: session.user.id
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            executions: true
          }
        }
      }
    })

    revalidatePath(`/${businessUnitId}/asset-management/depreciation/schedules`)
    
    return {
      success: true,
      data: schedule
    }
  } catch (error) {
    console.error("Error creating depreciation schedule:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create schedule"
    }
  }
}

export async function updateDepreciationSchedule(
  businessUnitId: string,
  data: UpdateScheduleInput
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate user permissions
    if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Validate input
    const validatedData = updateScheduleSchema.parse(data)

    // Verify schedule exists and belongs to business unit
    const existingSchedule = await prisma.depreciationSchedule.findFirst({
      where: {
        id: validatedData.id,
        businessUnitId
      }
    })

    if (!existingSchedule) {
      throw new Error("Schedule not found")
    }

    // Update the schedule
    const schedule = await prisma.depreciationSchedule.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        scheduleType: validatedData.scheduleType,
        executionDay: validatedData.executionDay,
        includeCategories: validatedData.includeCategories,
        excludeCategories: validatedData.excludeCategories,
        isActive: validatedData.isActive
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            executions: true
          }
        }
      }
    })

    revalidatePath(`/${businessUnitId}/asset-management/depreciation/schedules`)
    revalidatePath(`/${businessUnitId}/asset-management/depreciation/schedules/${schedule.id}`)
    
    return {
      success: true,
      data: schedule
    }
  } catch (error) {
    console.error("Error updating depreciation schedule:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update schedule"
    }
  }
}

export async function deleteDepreciationSchedule(
  businessUnitId: string,
  scheduleId: string
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate user permissions
    if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Verify schedule exists and belongs to business unit
    const existingSchedule = await prisma.depreciationSchedule.findFirst({
      where: {
        id: scheduleId,
        businessUnitId
      }
    })

    if (!existingSchedule) {
      throw new Error("Schedule not found")
    }

    // Delete the schedule (cascades to executions)
    await prisma.depreciationSchedule.delete({
      where: { id: scheduleId }
    })

    revalidatePath(`/${businessUnitId}/asset-management/depreciation/schedules`)
    
    return {
      success: true
    }
  } catch (error) {
    console.error("Error deleting depreciation schedule:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete schedule"
    }
  }
}

export async function toggleScheduleStatus(
  businessUnitId: string,
  scheduleId: string,
  isActive: boolean
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Validate user permissions
    if (!["ADMIN", "MANAGER", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Verify schedule exists and belongs to business unit
    const existingSchedule = await prisma.depreciationSchedule.findFirst({
      where: {
        id: scheduleId,
        businessUnitId
      }
    })

    if (!existingSchedule) {
      throw new Error("Schedule not found")
    }

    // Update the schedule status
    const schedule = await prisma.depreciationSchedule.update({
      where: { id: scheduleId },
      data: { isActive }
    })

    revalidatePath(`/${businessUnitId}/asset-management/depreciation/schedules`)
    
    return {
      success: true,
      data: schedule
    }
  } catch (error) {
    console.error("Error toggling schedule status:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update schedule status"
    }
  }
}

export async function getScheduleCategories(businessUnitId: string) {
  try {
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

    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      count: cat._count.assets
    }))
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
}

export async function triggerDepreciationSchedules() {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return {
        success: false,
        error: "Only administrators can manually trigger depreciation schedules"
      }
    }

    // Call the manual trigger endpoint
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/trigger-depreciation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to trigger schedules')
    }

    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error("Error triggering depreciation schedules:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger schedules"
    }
  }
}

export async function getScheduleDetails(scheduleId: string, businessUnitId: string) {
  try {
    const schedule = await prisma.depreciationSchedule.findFirst({
      where: {
        id: scheduleId,
        businessUnitId
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        executions: {
          include: {
            executor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            _count: {
              select: {
                assetDetails: true
              }
            }
          },
          orderBy: { executionDate: 'desc' },
          take: 20
        },
        _count: {
          select: { executions: true }
        }
      }
    })

    if (!schedule) {
      return null
    }

    // Get categories for display
    const categories = await prisma.assetCategory.findMany({
      where: { 
        businessUnitId,
        id: { 
          in: [...schedule.includeCategories, ...schedule.excludeCategories] 
        }
      },
      select: {
        id: true,
        name: true
      }
    })

    // Get assets that would be affected by this schedule
    let assetWhereClause: any = {
      businessUnitId,
      isActive: true,
      depreciationMethod: { not: null },
      isFullyDepreciated: false
    }

    if (schedule.includeCategories.length > 0) {
      assetWhereClause.categoryId = { in: schedule.includeCategories }
    }

    if (schedule.excludeCategories.length > 0) {
      assetWhereClause.categoryId = { notIn: schedule.excludeCategories }
    }

    const affectedAssetsCount = await prisma.asset.count({
      where: assetWhereClause
    })

    const totalAssetValue = await prisma.asset.aggregate({
      where: assetWhereClause,
      _sum: {
        currentBookValue: true
      }
    })

    return {
      ...schedule,
      description: schedule.description ?? undefined,
      creator: {
        ...schedule.creator,
        email: schedule.creator.email ?? undefined
      },
      executions: schedule.executions.map(execution => ({
        ...execution,
        totalDepreciationAmount: Number(execution.totalDepreciationAmount),
        executionDurationMs: execution.executionDurationMs ?? undefined,
        errorMessage: execution.errorMessage ?? undefined,
        executor: execution.executor ? {
          ...execution.executor,
          email: execution.executor.email ?? undefined
        } : undefined,
        assetCount: execution._count.assetDetails
      })),
      categories: categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name
        return acc
      }, {} as Record<string, string>),
      affectedAssetsCount,
      totalAssetValue: Number(totalAssetValue._sum.currentBookValue || 0)
    }
  } catch (error) {
    console.error("Error fetching schedule details:", error)
    return null
  }
}