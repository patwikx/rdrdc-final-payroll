"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { AssetStatus, DepreciationMethod } from "@prisma/client"

// Simple types for now
export interface DepreciationScheduleConfig {
  businessUnitId: string
  name: string
  description?: string
  scheduleType: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
  executionDay: number
  includeCategories?: string[]
  excludeCategories?: string[]
}

export interface ScheduledDepreciationResult {
  totalAssetsProcessed: number
  successfulCalculations: number
  failedCalculations: number
  totalDepreciationAmount: number
  executionDurationMs: number
  details: Array<{
    assetId: string
    itemCode: string
    description: string
    depreciationAmount: number
    newBookValue: number
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
    error?: string
  }>
}

// For now, let's create a simple manual execution function
export async function executeManualDepreciation(
  businessUnitId: string,
  config: {
    includeCategories?: string[]
    excludeCategories?: string[]
    calculationDate?: Date
  } = {}
): Promise<ScheduledDepreciationResult> {
  const startTime = Date.now()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    const calculationDate = config.calculationDate || new Date()

    // Get eligible assets
    const whereClause: any = {
      businessUnitId,
      status: {
        in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
      },
      purchasePrice: { not: null },
      depreciationStartDate: { 
        not: null,
        lte: calculationDate
      },
      isFullyDepreciated: false,
      monthlyDepreciation: { 
        not: null,
        gt: 0
      }
    }

    if (config.includeCategories && config.includeCategories.length > 0) {
      whereClause.categoryId = { in: config.includeCategories }
    }

    if (config.excludeCategories && config.excludeCategories.length > 0) {
      whereClause.categoryId = { 
        ...whereClause.categoryId,
        notIn: config.excludeCategories 
      }
    }

    const assets = await prisma.asset.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { itemCode: 'asc' }
    })

    const result: ScheduledDepreciationResult = {
      totalAssetsProcessed: assets.length,
      successfulCalculations: 0,
      failedCalculations: 0,
      totalDepreciationAmount: 0,
      executionDurationMs: 0,
      details: []
    }

    // Process each asset
    for (const asset of assets) {
      try {
        // Check if asset needs depreciation
        const needsDepreciation = shouldCalculateDepreciation(asset, calculationDate)
        
        if (!needsDepreciation.should) {
          result.details.push({
            assetId: asset.id,
            itemCode: asset.itemCode,
            description: asset.description,
            depreciationAmount: 0,
            newBookValue: Number(asset.currentBookValue || 0),
            status: 'SKIPPED',
            error: needsDepreciation.reason
          })
          continue
        }

        // Calculate depreciation
        const calculation = calculateMonthlyDepreciation(asset, calculationDate)
        
        if (calculation.depreciationAmount <= 0) {
          result.details.push({
            assetId: asset.id,
            itemCode: asset.itemCode,
            description: asset.description,
            depreciationAmount: 0,
            newBookValue: calculation.bookValueEnd,
            status: 'SKIPPED',
            error: "No depreciation amount calculated"
          })
          continue
        }

        // Create depreciation record and update asset in transaction
        await prisma.$transaction(async (tx) => {
          // Create depreciation record
          await tx.assetDepreciation.create({
            data: {
              assetId: asset.id,
              businessUnitId: asset.businessUnitId,
              depreciationDate: calculationDate,
              periodStartDate: calculation.periodStartDate,
              periodEndDate: calculation.periodEndDate,
              bookValueStart: calculation.bookValueStart,
              depreciationAmount: calculation.depreciationAmount,
              bookValueEnd: calculation.bookValueEnd,
              accumulatedDepreciation: calculation.newAccumulatedDepreciation,
              method: asset.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
              calculatedBy: session.user.id,
              notes: `Manual depreciation calculation`
            }
          })

          // Update asset
          await tx.asset.update({
            where: { id: asset.id },
            data: {
              currentBookValue: calculation.bookValueEnd,
              accumulatedDepreciation: calculation.newAccumulatedDepreciation,
              lastDepreciationDate: calculationDate,
              nextDepreciationDate: calculation.nextDepreciationDate,
              isFullyDepreciated: calculation.isFullyDepreciated
            }
          })

          // Create history entry
          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              action: 'DEPRECIATION_CALCULATED',
              notes: `Manual depreciation: ₱${calculation.depreciationAmount.toLocaleString()}. New book value: ₱${calculation.bookValueEnd.toLocaleString()}`,
              performedById: session.user.id,
              businessUnitId: asset.businessUnitId,
              previousBookValue: calculation.bookValueStart,
              newBookValue: calculation.bookValueEnd,
              depreciationAmount: calculation.depreciationAmount
            }
          })
        })

        result.successfulCalculations++
        result.totalDepreciationAmount += calculation.depreciationAmount
        
        result.details.push({
          assetId: asset.id,
          itemCode: asset.itemCode,
          description: asset.description,
          depreciationAmount: calculation.depreciationAmount,
          newBookValue: calculation.bookValueEnd,
          status: 'SUCCESS'
        })

      } catch (error) {
        result.failedCalculations++
        result.details.push({
          assetId: asset.id,
          itemCode: asset.itemCode,
          description: asset.description,
          depreciationAmount: 0,
          newBookValue: Number(asset.currentBookValue || asset.purchasePrice || 0),
          status: 'FAILED',
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    result.executionDurationMs = Date.now() - startTime

    revalidatePath(`/${businessUnitId}/asset-management/depreciation`)

    return result

  } catch (error) {
    console.error("Error executing manual depreciation:", error)
    throw new Error("Failed to execute depreciation calculation")
  }
}

function shouldCalculateDepreciation(asset: any, calculationDate: Date) {
  const depreciationStartDate = new Date(asset.depreciationStartDate)
  const lastDepreciationDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : null

  // Check if depreciation start date has passed
  if (depreciationStartDate > calculationDate) {
    return { should: false, reason: 'Depreciation start date not reached' }
  }

  // Check if already fully depreciated
  if (asset.isFullyDepreciated) {
    return { should: false, reason: 'Asset is fully depreciated' }
  }

  // Check if enough time has passed since last depreciation (at least 1 month)
  if (lastDepreciationDate) {
    const monthsSinceLastDepreciation = 
      (calculationDate.getFullYear() - lastDepreciationDate.getFullYear()) * 12 + 
      (calculationDate.getMonth() - lastDepreciationDate.getMonth())

    if (monthsSinceLastDepreciation < 1) {
      return { should: false, reason: `Only ${monthsSinceLastDepreciation} month(s) since last calculation` }
    }
  }

  return { should: true, reason: 'Ready for depreciation calculation' }
}

function calculateMonthlyDepreciation(asset: any, calculationDate: Date) {
  const purchasePrice = Number(asset.purchasePrice)
  const salvageValue = Number(asset.salvageValue || 0)
  const currentBookValue = Number(asset.currentBookValue || purchasePrice)
  const accumulatedDepreciation = Number(asset.accumulatedDepreciation || 0)
  const monthlyDepreciation = Number(asset.monthlyDepreciation || 0)

  // Calculate period dates
  const lastDepDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : 
    new Date(asset.depreciationStartDate)
  
  const periodStartDate = new Date(lastDepDate.getFullYear(), lastDepDate.getMonth() + 1, 1)
  const periodEndDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0)

  let depreciationAmount = 0

  switch (asset.depreciationMethod) {
    case DepreciationMethod.STRAIGHT_LINE:
      depreciationAmount = monthlyDepreciation
      break

    case DepreciationMethod.DECLINING_BALANCE:
      const rate = Number(asset.depreciationRate || 0) / 100
      depreciationAmount = currentBookValue * (rate / 12)
      break

    case DepreciationMethod.UNITS_OF_PRODUCTION:
      // For now, use monthly amount - would need actual usage data
      depreciationAmount = monthlyDepreciation
      break

    case DepreciationMethod.SUM_OF_YEARS_DIGITS:
      depreciationAmount = monthlyDepreciation
      break

    default:
      depreciationAmount = monthlyDepreciation
  }

  // Ensure we don't depreciate below salvage value
  const maxDepreciation = currentBookValue - salvageValue
  depreciationAmount = Math.min(depreciationAmount, maxDepreciation)
  depreciationAmount = Math.max(0, depreciationAmount)

  const bookValueEnd = currentBookValue - depreciationAmount
  const newAccumulatedDepreciation = accumulatedDepreciation + depreciationAmount
  const isFullyDepreciated = bookValueEnd <= salvageValue

  // Calculate next depreciation date (next month end)
  let nextDepreciationDate: Date | null = null
  if (!isFullyDepreciated) {
    nextDepreciationDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 30)
    // Adjust to last day of month if needed
    const lastDayOfNextMonth = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 2, 0)
    if (nextDepreciationDate.getDate() > lastDayOfNextMonth.getDate()) {
      nextDepreciationDate = lastDayOfNextMonth
    }
  }

  return {
    periodStartDate,
    periodEndDate,
    bookValueStart: currentBookValue,
    depreciationAmount,
    bookValueEnd,
    newAccumulatedDepreciation,
    isFullyDepreciated,
    nextDepreciationDate
  }
}

// Simple function to get assets that need depreciation
export async function getAssetsNeedingDepreciation(businessUnitId: string) {
  try {
    const today = new Date()
    const isEndOfMonth = isLastDayOfMonth(today) || today.getDate() >= 30

    const assets = await prisma.asset.findMany({
      where: {
        businessUnitId,
        status: {
          in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
        },
        purchasePrice: { not: null },
        depreciationStartDate: { 
          not: null,
          lte: today
        },
        isFullyDepreciated: false,
        monthlyDepreciation: { 
          not: null,
          gt: 0
        },
        OR: [
          { lastDepreciationDate: null },
          {
            lastDepreciationDate: {
              lt: new Date(today.getFullYear(), today.getMonth(), 1)
            }
          }
        ]
      },
      include: {
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { itemCode: 'asc' }
    })

    return {
      assets,
      isEndOfMonth,
      totalCount: assets.length,
      totalMonthlyDepreciation: assets.reduce((sum, asset) => 
        sum + Number(asset.monthlyDepreciation || 0), 0
      )
    }
  } catch (error) {
    console.error("Error getting assets needing depreciation:", error)
    throw new Error("Failed to get assets needing depreciation")
  }
}

function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date)
  nextDay.setDate(date.getDate() + 1)
  return nextDay.getMonth() !== date.getMonth()
}

// Function for cron job to run end-of-month depreciation
export async function runEndOfMonthDepreciation() {
  try {
    const today = new Date()
    const isEndOfMonth = isLastDayOfMonth(today) || today.getDate() >= 30

    if (!isEndOfMonth) {
      console.log("Not end of month, skipping depreciation")
      return { skipped: true, reason: "Not end of month" }
    }

    // Get all business units
    const businessUnits = await prisma.businessUnit.findMany({
      select: { id: true, name: true }
    })

    const results = []

    for (const businessUnit of businessUnits) {
      try {
        console.log(`Running depreciation for ${businessUnit.name}...`)
        
        const result = await executeManualDepreciation(businessUnit.id, {
          calculationDate: today
        })
        
        results.push({
          businessUnitId: businessUnit.id,
          businessUnitName: businessUnit.name,
          ...result
        })
        
        console.log(`Completed depreciation for ${businessUnit.name}: ${result.successfulCalculations} assets processed`)
      } catch (error) {
        console.error(`Failed to run depreciation for ${businessUnit.name}:`, error)
        results.push({
          businessUnitId: businessUnit.id,
          businessUnitName: businessUnit.name,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      }
    }

    return { results, executedAt: today }
  } catch (error) {
    console.error("Error running end-of-month depreciation:", error)
    throw error
  }
}