"use server"

import { prisma } from "@/lib/prisma"
import { AccountType, DebitCredit } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface GLAccount {
  id: string
  accountCode: string
  accountName: string
  accountType: AccountType
  normalBalance: DebitCredit
  isActive: boolean
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface GLAccountsResponse {
  accounts: GLAccount[]
  totalCount: number
  totalPages: number
  currentPage: number
  accountTypes: { type: AccountType; count: number }[]
}

export interface GLAccountFilters {
  accountType?: AccountType
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}

export async function getGLAccounts(filters: GLAccountFilters = {}): Promise<GLAccountsResponse> {
  try {
    const {
      accountType,
      isActive,
      search,
      page = 1,
      limit = 20
    } = filters

    const where = {
      ...(accountType && { accountType }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { accountCode: { contains: search, mode: 'insensitive' as const } },
          { accountName: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [accounts, totalCount, accountTypeCounts] = await Promise.all([
      prisma.gLAccount.findMany({
        where,
        orderBy: [
          { accountCode: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.gLAccount.count({ where }),
      prisma.gLAccount.groupBy({
        by: ['accountType'],
        _count: {
          accountType: true
        }
      })
    ])

    const accountTypes = accountTypeCounts.map(item => ({
      type: item.accountType,
      count: item._count.accountType
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return {
      accounts,
      totalCount,
      totalPages,
      currentPage: page,
      accountTypes
    }
  } catch (error) {
    console.error("Error fetching GL accounts:", error)
    throw new Error("Failed to fetch GL accounts")
  }
}

export interface CreateGLAccountData {
  accountCode: string
  accountName: string
  accountType: AccountType
  normalBalance: DebitCredit
  description?: string
  isActive?: boolean
}

export async function createGLAccount(data: CreateGLAccountData) {
  try {
    // Check if account code already exists
    const existingAccount = await prisma.gLAccount.findUnique({
      where: { accountCode: data.accountCode }
    })

    if (existingAccount) {
      return { error: "Account code already exists" }
    }

    await prisma.gLAccount.create({
      data: {
        accountCode: data.accountCode,
        accountName: data.accountName,
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        description: data.description || null,
        isActive: data.isActive ?? true
      }
    })

    revalidatePath("/[businessUnitId]/admin/gl-accounts", "page")
    return { success: "GL Account created successfully" }
  } catch (error) {
    console.error("Error creating GL account:", error)
    return { error: "Failed to create GL account" }
  }
}

export interface UpdateGLAccountData {
  accountName: string
  accountType: AccountType
  normalBalance: DebitCredit
  description?: string
  isActive: boolean
}

export async function updateGLAccount(accountId: string, data: UpdateGLAccountData) {
  try {
    await prisma.gLAccount.update({
      where: { id: accountId },
      data: {
        accountName: data.accountName,
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        description: data.description || null,
        isActive: data.isActive
      }
    })

    revalidatePath("/[businessUnitId]/admin/gl-accounts", "page")
    return { success: "GL Account updated successfully" }
  } catch (error) {
    console.error("Error updating GL account:", error)
    return { error: "Failed to update GL account" }
  }
}

export async function deleteGLAccount(accountId: string) {
  try {
    // Check if account is being used
    const [assetCategories, assets] = await Promise.all([
      prisma.assetCategory.count({
        where: {
          OR: [
            { defaultAssetAccountId: accountId },
            { defaultDepreciationExpenseAccountId: accountId },
            { defaultAccumulatedDepAccountId: accountId }
          ]
        }
      }),
      prisma.asset.count({
        where: {
          OR: [
            { assetAccountId: accountId },
            { depreciationExpenseAccountId: accountId },
            { accumulatedDepAccountId: accountId }
          ]
        }
      })
    ])

    if (assetCategories > 0 || assets > 0) {
      return { error: "Cannot delete account that is being used by asset categories or assets" }
    }

    await prisma.gLAccount.delete({
      where: { id: accountId }
    })

    revalidatePath("/[businessUnitId]/admin/gl-accounts", "page")
    return { success: "GL Account deleted successfully" }
  } catch (error) {
    console.error("Error deleting GL account:", error)
    return { error: "Failed to delete GL account" }
  }
}

export async function toggleGLAccountStatus(accountId: string, isActive: boolean) {
  try {
    await prisma.gLAccount.update({
      where: { id: accountId },
      data: { isActive }
    })

    revalidatePath("/[businessUnitId]/admin/gl-accounts", "page")
    return { success: `GL Account ${isActive ? 'activated' : 'deactivated'} successfully` }
  } catch (error) {
    console.error("Error toggling GL account status:", error)
    return { error: "Failed to update GL account status" }
  }
}