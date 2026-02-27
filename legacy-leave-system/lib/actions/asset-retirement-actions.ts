"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface RetirableAssetData {
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
  isFullyDepreciated: boolean
  usefulLifeYears: number | null
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

export interface RetirableAssetsResponse {
  assets: RetirableAssetData[]
  totalCount: number
  categories: { id: string; name: string; count: number }[]
}

export interface GetRetirableAssetsFilters {
  businessUnitId: string
  categoryId?: string
  search?: string
  page?: number
  limit?: number
}

export async function getRetirableAssets(filters: GetRetirableAssetsFilters): Promise<RetirableAssetsResponse> {
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
          { isFullyDepreciated: 'desc' }, // Show fully depreciated assets first
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
    const transformedAssets: RetirableAssetData[] = assets.map(asset => ({
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
      isFullyDepreciated: asset.isFullyDepreciated,
      usefulLifeYears: asset.usefulLifeYears,
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
    console.error("Error fetching retirable assets:", error)
    throw new Error("Failed to fetch retirable assets")
  }
}

export interface RetireAssetsData {
  assetIds: string[]
  retirementDate: Date
  reason: 'END_OF_USEFUL_LIFE' | 'FULLY_DEPRECIATED' | 'OBSOLETE' | 'DAMAGED_BEYOND_REPAIR' | 'POLICY_CHANGE' | 'UPGRADE_REPLACEMENT'
  retirementMethod?: string
  condition?: string
  notes?: string
  replacementAssetId?: string
  disposalPlanned: boolean
  disposalDate?: Date
  approvedBy?: string
  businessUnitId: string
}

export async function retireAssets(data: RetireAssetsData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Validate that all assets exist and can be retired
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
        },
        retirement: true // Check if already retired
      }
    })

    if (assets.length !== data.assetIds.length) {
      return { error: "Some assets cannot be retired or not found" }
    }

    // Check if any assets are already retired
    const alreadyRetiredAssets = assets.filter(asset => asset.retirement)
    if (alreadyRetiredAssets.length > 0) {
      return { 
        error: `Assets ${alreadyRetiredAssets.map(a => a.itemCode).join(', ')} are already retired` 
      }
    }

    // Check if any assets are currently deployed (optional warning, but allow retirement)
    const deployedAssets = assets.filter(asset => asset.deployments.length > 0)
    
    // Validate replacement asset if provided
    let replacementAsset = null
    if (data.replacementAssetId) {
      replacementAsset = await prisma.asset.findFirst({
        where: {
          id: data.replacementAssetId,
          businessUnitId: data.businessUnitId,
          status: AssetStatus.AVAILABLE
        }
      })
      
      if (!replacementAsset) {
        return { error: "Replacement asset not found or not available" }
      }
    }

    // Create retirement records
    const retirementRecords = data.assetIds.map(assetId => ({
      assetId,
      businessUnitId: data.businessUnitId,
      retirementDate: data.retirementDate,
      reason: data.reason,
      retirementMethod: data.retirementMethod,
      condition: data.condition,
      notes: data.notes,
      replacementAssetId: data.replacementAssetId,
      disposalPlanned: data.disposalPlanned,
      disposalDate: data.disposalDate,
      approvedBy: data.approvedBy,
      createdBy: session.user.id
    }))

    const createRetirementPromises = retirementRecords.map(record =>
      prisma.assetRetirement.create({
        data: record
      })
    )

    // Update assets to retired status
    const updateAssetPromises = data.assetIds.map(assetId =>
      prisma.asset.update({
        where: { id: assetId },
        data: {
          status: AssetStatus.RETIRED,
          currentlyAssignedTo: null
        }
      })
    )

    // Close any active deployments
    const closeDeploymentPromises = deployedAssets.flatMap(asset =>
      asset.deployments.map(deployment =>
        prisma.assetDeployment.update({
          where: { id: deployment.id },
          data: {
            returnedDate: data.retirementDate,
            status: 'RETURNED',
            returnNotes: `Asset retired. Reason: ${data.reason}`
          }
        })
      )
    )

    // Create asset history entries
    const historyPromises = assets.map(asset => 
      prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'RETIRED',
          notes: `Asset retired. Reason: ${data.reason}. ${data.replacementAssetId ? `Replacement Asset: ${replacementAsset?.itemCode}` : ''}${data.notes ? ` Notes: ${data.notes}` : ''}`,
          performedById: session.user.id,
          businessUnitId: data.businessUnitId
        }
      })
    )

    // Execute all operations in a transaction
    await prisma.$transaction([
      ...createRetirementPromises,
      ...updateAssetPromises,
      ...closeDeploymentPromises,
      ...historyPromises
    ])

    revalidatePath(`/${data.businessUnitId}/asset-management/retirements`)
    revalidatePath(`/${data.businessUnitId}/asset-management/assets`)

    const warningMessage = deployedAssets.length > 0 
      ? ` Note: ${deployedAssets.length} deployed asset(s) were automatically returned.`
      : ''

    return { 
      success: `Successfully retired ${data.assetIds.length} assets.${warningMessage}`,
      deployedAssetsReturned: deployedAssets.length
    }
  } catch (error) {
    console.error("Error retiring assets:", error)
    return { error: "Failed to retire assets" }
  }
}

export async function getAvailableReplacementAssets(businessUnitId: string, categoryId?: string) {
  try {
    const assets = await prisma.asset.findMany({
      where: {
        businessUnitId,
        status: AssetStatus.AVAILABLE,
        ...(categoryId && { categoryId })
      },
      select: {
        id: true,
        itemCode: true,
        description: true,
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        itemCode: 'asc'
      }
    })

    return assets
  } catch (error) {
    console.error("Error fetching replacement assets:", error)
    throw new Error("Failed to fetch replacement assets")
  }
}

export async function getRetirementHistory(businessUnitId: string, page = 1, limit = 20) {
  try {
    const retirements = await prisma.assetRetirement.findMany({
      where: {
        businessUnitId
      },
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
        replacementAsset: {
          select: {
            id: true,
            itemCode: true,
            description: true
          }
        },
        createdByEmployee: {
          select: {
            name: true
          }
        },
        approvedByEmployee: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        retirementDate: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const totalCount = await prisma.assetRetirement.count({
      where: {
        businessUnitId
      }
    })

    return {
      retirements,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error("Error fetching retirement history:", error)
    throw new Error("Failed to fetch retirement history")
  }
}