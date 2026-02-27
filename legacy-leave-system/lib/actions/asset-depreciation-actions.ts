"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus, DepreciationMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface DepreciationAssetData {
  id: string
  itemCode: string
  description: string
  purchasePrice: number | null
  purchaseDate: Date | null
  currentBookValue: number | null
  accumulatedDepreciation: number
  monthlyDepreciation: number | null
  depreciationMethod: DepreciationMethod | null
  usefulLifeYears: number | null
  usefulLifeMonths: number | null
  salvageValue: number | null
  depreciationStartDate: Date | null
  lastDepreciationDate: Date | null
  nextDepreciationDate: Date | null
  isFullyDepreciated: boolean
  status: AssetStatus
  category: {
    id: string
    name: string
  }
  depreciationRate: number | null
  totalExpectedUnits: number | null
  currentUnits: number
  depreciationPerUnit: number | null
}

export interface DepreciationHistoryData {
  id: string
  assetId: string
  depreciationDate: Date
  periodStartDate: Date
  periodEndDate: Date
  bookValueStart: number
  depreciationAmount: number
  bookValueEnd: number
  accumulatedDepreciation: number
  method: DepreciationMethod
  isAdjustment: boolean
  adjustmentReason: string | null
  notes: string | null
  asset: {
    itemCode: string
    description: string
  }
}

export interface DepreciationSummary {
  totalAssets: number
  totalPurchaseValue: number
  totalCurrentBookValue: number
  totalAccumulatedDepreciation: number
  totalMonthlyDepreciation: number
  fullyDepreciatedCount: number
  assetsNeedingDepreciation: number
  byMethod: {
    method: DepreciationMethod
    count: number
    totalBookValue: number
  }[]
  byCategory: {
    categoryId: string
    categoryName: string
    count: number
    totalBookValue: number
    totalDepreciation: number
  }[]
}

export interface DepreciationDataResponse {
  summary: DepreciationSummary
  assets: DepreciationAssetData[]
  history: DepreciationHistoryData[]
  totalCount: number
  categories: { id: string; name: string; count: number }[]
}

export interface GetDepreciationDataFilters {
  businessUnitId: string
  categoryId?: string
  search?: string
  page?: number
  limit?: number
  view: 'overview' | 'schedule' | 'history'
  period?: string
}

export async function getDepreciationData(filters: GetDepreciationDataFilters): Promise<DepreciationDataResponse> {
  try {
    const {
      businessUnitId,
      categoryId,
      search,
      page = 1,
      limit = 20,
      view,
      period
    } = filters

    const baseWhere = {
      businessUnitId,
      status: {
        in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
      },
      purchasePrice: { not: null },
      depreciationStartDate: { not: null }, // Only include assets with depreciation setup
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    // Get summary data
    const [summaryAssets, categories] = await Promise.all([
      prisma.asset.findMany({
        where: baseWhere,
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.asset.groupBy({
        by: ['categoryId'],
        where: baseWhere,
        _count: {
          categoryId: true
        }
      })
    ])

    // Calculate summary
    const summary = calculateDepreciationSummary(summaryAssets)

    // Get category names
    const categoryIds = categories.map(cat => cat.categoryId)
    const categoryDetails = await prisma.assetCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    })

    const categoriesWithNames = categories.map(cat => {
      const categoryDetail = categoryDetails.find(detail => detail.id === cat.categoryId)
      return {
        id: cat.categoryId,
        name: categoryDetail?.name || 'Unknown',
        count: cat._count.categoryId
      }
    })

    let assets: DepreciationAssetData[] = []
    let history: DepreciationHistoryData[] = []
    let totalCount = 0

    if (view === 'overview' || view === 'schedule') {
      // Get assets for overview/schedule view
      const assetsQuery = await prisma.asset.findMany({
        where: baseWhere,
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { nextDepreciationDate: 'asc' },
          { itemCode: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      })

      totalCount = await prisma.asset.count({ where: baseWhere })

      assets = assetsQuery.map(asset => ({
        id: asset.id,
        itemCode: asset.itemCode,
        description: asset.description,
        purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
        purchaseDate: asset.purchaseDate,
        currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
        accumulatedDepreciation: Number(asset.accumulatedDepreciation),
        monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
        depreciationMethod: asset.depreciationMethod,
        usefulLifeYears: asset.usefulLifeYears,
        usefulLifeMonths: asset.usefulLifeMonths,
        salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
        depreciationStartDate: asset.depreciationStartDate,
        lastDepreciationDate: asset.lastDepreciationDate,
        nextDepreciationDate: asset.nextDepreciationDate,
        isFullyDepreciated: asset.isFullyDepreciated,
        status: asset.status,
        category: asset.category,
        depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
        totalExpectedUnits: asset.totalExpectedUnits,
        currentUnits: asset.currentUnits,
        depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null
      }))
    }

    if (view === 'history') {
      // Get depreciation history
      const historyWhere: any = {
        businessUnitId
      }

      if (period) {
        const [year, month] = period.split('-')
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
        const endDate = new Date(parseInt(year), parseInt(month), 0)
        historyWhere.depreciationDate = {
          gte: startDate,
          lte: endDate
        }
      }

      const historyQuery = await prisma.assetDepreciation.findMany({
        where: historyWhere,
        include: {
          asset: {
            select: {
              itemCode: true,
              description: true
            }
          }
        },
        orderBy: {
          depreciationDate: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      })

      totalCount = await prisma.assetDepreciation.count({ where: historyWhere })

      history = historyQuery.map(record => ({
        id: record.id,
        assetId: record.assetId,
        depreciationDate: record.depreciationDate,
        periodStartDate: record.periodStartDate,
        periodEndDate: record.periodEndDate,
        bookValueStart: Number(record.bookValueStart),
        depreciationAmount: Number(record.depreciationAmount),
        bookValueEnd: Number(record.bookValueEnd),
        accumulatedDepreciation: Number(record.accumulatedDepreciation),
        method: record.method,
        isAdjustment: record.isAdjustment,
        adjustmentReason: record.adjustmentReason,
        notes: record.notes,
        asset: record.asset
      }))
    }

    return {
      summary,
      assets,
      history,
      totalCount,
      categories: categoriesWithNames
    }
  } catch (error) {
    console.error("Error fetching depreciation data:", error)
    throw new Error("Failed to fetch depreciation data")
  }
}

function calculateDepreciationSummary(assets: any[]): DepreciationSummary {
  const totalAssets = assets.length
  const totalPurchaseValue = assets.reduce((sum, asset) => 
    sum + (asset.purchasePrice ? Number(asset.purchasePrice) : 0), 0)
  const totalCurrentBookValue = assets.reduce((sum, asset) => 
    sum + (asset.currentBookValue ? Number(asset.currentBookValue) : 0), 0)
  const totalAccumulatedDepreciation = assets.reduce((sum, asset) => 
    sum + Number(asset.accumulatedDepreciation), 0)
  const totalMonthlyDepreciation = assets.reduce((sum, asset) => 
    sum + (asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : 0), 0)
  const fullyDepreciatedCount = assets.filter(asset => asset.isFullyDepreciated).length
  const assetsNeedingDepreciation = assets.filter(asset => 
    asset.nextDepreciationDate && new Date(asset.nextDepreciationDate) <= new Date()).length

  // Group by method
  const methodGroups = assets.reduce((acc, asset) => {
    const method = asset.depreciationMethod || 'STRAIGHT_LINE'
    if (!acc[method]) {
      acc[method] = { count: 0, totalBookValue: 0 }
    }
    acc[method].count++
    acc[method].totalBookValue += asset.currentBookValue ? Number(asset.currentBookValue) : 0
    return acc
  }, {} as Record<string, { count: number; totalBookValue: number }>)

  const byMethod = Object.entries(methodGroups).map(([method, data]) => ({
    method: method as DepreciationMethod,
    count: (data as { count: number; totalBookValue: number }).count,
    totalBookValue: (data as { count: number; totalBookValue: number }).totalBookValue
  }))

  // Group by category
  const categoryGroups = assets.reduce((acc, asset) => {
    const categoryId = asset.categoryId
    const categoryName = asset.category.name
    if (!acc[categoryId]) {
      acc[categoryId] = { 
        categoryName, 
        count: 0, 
        totalBookValue: 0, 
        totalDepreciation: 0 
      }
    }
    acc[categoryId].count++
    acc[categoryId].totalBookValue += asset.currentBookValue ? Number(asset.currentBookValue) : 0
    acc[categoryId].totalDepreciation += Number(asset.accumulatedDepreciation)
    return acc
  }, {} as Record<string, { categoryName: string; count: number; totalBookValue: number; totalDepreciation: number }>)

  const byCategory = Object.entries(categoryGroups).map(([categoryId, data]) => ({
    categoryId,
    categoryName: (data as { categoryName: string; count: number; totalBookValue: number; totalDepreciation: number }).categoryName,
    count: (data as { categoryName: string; count: number; totalBookValue: number; totalDepreciation: number }).count,
    totalBookValue: (data as { categoryName: string; count: number; totalBookValue: number; totalDepreciation: number }).totalBookValue,
    totalDepreciation: (data as { categoryName: string; count: number; totalBookValue: number; totalDepreciation: number }).totalDepreciation
  }))

  return {
    totalAssets,
    totalPurchaseValue,
    totalCurrentBookValue,
    totalAccumulatedDepreciation,
    totalMonthlyDepreciation,
    fullyDepreciatedCount,
    assetsNeedingDepreciation,
    byMethod,
    byCategory
  }
}

export interface CalculateDepreciationData {
  assetIds: string[]
  calculationDate: Date
  businessUnitId: string
}

export async function calculateDepreciation(data: CalculateDepreciationData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Get assets that need depreciation calculation
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: data.assetIds },
        businessUnitId: data.businessUnitId,
        status: {
          in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
        },
        isFullyDepreciated: false,
        purchasePrice: { not: null },
        depreciationStartDate: { not: null }
      }
    })

    if (assets.length === 0) {
      return { error: "No assets found that need depreciation calculation" }
    }

    const depreciationRecords: {
      assetId: string
      businessUnitId: string
      depreciationDate: Date
      periodStartDate: Date
      periodEndDate: Date
      bookValueStart: number
      depreciationAmount: number
      bookValueEnd: number
      accumulatedDepreciation: number
      method: DepreciationMethod
      calculatedBy: string
      notes: string
    }[] = []
    
    const assetUpdates: {
      id: string
      currentBookValue: number
      accumulatedDepreciation: number
      lastDepreciationDate: Date
      nextDepreciationDate: Date | null
      isFullyDepreciated: boolean
    }[] = []

    for (const asset of assets) {
      const calculation = calculateAssetDepreciation(asset, data.calculationDate)
      
      if (calculation.depreciationAmount > 0) {
        // Create depreciation record
        depreciationRecords.push({
          assetId: asset.id,
          businessUnitId: data.businessUnitId,
          depreciationDate: data.calculationDate,
          periodStartDate: calculation.periodStartDate,
          periodEndDate: calculation.periodEndDate,
          bookValueStart: calculation.bookValueStart,
          depreciationAmount: calculation.depreciationAmount,
          bookValueEnd: calculation.bookValueEnd,
          accumulatedDepreciation: calculation.newAccumulatedDepreciation,
          method: asset.depreciationMethod || DepreciationMethod.STRAIGHT_LINE,
          calculatedBy: session.user.id,
          notes: calculation.notes
        })

        // Update asset
        assetUpdates.push({
          id: asset.id,
          currentBookValue: calculation.bookValueEnd,
          accumulatedDepreciation: calculation.newAccumulatedDepreciation,
          lastDepreciationDate: data.calculationDate,
          nextDepreciationDate: calculation.nextDepreciationDate,
          isFullyDepreciated: calculation.isFullyDepreciated
        })
      }
    }

    if (depreciationRecords.length === 0) {
      return { error: "No depreciation calculations needed for selected assets" }
    }

    // Execute in transaction
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
      ...assetUpdates.map(update =>
        prisma.assetHistory.create({
          data: {
            assetId: update.id,
            action: 'DEPRECIATION_CALCULATED',
            notes: `Depreciation calculated: ₱${depreciationRecords.find(r => r.assetId === update.id)?.depreciationAmount.toLocaleString()}. New book value: ₱${update.currentBookValue.toLocaleString()}`,
            performedById: session.user.id,
            businessUnitId: data.businessUnitId
          }
        })
      )
    ])

    revalidatePath(`/${data.businessUnitId}/asset-management/depreciation`)
    revalidatePath(`/${data.businessUnitId}/asset-management/assets`)

    const totalDepreciation = depreciationRecords.reduce((sum, record) => sum + record.depreciationAmount, 0)

    return { 
      success: `Successfully calculated depreciation for ${depreciationRecords.length} assets. Total depreciation: ₱${totalDepreciation.toLocaleString()}`,
      calculatedAssets: depreciationRecords.length,
      totalDepreciation
    }
  } catch (error) {
    console.error("Error calculating depreciation:", error)
    return { error: "Failed to calculate depreciation" }
  }
}

function calculateAssetDepreciation(asset: any, calculationDate: Date) {
  const purchasePrice = Number(asset.purchasePrice)
  const salvageValue = Number(asset.salvageValue || 0)
  const currentBookValue = Number(asset.currentBookValue || purchasePrice)
  const accumulatedDepreciation = Number(asset.accumulatedDepreciation || 0)
  const depreciableAmount = purchasePrice - salvageValue

  // Calculate period (assuming monthly depreciation)
  const lastDepDate = asset.lastDepreciationDate ? new Date(asset.lastDepreciationDate) : asset.depreciationStartDate
  const periodStartDate = lastDepDate ? new Date(lastDepDate.getFullYear(), lastDepDate.getMonth() + 1, 1) : new Date(calculationDate.getFullYear(), calculationDate.getMonth(), 1)
  const periodEndDate = new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 0)

  let depreciationAmount = 0
  let notes = ""

  switch (asset.depreciationMethod) {
    case DepreciationMethod.STRAIGHT_LINE:
      depreciationAmount = Number(asset.monthlyDepreciation || 0)
      notes = "Straight-line method"
      break

    case DepreciationMethod.DECLINING_BALANCE:
      const rate = Number(asset.depreciationRate || 0) / 100
      depreciationAmount = currentBookValue * (rate / 12)
      notes = `Declining balance method (${asset.depreciationRate}% annual rate)`
      break

    case DepreciationMethod.UNITS_OF_PRODUCTION:
      // This would need actual usage data
      const unitsUsed = 0 // Would come from usage tracking
      depreciationAmount = unitsUsed * Number(asset.depreciationPerUnit || 0)
      notes = `Units of production method (${unitsUsed} units used)`
      break

    case DepreciationMethod.SUM_OF_YEARS_DIGITS:
      // Complex calculation - simplified for monthly
      depreciationAmount = Number(asset.monthlyDepreciation || 0)
      notes = "Sum of years digits method"
      break

    default:
      depreciationAmount = Number(asset.monthlyDepreciation || 0)
      notes = "Default straight-line method"
  }

  // Ensure we don't depreciate below salvage value
  const maxDepreciation = currentBookValue - salvageValue
  depreciationAmount = Math.min(depreciationAmount, maxDepreciation)
  depreciationAmount = Math.max(0, depreciationAmount)

  const bookValueEnd = currentBookValue - depreciationAmount
  const newAccumulatedDepreciation = accumulatedDepreciation + depreciationAmount
  const isFullyDepreciated = bookValueEnd <= salvageValue

  // Calculate next depreciation date
  const nextDepreciationDate = isFullyDepreciated ? null : 
    new Date(calculationDate.getFullYear(), calculationDate.getMonth() + 1, 1)

  return {
    periodStartDate,
    periodEndDate,
    bookValueStart: currentBookValue,
    depreciationAmount,
    bookValueEnd,
    newAccumulatedDepreciation,
    isFullyDepreciated,
    nextDepreciationDate,
    notes
  }
}