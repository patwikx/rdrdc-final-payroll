"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export interface AssetNeedingDepreciation {
  id: string
  itemCode: string
  description: string
  nextDepreciationDate: Date
  monthlyDepreciation: number
  currentBookValue: number
  category: {
    name: string
  }
}

export async function getAssetsNeedingDepreciation(businessUnitId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    // Only show to users who can manage assets
    if (!["ADMIN", "MANAGER", "ACCTG"].includes(session.user.role)) {
      return []
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const assets = await prisma.asset.findMany({
      where: {
        businessUnitId,
        isActive: true,
        status: {
          not: "DISPOSED"
        },
        isFullyDepreciated: false,
        nextDepreciationDate: {
          lte: today
        },
        depreciationMethod: {
          not: null
        },
        monthlyDepreciation: {
          gt: 0
        }
      },
      include: {
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        nextDepreciationDate: 'asc'
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedAssets = assets.map(asset => ({
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      nextDepreciationDate: asset.nextDepreciationDate!,
      monthlyDepreciation: Number(asset.monthlyDepreciation || 0),
      currentBookValue: Number(asset.currentBookValue || 0),
      category: {
        name: asset.category.name
      }
    }))

    return serializedAssets
  } catch (error) {
    console.error("Error fetching assets needing depreciation:", error)
    return []
  }
}

export async function getDepreciationNotificationCount(businessUnitId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return 0
    }

    // Only show to users who can manage assets
    if (!["ADMIN", "MANAGER", "ACCTG"].includes(session.user.role)) {
      return 0
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const count = await prisma.asset.count({
      where: {
        businessUnitId,
        isActive: true,
        status: {
          not: "DISPOSED"
        },
        isFullyDepreciated: false,
        nextDepreciationDate: {
          lte: today
        },
        depreciationMethod: {
          not: null
        },
        monthlyDepreciation: {
          gt: 0
        }
      }
    })

    return count
  } catch (error) {
    console.error("Error getting depreciation notification count:", error)
    return 0
  }
}