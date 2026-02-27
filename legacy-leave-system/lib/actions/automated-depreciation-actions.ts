"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus, DepreciationMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface AutomatedDepreciationConfig {
  businessUnitId: string
  calculationDate: Date
  period: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
  includeCategories?: string[]
  excludeCategories?: string[]
  dryRun?: boolean // Preview mode without actually saving
}

export interface AutomatedDepreciationResult {
  totalAssetsProcessed: number
  totalDepreciationAmount: number
  successfulCalculations: number
  failedCalculations: number
  fullyDepreciatedAssets: number
  assetsWithoutSetup: number
  details: {
    assetId: string
    itemCode: string
    description: string
    depreciationAmount: number
    newBookValue: number
    status: 'SUCCESS' | 'FAILED' | 'FULLY_DEPRECIATED' | 'NO_SETUP'
    error?: string
  }[]
  summary: {
    byCategory: {
      categoryId: string
      categoryName: string
      assetsCount: number
      totalDepreciation: number
    }[]
    byMethod: {
      method: DepreciationMethod
      assetsCount: number
      totalDepreciation: number
    }[]
  }
}

export async function runAutomatedDepreciation(config: AutomatedDepreciationConfig): Promise<AutomatedDepreciationResult> {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Get all assets eligible for depreciation
    const whereClause: any = {
      businessUnitId: config.businessUnitId,
      status: {
        in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
      },
      purchasePrice: { not: null },
      depreciationStartDate: { not: null },
      isFullyDepreciated: false
    }

    if (config.includeCategories && config.includeCategories.length > 0) {
      whereClause.categoryId = { in: config.includeCategories }
    }

    if (config.excludeCategories && config.excludeCategories.length > 0) {
      whereClause.categoryId = { notIn: config.excludeCategories }
    }

    const assets = await prisma.asset.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        itemCode: 'asc'
      }
    })

    const result: AutomatedDepreciationResult = {
      totalAssetsProcessed: assets.length,
      totalDepreciationAmount: 0,
      successfulCalculations: 0,
      failedCalculations: 0,
      fullyDepreciatedAssets: 0,
      assetsWithoutSetup: 0,
      details: [],
      summary: {
        byCategory: [],
        byMethod: []
      }
    }

    const depreciationRecords: any[] = []
    const assetUpdates: any[] = []
    const historyEntries: any[] = []

    // Process each asset
    for (const asset of assets) {
      try {
        // Check if asset needs depreciation based on period
        const needsDepreciation = shouldCalculateDepreciation(asset, config.calculationDate, config.period)
        
        if (!needsDepreciation.should) {
          result.details.push({
            assetId: asset.id,
            itemCode: asset.itemCode,
            description: asset.description,
            depreciationAmount: 0,
            newBookValue: Number(asset.currentBookValue || 0),
            status: 'SUCCESS',
            error: needsDepreciation.reason
          })
          continue
        }

        // Check if asset has proper depreciation setup
        if (!asset.monthlyDepreciation || Number(asset.monthlyDepreciation) <= 0) {
          result.assetsWithoutSetup++
          result.details.push({
            assetId: asset.id,
            itemCode: asset.itemCode,
            description: asset.description,
            depreciationAmount: 0,
            newBookValue: Number(asset.currentBookValue || 0),
            status: 'NO_SETUP',
            error: 'Missing depreciation setup'
          })
          continue
        }

        // Calculate depreciation
        const calculation = calculateAssetDepreciation(asset, config.calculationDate, config.period)
        
        if (calculation.depreciationAmount <= 0) {
          if (calculation.isFullyDepreciated) {
            result.fullyDepreciatedAssets++
            result.details.push({
              assetId: asset.id,
              itemCode: asset.itemCode,
              description: asset.description,
              depreciationAmount: 0,
              newBookValue: calculation.bookValueEnd,
              status: 'FULLY_DEPRECIATED'
            })
          }
          continue
        }

        // Add to results
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

        // Prepare database operations (only if not dry run)
        if (!config.dryRun) {
          depreciationRecords.push({
            assetId: asset.id,
            businessUnitId: config.businessUnitId,
            depreciationDate: config.calculationDate,
            periodStartDate: calculation.periodStartDate,
            periodEndDate: calculation.periodEndDate,
            bookValueStart: calculation.bookValueStart,
            depreciationAmount: calculation.depreciationAmount,
            bookValueEnd: calculation.bookValueEnd,
            accumulatedDepreciation: calculation.newAccumulatedDepreciation,
            method: asset.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
            calculatedBy: session.user.id,
            notes: `Automated ${config.period.toLowerCase()} depreciation calculation`
          })

          assetUpdates.push({
            id: asset.id,
            currentBookValue: calculation.bookValueEnd,
            accumulatedDepreciation: calculation.newAccumulatedDepreciation,
            lastDepreciationDate: config.calculationDate,
            nextDepreciationDate: calculation.nextDepreciationDate,
            isFullyDepreciated: calculation.isFullyDepreciated
          })

          historyEntries.push({
            assetId: asset.id,
            action: 'DEPRECIATION_CALCULATED',
            notes: `Automated ${config.period.toLowerCase()} depreciation: ₱${calculation.depreciationAmount.toLocaleString()}. New book value: ₱${calculation.bookValueEnd.toLocaleString()}`,
            performedById: session.user.id,
            businessUnitId: config.businessUnitId
          })
        }

      } catch (error) {
        result.failedCalculations++
        result.details.push({
          assetId: asset.id,
          itemCode: asset.itemCode,
          description: asset.description,
          depreciationAmount: 0,
          newBookValue: Number(asset.currentBookValue || 0),
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Execute database operations if not dry run
    if (!config.dryRun && depreciationRecords.length > 0) {
      await prisma.$transaction([
        // Create depreciation records
        ...depreciationRecords.map(record =>
          prisma.assetDepreciation.create({ data: record })
        ),
        // Update assets
        ...assetUpdates.map(update =>
          prisma.asset.update({
            where: { id: update.id },
            data: {
              currentBookValue: update.currentBookValue,
              accumulatedDepreciation: update.accumulatedDepreciation,
              lastDepreciationDate: update.lastDepreciationDate,
              nextDepreciationDate: update.nextDepreciationDate,
              isFullyDepreciated: update.isFullyDepreciated
            }
          })
        ),
        // Create history entries
        ...historyEntries.map(entry =>
          prisma.assetHistory.create({ data: entry })
        )
      ])

      // Revalidate paths
      revalidatePath(`/${config.businessUnitId}/asset-management/depreciation`)
      revalidatePath(`/${config.businessUnitId}/asset-management/assets`)
    }

    // Generate summary
    result.summary = generateDepreciationSummary(result.details, assets)

    return result

  } catch (error) {
    console.error("Error running automated depreciation:", error)
    throw new Error("Failed to run automated depreciation")
  }
}

function shouldCalculateDepreciation(asset: any, calculationDate: Date, period: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY') {
  const depreciationStartDate = new Date(asset.depreciationStartDate)
  const lastDepreciationDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : null
  const nextDepreciationDate = asset.nextDepreciationDate ? new Date(asset.nextDepreciationDate) : null

  // Check if depreciation start date has passed
  if (depreciationStartDate > calculationDate) {
    return { should: false, reason: 'Depreciation start date not reached' }
  }

  // Check if already fully depreciated
  if (asset.isFullyDepreciated) {
    return { should: false, reason: 'Asset is fully depreciated' }
  }

  // Check based on period
  switch (period) {
    case 'MONTHLY':
      // Calculate monthly if no last depreciation or if it's been a month
      if (!lastDepreciationDate) {
        return { should: true, reason: 'First depreciation calculation' }
      }
      
      const monthsSinceLastDepreciation = 
        (calculationDate.getFullYear() - lastDepreciationDate.getFullYear()) * 12 + 
        (calculationDate.getMonth() - lastDepreciationDate.getMonth())
      
      if (monthsSinceLastDepreciation >= 1) {
        return { should: true, reason: `${monthsSinceLastDepreciation} month(s) since last calculation` }
      }
      break

    case 'QUARTERLY':
      if (!lastDepreciationDate) {
        return { should: true, reason: 'First depreciation calculation' }
      }
      
      const quartersSinceLastDepreciation = Math.floor(
        ((calculationDate.getFullYear() - lastDepreciationDate.getFullYear()) * 12 + 
        (calculationDate.getMonth() - lastDepreciationDate.getMonth())) / 3
      )
      
      if (quartersSinceLastDepreciation >= 1) {
        return { should: true, reason: `${quartersSinceLastDepreciation} quarter(s) since last calculation` }
      }
      break

    case 'ANNUALLY':
      if (!lastDepreciationDate) {
        return { should: true, reason: 'First depreciation calculation' }
      }
      
      const yearsSinceLastDepreciation = calculationDate.getFullYear() - lastDepreciationDate.getFullYear()
      
      if (yearsSinceLastDepreciation >= 1) {
        return { should: true, reason: `${yearsSinceLastDepreciation} year(s) since last calculation` }
      }
      break
  }

  // Check if next depreciation date has passed
  if (nextDepreciationDate && calculationDate >= nextDepreciationDate) {
    return { should: true, reason: 'Next depreciation date reached' }
  }

  return { should: false, reason: 'Not due for depreciation yet' }
}

function calculateAssetDepreciation(asset: any, calculationDate: Date, period: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY') {
  const purchasePrice = Number(asset.purchasePrice)
  const salvageValue = Number(asset.salvageValue || 0)
  const currentBookValue = Number(asset.currentBookValue || purchasePrice)
  const accumulatedDepreciation = Number(asset.accumulatedDepreciation || 0)
  const monthlyDepreciation = Number(asset.monthlyDepreciation || 0)

  // Calculate period multiplier
  let periodMultiplier = 1
  switch (period) {
    case 'MONTHLY':
      periodMultiplier = 1
      break
    case 'QUARTERLY':
      periodMultiplier = 3
      break
    case 'ANNUALLY':
      periodMultiplier = 12
      break
  }

  // Calculate period dates
  const lastDepDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : asset.depreciationStartDate
  const periodStartDate = lastDepDate ? new Date(lastDepDate.getFullYear(), lastDepDate.getMonth() + 1, 1) : 
    new Date(calculationDate.getFullYear(), calculationDate.getMonth(), 1)
  const periodEndDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + periodMultiplier, 0)

  let depreciationAmount = 0

  switch (asset.depreciationMethod) {
    case DepreciationMethod.STRAIGHT_LINE:
      depreciationAmount = monthlyDepreciation * periodMultiplier
      break

    case DepreciationMethod.DECLINING_BALANCE:
      const rate = Number(asset.depreciationRate || 0) / 100
      depreciationAmount = currentBookValue * (rate / 12) * periodMultiplier
      break

    case DepreciationMethod.UNITS_OF_PRODUCTION:
      // This would need actual usage data - for now use monthly amount
      depreciationAmount = monthlyDepreciation * periodMultiplier
      break

    case DepreciationMethod.SUM_OF_YEARS_DIGITS:
      depreciationAmount = monthlyDepreciation * periodMultiplier
      break

    default:
      depreciationAmount = monthlyDepreciation * periodMultiplier
  }

  // Ensure we don't depreciate below salvage value
  const maxDepreciation = currentBookValue - salvageValue
  depreciationAmount = Math.min(depreciationAmount, maxDepreciation)
  depreciationAmount = Math.max(0, depreciationAmount)

  const bookValueEnd = currentBookValue - depreciationAmount
  const newAccumulatedDepreciation = accumulatedDepreciation + depreciationAmount
  const isFullyDepreciated = bookValueEnd <= salvageValue

  // Calculate next depreciation date
  let nextDepreciationDate: Date | null = null
  if (!isFullyDepreciated) {
    switch (period) {
      case 'MONTHLY':
        nextDepreciationDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 1)
        break
      case 'QUARTERLY':
        nextDepreciationDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 3, 1)
        break
      case 'ANNUALLY':
        nextDepreciationDate = new Date(calculationDate.getFullYear() + 1, calculationDate.getMonth(), 1)
        break
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

function generateDepreciationSummary(details: any[], assets: any[]) {
  const successfulDetails = details.filter(d => d.status === 'SUCCESS')
  
  // Group by category
  const categoryGroups = successfulDetails.reduce((acc, detail) => {
    const asset = assets.find(a => a.id === detail.assetId)
    if (asset) {
      const categoryId = asset.categoryId
      const categoryName = asset.category.name
      if (!acc[categoryId]) {
        acc[categoryId] = { categoryName, assetsCount: 0, totalDepreciation: 0 }
      }
      acc[categoryId].assetsCount++
      acc[categoryId].totalDepreciation += detail.depreciationAmount
    }
    return acc
  }, {} as Record<string, { categoryName: string; assetsCount: number; totalDepreciation: number }>)

  const byCategory = Object.entries(categoryGroups).map(([categoryId, data]) => ({
    categoryId,
    categoryName: (data as { categoryName: string; assetsCount: number; totalDepreciation: number }).categoryName,
    assetsCount: (data as { categoryName: string; assetsCount: number; totalDepreciation: number }).assetsCount,
    totalDepreciation: (data as { categoryName: string; assetsCount: number; totalDepreciation: number }).totalDepreciation
  }))

  // Group by method
  const methodGroups = successfulDetails.reduce((acc, detail) => {
    const asset = assets.find(a => a.id === detail.assetId)
    if (asset) {
      const method = asset.depreciationMethod || DepreciationMethod.STRAIGHT_LINE
      if (!acc[method]) {
        acc[method] = { assetsCount: 0, totalDepreciation: 0 }
      }
      acc[method].assetsCount++
      acc[method].totalDepreciation += detail.depreciationAmount
    }
    return acc
  }, {} as Record<string, { assetsCount: number; totalDepreciation: number }>)

  const byMethod = Object.entries(methodGroups).map(([method, data]) => ({
    method: method as DepreciationMethod,
    assetsCount: (data as { assetsCount: number; totalDepreciation: number }).assetsCount,
    totalDepreciation: (data as { assetsCount: number; totalDepreciation: number }).totalDepreciation
  }))

  return { byCategory, byMethod }
}

export async function getDepreciationSchedulePreview(config: AutomatedDepreciationConfig) {
  // Run in dry-run mode to preview results
  return await runAutomatedDepreciation({ ...config, dryRun: true })
}