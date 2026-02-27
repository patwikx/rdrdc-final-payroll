"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface AssetCategoryData {
  name: string
  code: string
  description?: string
  businessUnitId?: string
  defaultAssetAccountId?: string | null
  defaultDepreciationExpenseAccountId?: string | null
  defaultAccumulatedDepAccountId?: string | null
  isActive: boolean
}

export interface AssetCategoryWithDetails {
  id: string
  name: string
  code: string
  description: string | null
  businessUnitId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  defaultAssetAccountId: string | null
  defaultDepreciationExpenseAccountId: string | null
  defaultAccumulatedDepAccountId: string | null
  defaultAssetAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  defaultDepExpAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  defaultAccDepAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  _count: {
    assets: number
  }
}

export interface CategoriesResponse {
  categories: AssetCategoryWithDetails[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export async function getAssetCategories({
  businessUnitId,
  search,
  page = 1,
  limit = 20
}: {
  businessUnitId: string
  search?: string
  page?: number
  limit?: number
}): Promise<CategoriesResponse> {
  try {
    const skip = (page - 1) * limit

    const where = {
      businessUnitId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [categories, totalCount] = await Promise.all([
      prisma.assetCategory.findMany({
        where,
        include: {
          defaultAssetAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          defaultDepExpAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          defaultAccDepAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          _count: {
            select: {
              assets: true
            }
          }
        },
        orderBy: { name: 'desc' },
        skip,
        take: limit
      }),
      prisma.assetCategory.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return {
      categories,
      totalCount,
      totalPages,
      currentPage: page
    }
  } catch (error) {
    console.error("Error fetching asset categories:", error)
    throw new Error("Failed to fetch asset categories")
  }
}

export async function createAssetCategory(data: AssetCategoryData, businessUnitId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Check if code already exists within the same business unit
    const existingCategory = await prisma.assetCategory.findFirst({
      where: { 
        code: data.code,
        businessUnitId
      }
    })

    if (existingCategory) {
      return { error: "Category code already exists in this business unit" }
    }

    const category = await prisma.assetCategory.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        businessUnitId,
        defaultAssetAccountId: data.defaultAssetAccountId || null,
        defaultDepreciationExpenseAccountId: data.defaultDepreciationExpenseAccountId || null,
        defaultAccumulatedDepAccountId: data.defaultAccumulatedDepAccountId || null,
        isActive: data.isActive
      }
    })

    revalidatePath(`/[businessUnitId]/asset-management/categories`)
    return { success: "Category created successfully", data: category }
  } catch (error) {
    console.error("Error creating category:", error)
    return { error: "Failed to create category" }
  }
}

export async function updateAssetCategory(id: string, data: AssetCategoryData, businessUnitId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Check if code already exists within the same business unit (excluding current category)
    const existingCategory = await prisma.assetCategory.findFirst({
      where: { 
        code: data.code,
        businessUnitId,
        NOT: { id }
      }
    })

    if (existingCategory) {
      return { error: "Category code already exists in this business unit" }
    }

    const category = await prisma.assetCategory.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description || null,
        defaultAssetAccountId: data.defaultAssetAccountId || null,
        defaultDepreciationExpenseAccountId: data.defaultDepreciationExpenseAccountId || null,
        defaultAccumulatedDepAccountId: data.defaultAccumulatedDepAccountId || null,
        isActive: data.isActive
      }
    })

    revalidatePath(`/[businessUnitId]/asset-management/categories`)
    return { success: "Category updated successfully", data: category }
  } catch (error) {
    console.error("Error updating category:", error)
    return { error: "Failed to update category" }
  }
}

export async function deleteAssetCategory(id: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Check if category has assets
    const assetCount = await prisma.asset.count({
      where: { categoryId: id }
    })

    if (assetCount > 0) {
      return { error: `Cannot delete category. It has ${assetCount} asset(s) assigned to it.` }
    }

    await prisma.assetCategory.delete({
      where: { id }
    })

    revalidatePath(`/[businessUnitId]/asset-management/categories`)
    return { success: "Category deleted successfully" }
  } catch (error) {
    console.error("Error deleting category:", error)
    return { error: "Failed to delete category" }
  }
}

export async function toggleCategoryStatus(id: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const category = await prisma.assetCategory.findUnique({
      where: { id },
      select: { isActive: true }
    })

    if (!category) {
      return { error: "Category not found" }
    }

    const updatedCategory = await prisma.assetCategory.update({
      where: { id },
      data: { isActive: !category.isActive }
    })

    revalidatePath(`/[businessUnitId]/asset-management/categories`)
    return { 
      success: `Category ${updatedCategory.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedCategory
    }
  } catch (error) {
    console.error("Error toggling category status:", error)
    return { error: "Failed to update category status" }
  }
}

export async function getCategoryAssets(categoryId: string, businessUnitId?: string, page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit

    const whereClause = businessUnitId 
      ? { categoryId, businessUnitId }
      : { categoryId }

    const [assets, totalCount] = await Promise.all([
      prisma.asset.findMany({
        where: whereClause,
        include: {
          department: {
            select: {
              name: true,
              code: true
            }
          },
          businessUnit: {
            select: {
              name: true,
              code: true
            }
          }
        },
        orderBy: { itemCode: 'desc' },
        skip,
        take: limit
      }),
      prisma.asset.count({ where: whereClause })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return {
      assets,
      totalCount,
      totalPages,
      currentPage: page
    }
  } catch (error) {
    console.error("Error fetching category assets:", error)
    throw new Error("Failed to fetch category assets")
  }
}

export async function getGLAccountsForCategories() {
  try {
    const accounts = await prisma.gLAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true
      },
      orderBy: { accountCode: 'desc' }
    })
    
    return accounts
  } catch (error) {
    console.error("Error fetching GL accounts:", error)
    throw new Error("Failed to fetch GL accounts")
  }
}

export async function getCategoryDetails(categoryId: string, businessUnitId?: string) {
  try {
    const whereClause = businessUnitId 
      ? { id: categoryId, businessUnitId }
      : { id: categoryId }
    
    const category = await prisma.assetCategory.findUnique({
      where: whereClause,
      include: {
        defaultAssetAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        defaultDepExpAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        defaultAccDepAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        assets: {
          include: {
            category: {
              select: {
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
                    name: true,
                    employeeId: true
                  }
                }
              },
              take: 1
            }
          },
          orderBy: { itemCode: 'desc' }
        },
        _count: {
          select: {
            assets: true
          }
        }
      }
    })

    if (!category) {
      throw new Error("Category not found")
    }

    // Transform the data to match our component expectations and convert Decimal fields
    const transformedAssets = category.assets.map(asset => ({
      ...asset,
      // Convert Decimal fields to numbers
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
      depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
      depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null,
      currentDeployment: asset.deployments[0] || null
    }))

    return {
      ...category,
      assets: transformedAssets,
      defaultAssetAccount: category.defaultAssetAccount?.accountCode || null,
      defaultDepreciationAccount: category.defaultDepExpAccount?.accountCode || null,
      defaultExpenseAccount: category.defaultAccDepAccount?.accountCode || null,
      defaultUsefulLife: null // Add this if you have it in your schema
    }
  } catch (error) {
    console.error("Error fetching category details:", error)
    throw new Error("Failed to fetch category details")
  }
}