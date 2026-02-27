import { prisma } from "@/lib/prisma"
import { DepreciationSchedule, ExecutionStatus } from "@prisma/client"

interface ScheduleExecutionResult {
  executionId: string
  assetsProcessed: number
  successfulCalculations: number
  failedCalculations: number
  totalDepreciationAmount: number
}

export async function executeDepreciationSchedule(
  schedule: DepreciationSchedule & {
    businessUnit: { id: string; name: string; code: string }
    creator: { id: string; name: string }
  }
): Promise<ScheduleExecutionResult> {
  
  console.log(`🔄 Starting execution for schedule: ${schedule.name}`)
  
  // Create execution record
  const execution = await prisma.depreciationExecution.create({
    data: {
      scheduleId: schedule.id,
      businessUnitId: schedule.businessUnitId,
      executionDate: new Date(),
      scheduledDate: new Date(),
      status: 'RUNNING'
    }
  })

  try {
    // Get assets that match the schedule criteria
    const assets = await getAssetsForSchedule(schedule)
    
    console.log(`📦 Found ${assets.length} assets to process`)

    let successfulCalculations = 0
    let failedCalculations = 0
    let totalDepreciationAmount = 0

    // Process each asset
    for (const asset of assets) {
      try {
        const result = await processAssetDepreciation(asset, execution.id)
        
        if (result.success) {
          successfulCalculations++
          totalDepreciationAmount += result.depreciationAmount
        } else {
          failedCalculations++
        }

        // Create execution detail record
        await prisma.depreciationExecutionAsset.create({
          data: {
            executionId: execution.id,
            assetId: asset.id,
            status: result.success ? 'SUCCESS' : 'FAILED',
            depreciationAmount: result.depreciationAmount,
            bookValueBefore: result.bookValueBefore,
            bookValueAfter: result.bookValueAfter,
            errorMessage: result.error || null,
            calculationDetails: result.details || null
          }
        })

      } catch (error) {
        failedCalculations++
        console.error(`❌ Error processing asset ${asset.itemCode}:`, error)
        
        // Create failed execution detail
        await prisma.depreciationExecutionAsset.create({
          data: {
            executionId: execution.id,
            assetId: asset.id,
            status: 'FAILED',
            depreciationAmount: 0,
            bookValueBefore: Number(asset.currentBookValue || 0),
            bookValueAfter: Number(asset.currentBookValue || 0),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }

    // Update execution with results
    await prisma.depreciationExecution.update({
      where: { id: execution.id },
      data: {
        status: failedCalculations > 0 && successfulCalculations === 0 ? 'FAILED' : 'COMPLETED',
        totalAssetsProcessed: assets.length,
        successfulCalculations,
        failedCalculations,
        totalDepreciationAmount,
        completedAt: new Date(),
        executionDurationMs: Date.now() - execution.createdAt.getTime()
      }
    })

    console.log(`✅ Execution completed: ${successfulCalculations} successful, ${failedCalculations} failed`)

    return {
      executionId: execution.id,
      assetsProcessed: assets.length,
      successfulCalculations,
      failedCalculations,
      totalDepreciationAmount
    }

  } catch (error) {
    // Mark execution as failed
    await prisma.depreciationExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
        executionDurationMs: Date.now() - execution.createdAt.getTime()
      }
    })

    throw error
  }
}

async function getAssetsForSchedule(schedule: DepreciationSchedule) {
  let whereClause: any = {
    businessUnitId: schedule.businessUnitId,
    isActive: true,
    depreciationMethod: { not: null },
    isFullyDepreciated: false
  }

  // Apply category filters
  if (schedule.includeCategories.length > 0) {
    whereClause.categoryId = { in: schedule.includeCategories }
  }

  if (schedule.excludeCategories.length > 0) {
    whereClause.categoryId = { notIn: schedule.excludeCategories }
  }

  return await prisma.asset.findMany({
    where: whereClause,
    include: {
      category: { select: { name: true } }
    }
  })
}

interface DepreciationResult {
  success: boolean
  depreciationAmount: number
  bookValueBefore: number
  bookValueAfter: number
  error?: string
  details?: any
}

async function processAssetDepreciation(asset: any, executionId: string): Promise<DepreciationResult> {
  try {
    const bookValueBefore = Number(asset.currentBookValue || 0)
    const monthlyDepreciation = Number(asset.monthlyDepreciation || 0)
    
    // Skip if no depreciation amount or already fully depreciated
    if (monthlyDepreciation <= 0 || bookValueBefore <= 0) {
      return {
        success: true,
        depreciationAmount: 0,
        bookValueBefore,
        bookValueAfter: bookValueBefore
      }
    }

    const salvageValue = Number(asset.salvageValue || 0)
    const depreciationAmount = Math.min(monthlyDepreciation, bookValueBefore - salvageValue)
    const bookValueAfter = Math.max(bookValueBefore - depreciationAmount, salvageValue)
    const newAccumulatedDepreciation = Number(asset.accumulatedDepreciation || 0) + depreciationAmount

    // Update asset depreciation values
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        currentBookValue: bookValueAfter,
        accumulatedDepreciation: newAccumulatedDepreciation,
        lastDepreciationDate: new Date(),
        isFullyDepreciated: bookValueAfter <= salvageValue,
        // Set next depreciation date (next month)
        nextDepreciationDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())
      }
    })

    // Create depreciation record
    const currentDate = new Date()
    const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    await prisma.assetDepreciation.create({
      data: {
        assetId: asset.id,
        businessUnitId: asset.businessUnitId,
        depreciationDate: currentDate,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        bookValueStart: bookValueBefore,
        depreciationAmount,
        bookValueEnd: bookValueAfter,
        accumulatedDepreciation: newAccumulatedDepreciation,
        method: asset.depreciationMethod,
        calculatedBy: 'system',
        notes: `Automated depreciation via schedule execution ${executionId}`
      }
    })

    return {
      success: true,
      depreciationAmount,
      bookValueBefore,
      bookValueAfter,
      details: {
        method: asset.depreciationMethod,
        monthlyRate: monthlyDepreciation,
        salvageValue
      }
    }

  } catch (error) {
    return {
      success: false,
      depreciationAmount: 0,
      bookValueBefore: Number(asset.currentBookValue || 0),
      bookValueAfter: Number(asset.currentBookValue || 0),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}