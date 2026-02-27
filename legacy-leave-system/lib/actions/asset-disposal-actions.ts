"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface DisposableAssetData {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  brand: string | null
  purchasePrice: number | null
  purchaseDate: Date | null
  currentBookValue: number | null
  accumulatedDepreciation: number
  status: AssetStatus
  category: {
    id: string
    name: string
  }
  currentlyAssignedTo: string | null
  assignedEmployee?: {
    id: string
    name: string
    employeeId: string
  } | null
}

export interface DisposableAssetsResponse {
  assets: DisposableAssetData[]
  totalCount: number
  categories: { id: string; name: string; count: number }[]
}

export interface GetDisposableAssetsFilters {
  businessUnitId: string
  categoryId?: string
  search?: string
  page?: number
  limit?: number
}

export async function getDisposableAssets(filters: GetDisposableAssetsFilters): Promise<DisposableAssetsResponse> {
  try {
    const {
      businessUnitId,
      categoryId,
      search,
      page = 1,
      limit = 20
    } = filters

    const where = {
      businessUnitId,
      status: {
        in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE, AssetStatus.DAMAGED]
      },
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { serialNumber: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [assets, totalCount, categories] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          },
          deployments: {
            where: {
              returnedDate: null,
              status: 'DEPLOYED'
            },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeId: true
                }
              }
            },
            take: 1
          }
        },
        orderBy: [
          { itemCode: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.asset.count({ where }),
      prisma.asset.groupBy({
        by: ['categoryId'],
        where: {
          businessUnitId,
          status: {
            in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE, AssetStatus.DAMAGED]
          }
        },
        _count: {
          categoryId: true
        }
      })
    ])

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

    // Transform assets to include proper types
    const transformedAssets: DisposableAssetData[] = assets.map(asset => ({
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      serialNumber: asset.serialNumber,
      brand: asset.brand,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      purchaseDate: asset.purchaseDate,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      status: asset.status,
      category: asset.category,
      currentlyAssignedTo: asset.currentlyAssignedTo,
      assignedEmployee: asset.deployments[0]?.employee || null
    }))

    return {
      assets: transformedAssets,
      totalCount,
      categories: categoriesWithNames
    }
  } catch (error) {
    console.error("Error fetching disposable assets:", error)
    throw new Error("Failed to fetch disposable assets")
  }
}

export interface DisposeAssetsData {
  assetIds: string[]
  disposalDate: Date
  disposalMethod: 'SALE' | 'SCRAP' | 'DONATION' | 'TRADE_IN' | 'DESTRUCTION' | 'OTHER'
  disposalLocation?: string
  disposalValue?: number
  disposalCost?: number
  disposalReason: 'SOLD' | 'DONATED' | 'SCRAPPED' | 'LOST' | 'STOLEN' | 'TRANSFERRED' | 'END_OF_LIFE' | 'DAMAGED_BEYOND_REPAIR' | 'OBSOLETE' | 'REGULATORY_COMPLIANCE'
  disposalNotes?: string
  approvedBy?: string
  businessUnitId: string
}

export async function disposeAssets(data: DisposeAssetsData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Validate that all assets exist and can be disposed
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: data.assetIds },
        businessUnitId: data.businessUnitId,
        status: {
          in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE, AssetStatus.DAMAGED]
        }
      },
      include: {
        deployments: {
          where: {
            returnedDate: null
          }
        }
      }
    })

    if (assets.length !== data.assetIds.length) {
      return { error: "Some assets cannot be disposed or not found" }
    }

    // Check if any assets are currently deployed
    const deployedAssets = assets.filter(asset => asset.deployments.length > 0)
    if (deployedAssets.length > 0) {
      return { 
        error: `Assets ${deployedAssets.map(a => a.itemCode).join(', ')} are currently deployed and must be returned before disposal` 
      }
    }

    // Calculate disposal values and gains/losses
    const disposalRecords = assets.map(asset => {
      const bookValue = asset.currentBookValue ? Number(asset.currentBookValue) : 0
      const disposalValue = data.disposalValue || 0
      const disposalCost = data.disposalCost || 0
      const netDisposalValue = disposalValue - disposalCost
      const gainLoss = netDisposalValue - bookValue

      return {
        assetId: asset.id,
        disposalDate: data.disposalDate,
        reason: data.disposalReason,
        disposalMethod: data.disposalMethod,
        disposalLocation: data.disposalLocation,
        disposalValue: data.disposalValue,
        disposalCost: data.disposalCost,
        netDisposalValue,
        bookValueAtDisposal: bookValue,
        gainLoss,
        notes: data.disposalNotes,
        approvedBy: data.approvedBy,
        businessUnitId: data.businessUnitId,
        createdBy: session.user.id
      }
    })

    // Create disposal records
    const createDisposalPromises = disposalRecords.map(record =>
      prisma.assetDisposal.create({
        data: record
      })
    )

    // Update assets to disposed status
    const updateAssetPromises = data.assetIds.map(assetId =>
      prisma.asset.update({
        where: { id: assetId },
        data: {
          status: AssetStatus.DISPOSED,
          currentlyAssignedTo: null
        }
      })
    )

    // Create asset history entries
    const historyPromises = assets.map(asset => {
      const record = disposalRecords.find(r => r.assetId === asset.id)!
      return prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'DISPOSED',
          notes: `Asset disposed via ${data.disposalMethod}. Reason: ${data.disposalReason}. Book Value: ₱${record.bookValueAtDisposal.toLocaleString()}, Disposal Value: ₱${(data.disposalValue || 0).toLocaleString()}, Gain/Loss: ₱${record.gainLoss.toLocaleString()}`,
          performedById: session.user.id,
          businessUnitId: data.businessUnitId
        }
      })
    })

    // Execute all operations in a transaction
    await prisma.$transaction([
      ...createDisposalPromises,
      ...updateAssetPromises,
      ...historyPromises
    ])

    revalidatePath(`/${data.businessUnitId}/asset-management/disposals`)
    revalidatePath(`/${data.businessUnitId}/asset-management/assets`)

    const totalGainLoss = disposalRecords.reduce((sum, record) => sum + record.gainLoss, 0)
    const gainLossText = totalGainLoss >= 0 ? `gain of ₱${totalGainLoss.toLocaleString()}` : `loss of ₱${Math.abs(totalGainLoss).toLocaleString()}`

    return { 
      success: `Successfully disposed ${data.assetIds.length} assets with a ${gainLossText}`,
      totalGainLoss
    }
  } catch (error) {
    console.error("Error disposing assets:", error)
    return { error: "Failed to dispose assets" }
  }
}

