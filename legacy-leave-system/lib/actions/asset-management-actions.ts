"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus, DeploymentStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface AssetWithDetails {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  modelNumber: string | null
  brand: string | null
  specifications: Record<string, unknown> | null
  purchaseDate: Date | null
  purchasePrice: number | null
  warrantyExpiry: Date | null
  quantity: number
  status: AssetStatus
  location: string | null
  notes: string | null
  isActive: boolean
  salvageValue: number | null
  currentBookValue: number | null
  accumulatedDepreciation: number
  monthlyDepreciation: number | null
  depreciationRate: number | null
  depreciationPerUnit: number | null
  // Pre-depreciation fields
  originalPurchasePrice: number | null
  priorDepreciationAmount: number
  systemEntryBookValue: number | null
  barcodeValue: string | null
  tagNumber: string | null
  currentlyAssignedTo: string | null
  lastAssignedDate: Date | null
  createdAt: Date
  updatedAt: Date
  category: {
    id: string
    name: string
    code: string
  }
  businessUnit: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code: string | null
  } | null
  createdBy: {
    id: string
    name: string
    employeeId: string
  }
  currentDeployment: {
    id: string
    transmittalNumber: string
    status: DeploymentStatus
    deployedDate: Date | null
    expectedReturnDate: Date | null
    employee: {
      id: string
      name: string
      employeeId: string
    }
  } | null
}

export interface AssetsResponse {
  assets: AssetWithDetails[]
  totalCount: number
  categories: { id: string; name: string; code: string; count: number }[]
  statuses: { status: AssetStatus; count: number }[]
}

export interface AssetFilters {
  businessUnitId: string
  categoryId?: string
  status?: AssetStatus
  isActive?: boolean
  search?: string
  assignedTo?: string
  page?: number
  limit?: number
}

export async function getAssets(filters: AssetFilters): Promise<AssetsResponse> {
  try {
    const {
      businessUnitId,
      categoryId,
      status,
      isActive,
      search,
      assignedTo,
      page = 1,
      limit = 20
    } = filters

    const where = {
      businessUnitId,
      ...(categoryId && { categoryId }),
      ...(status && { status }),
      ...(isActive !== undefined && { isActive }),
      ...(assignedTo && { currentlyAssignedTo: assignedTo }),
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { serialNumber: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } },
          { modelNumber: { contains: search, mode: 'insensitive' as const } },
          { tagNumber: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [assets, totalCount, categoryStats, statusStats] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              employeeId: true
            }
          },
          deployments: {
            where: {
              status: {
                in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED]
              },
              returnedDate: null // Only get deployments that haven't been returned
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
            orderBy: {
              deployedDate: 'desc'
            },
            take: 1
          }
        },
        orderBy: [
          { itemCode: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.asset.count({ where }),
      prisma.asset.groupBy({
        by: ['categoryId'],
        where: { businessUnitId },
        _count: {
          categoryId: true
        },
        orderBy: {
          _count: {
            categoryId: 'desc'
          }
        }
      }),
      prisma.asset.groupBy({
        by: ['status'],
        where: { businessUnitId },
        _count: {
          status: true
        }
      })
    ])

    // Get category details for stats
    const categoryIds = categoryStats.map(stat => stat.categoryId)
    const categories = await prisma.assetCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, code: true }
    })

    const categoriesWithCount = categoryStats.map(stat => {
      const category = categories.find(c => c.id === stat.categoryId)
      return {
        id: stat.categoryId,
        name: category?.name || 'Unknown',
        code: category?.code || 'UNK',
        count: stat._count.categoryId
      }
    })

    const statuses = statusStats.map(stat => ({
      status: stat.status,
      count: stat._count.status
    }))

    // Transform assets to include current deployment and convert all Decimal fields to numbers
    const transformedAssets: AssetWithDetails[] = assets.map(asset => ({
      ...asset,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      originalPurchasePrice: asset.originalPurchasePrice ? Number(asset.originalPurchasePrice) : null,
      salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
      depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
      depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(asset.priorDepreciationAmount),
      systemEntryBookValue: asset.systemEntryBookValue ? Number(asset.systemEntryBookValue) : null,
      specifications: asset.specifications as Record<string, unknown> | null,
      currentDeployment: asset.deployments[0] ? {
        id: asset.deployments[0].id,
        transmittalNumber: asset.deployments[0].transmittalNumber,
        status: asset.deployments[0].status,
        deployedDate: asset.deployments[0].deployedDate,
        expectedReturnDate: asset.deployments[0].expectedReturnDate,
        employee: asset.deployments[0].employee
      } : null
    }))

    return {
      assets: transformedAssets,
      totalCount,
      categories: categoriesWithCount,
      statuses
    }
  } catch (error) {
    console.error("Error fetching assets:", error)
    throw new Error("Failed to fetch assets")
  }
}

export async function updateAssetStatus(assetId: string, status: AssetStatus, businessUnitId: string) {
  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: { status }
    })

    revalidatePath(`/${businessUnitId}/asset-management/assets`)
    return { success: `Asset status updated to ${status}` }
  } catch (error) {
    console.error("Error updating asset status:", error)
    return { error: "Failed to update asset status" }
  }
}

export async function toggleAssetActiveStatus(assetId: string, isActive: boolean, businessUnitId: string) {
  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: { isActive }
    })

    revalidatePath(`/${businessUnitId}/asset-management/assets`)
    return { success: `Asset ${isActive ? 'activated' : 'deactivated'} successfully` }
  } catch (error) {
    console.error("Error toggling asset status:", error)
    return { error: "Failed to update asset status" }
  }
}

export async function deleteAsset(assetId: string, businessUnitId: string) {
  try {
    // Check if asset has active deployments
    const activeDeployments = await prisma.assetDeployment.count({
      where: {
        assetId,
        status: {
          in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED, DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]
        }
      }
    })

    if (activeDeployments > 0) {
      return { error: "Cannot delete asset with active deployments" }
    }

    await prisma.asset.delete({
      where: { id: assetId }
    })

    revalidatePath(`/${businessUnitId}/asset-management/assets`)
    return { success: "Asset deleted successfully" }
  } catch (error) {
    console.error("Error deleting asset:", error)
    return { error: "Failed to delete asset" }
  }
}