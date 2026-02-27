"use server"

import { prisma } from "@/lib/prisma"
import { VerificationStatus, VerificationItemStatus, AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface InventoryVerificationData {
  id: string
  verificationName: string
  description: string | null
  startDate: Date
  endDate: Date | null
  status: VerificationStatus
  totalAssets: number
  scannedAssets: number
  verifiedAssets: number
  discrepancies: number
  createdBy: string
  assignedTo: string[]
  locations: string[]
  categories: string[]
  createdAt: Date
  updatedAt: Date
  createdByEmployee: {
    name: string
    employeeId: string
  }
  progress: number
}

export interface VerificationItemData {
  id: string
  verificationId: string
  assetId: string
  expectedLocation: string
  actualLocation: string | null
  expectedAssignee: string | null
  actualAssignee: string | null
  scannedAt: Date | null
  scannedBy: string | null
  status: VerificationItemStatus
  notes: string | null
  photos: string[]
  asset: {
    itemCode: string
    description: string
    serialNumber: string | null
    status: AssetStatus
    category: {
      name: string
    }
  }
  scannedByEmployee?: {
    name: string
    employeeId: string
  } | null
}

export interface InventoryVerificationsResponse {
  verifications: InventoryVerificationData[]
  totalCount: number
  summary: {
    total: number
    planned: number
    inProgress: number
    completed: number
    cancelled: number
  }
}

export interface GetInventoryVerificationsFilters {
  businessUnitId: string
  status?: string
  search?: string
  page?: number
  limit?: number
}

export async function getInventoryVerifications(filters: GetInventoryVerificationsFilters): Promise<InventoryVerificationsResponse> {
  try {
    const {
      businessUnitId,
      status,
      search,
      page = 1,
      limit = 20
    } = filters

    const where: any = {
      businessUnitId,
      ...(status && status !== 'all' && { status }),
      ...(search && {
        OR: [
          { verificationName: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [verifications, totalCount, statusCounts] = await Promise.all([
      prisma.inventoryVerification.findMany({
        where,
        include: {
          createdByEmployee: {
            select: {
              name: true,
              employeeId: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.inventoryVerification.count({ where }),
      prisma.inventoryVerification.groupBy({
        by: ['status'],
        where: { businessUnitId },
        _count: {
          status: true
        }
      })
    ])

    // Calculate summary
    const summary = {
      total: await prisma.inventoryVerification.count({ where: { businessUnitId } }),
      planned: statusCounts.find(s => s.status === 'PLANNED')?._count.status || 0,
      inProgress: statusCounts.find(s => s.status === 'IN_PROGRESS')?._count.status || 0,
      completed: statusCounts.find(s => s.status === 'COMPLETED')?._count.status || 0,
      cancelled: statusCounts.find(s => s.status === 'CANCELLED')?._count.status || 0
    }

    // Transform verifications
    const transformedVerifications: InventoryVerificationData[] = verifications.map(verification => ({
      id: verification.id,
      verificationName: verification.verificationName,
      description: verification.description,
      startDate: verification.startDate,
      endDate: verification.endDate,
      status: verification.status,
      totalAssets: verification.totalAssets,
      scannedAssets: verification.scannedAssets,
      verifiedAssets: verification.verifiedAssets,
      discrepancies: verification.discrepancies,
      createdBy: verification.createdBy,
      assignedTo: verification.assignedTo,
      locations: verification.locations,
      categories: verification.categories,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      createdByEmployee: verification.createdByEmployee,
      progress: verification.totalAssets > 0 ? (verification.scannedAssets / verification.totalAssets) * 100 : 0
    }))

    return {
      verifications: transformedVerifications,
      totalCount,
      summary
    }
  } catch (error) {
    console.error("Error fetching inventory verifications:", error)
    throw new Error("Failed to fetch inventory verifications")
  }
}

export interface CreateVerificationData {
  verificationName: string
  description?: string
  startDate: Date
  endDate?: Date
  assignedTo: string[]
  locations: string[]
  categories: string[]
  businessUnitId: string
}

export async function createInventoryVerification(data: CreateVerificationData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Get assets that match the criteria
    const whereClause: any = {
      businessUnitId: data.businessUnitId,
      status: {
        in: [AssetStatus.AVAILABLE, AssetStatus.DEPLOYED, AssetStatus.IN_MAINTENANCE]
      }
    }

    if (data.categories.length > 0) {
      whereClause.categoryId = { in: data.categories }
    }

    if (data.locations.length > 0) {
      whereClause.location = { in: data.locations }
    }

    const assets = await prisma.asset.findMany({
      where: whereClause,
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
                id: true,
                name: true,
                employeeId: true
              }
            }
          },
          take: 1
        }
      }
    })

    if (assets.length === 0) {
      return { error: "No assets found matching the specified criteria" }
    }

    // Create verification
    const verification = await prisma.inventoryVerification.create({
      data: {
        verificationName: data.verificationName,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        businessUnitId: data.businessUnitId,
        createdBy: session.user.id,
        assignedTo: data.assignedTo,
        locations: data.locations,
        categories: data.categories,
        totalAssets: assets.length,
        status: VerificationStatus.PLANNED
      }
    })

    // Create verification items for each asset
    const verificationItems = assets.map(asset => ({
      verificationId: verification.id,
      assetId: asset.id,
      expectedLocation: asset.location || 'Unknown',
      expectedAssignee: asset.deployments[0]?.employee.id || null,
      status: VerificationItemStatus.PENDING
    }))

    await prisma.verificationItem.createMany({
      data: verificationItems
    })

    revalidatePath(`/${data.businessUnitId}/asset-management/inventory`)

    return { 
      success: `Created inventory verification "${data.verificationName}" with ${assets.length} assets`,
      verificationId: verification.id
    }
  } catch (error) {
    console.error("Error creating inventory verification:", error)
    return { error: "Failed to create inventory verification" }
  }
}

export async function getVerificationDetails(verificationId: string) {
  try {
    const verification = await prisma.inventoryVerification.findUnique({
      where: { id: verificationId },
      include: {
        createdByEmployee: {
          select: {
            name: true,
            employeeId: true,
            role: true,
            department: {
              select: {
                name: true
              }
            }
          }
        },
        verificationItems: {
          include: {
            asset: {
              select: {
                id: true,
                itemCode: true,
                description: true,
                serialNumber: true,
                status: true,
                location: true,
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!verification) {
      throw new Error("Verification not found")
    }

    // Get assigned employees with their details
    const assignedEmployees = await prisma.user.findMany({
      where: {
        id: { in: verification.assignedTo }
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        role: true,
        department: {
          select: {
            name: true
          }
        }
      }
    })

    // Get categories with names
    const categories = verification.categories.length > 0 
      ? await prisma.assetCategory.findMany({
          where: {
            id: { in: verification.categories }
          },
          select: {
            id: true,
            name: true
          }
        })
      : []

    return {
      ...verification,
      items: verification.verificationItems.map((item: any) => ({
        id: item.id,
        status: item.status,
        scannedAt: item.scannedAt,
        notes: item.notes,
        asset: {
          id: item.asset.id,
          name: item.asset.description,
          assetTag: item.asset.itemCode,
          location: item.asset.location,
          category: item.asset.category
        }
      })),
      assignedTo: assignedEmployees.map(emp => ({
        id: emp.id,
        employee: {
          id: emp.id,
          name: emp.name,
          employeeId: emp.employeeId,
          role: emp.role,
          department: emp.department
        }
      })),
      categories: categories,
      progress: verification.totalAssets > 0 ? (verification.scannedAssets / verification.totalAssets) * 100 : 0
    }
  } catch (error) {
    console.error("Error fetching verification details:", error)
    throw new Error("Failed to fetch verification details")
  }
}

export async function startVerification(verificationId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const verification = await prisma.inventoryVerification.update({
      where: { id: verificationId },
      data: {
        status: VerificationStatus.IN_PROGRESS,
        startDate: new Date()
      }
    })

    revalidatePath(`/asset-management/inventory`)

    return { success: "Verification started successfully" }
  } catch (error) {
    console.error("Error starting verification:", error)
    return { error: "Failed to start verification" }
  }
}

export async function completeVerification(verificationId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Check if all items are processed
    const pendingItems = await prisma.verificationItem.count({
      where: {
        verificationId,
        status: VerificationItemStatus.PENDING
      }
    })

    if (pendingItems > 0) {
      return { error: `Cannot complete verification. ${pendingItems} items are still pending.` }
    }

    const verification = await prisma.inventoryVerification.update({
      where: { id: verificationId },
      data: {
        status: VerificationStatus.COMPLETED,
        endDate: new Date()
      }
    })

    revalidatePath(`/asset-management/inventory`)

    return { success: "Verification completed successfully" }
  } catch (error) {
    console.error("Error completing verification:", error)
    return { error: "Failed to complete verification" }
  }
}

export interface ScanAssetData {
  verificationId: string
  assetId: string
  scannedCode: string
  actualLocation?: string
  actualAssignee?: string
  notes?: string
  photos?: string[]
}

export interface MarkAssetNotFoundData {
  verificationId: string
  assetId: string
  notes?: string
}

export interface ReportDiscrepancyData {
  verificationId: string
  assetId: string
  scannedCode: string
  notes?: string
}

export async function scanAsset(data: ScanAssetData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Find the verification item
    const verificationItem = await prisma.verificationItem.findFirst({
      where: {
        verificationId: data.verificationId,
        assetId: data.assetId
      },
      include: {
        asset: true,
        verification: true
      }
    })

    if (!verificationItem) {
      return { error: "Asset not found in this verification" }
    }

    if (verificationItem.status !== VerificationItemStatus.PENDING) {
      return { error: "Asset has already been scanned" }
    }

    // Check if scanned code matches asset tag
    const codeMatches = data.scannedCode.toLowerCase() === verificationItem.asset.itemCode.toLowerCase()
    
    // Determine if there's a discrepancy
    let status: VerificationItemStatus = codeMatches ? VerificationItemStatus.VERIFIED : VerificationItemStatus.DISCREPANCY
    let hasDiscrepancy = !codeMatches

    if (data.actualLocation && data.actualLocation !== verificationItem.expectedLocation) {
      status = VerificationItemStatus.DISCREPANCY
      hasDiscrepancy = true
    }

    if (data.actualAssignee && data.actualAssignee !== verificationItem.expectedAssignee) {
      status = VerificationItemStatus.DISCREPANCY
      hasDiscrepancy = true
    }

    // Update verification item
    await prisma.verificationItem.update({
      where: { id: verificationItem.id },
      data: {
        actualLocation: data.actualLocation,
        actualAssignee: data.actualAssignee,
        scannedAt: new Date(),
        scannedBy: session.user.id,
        status,
        notes: data.notes,
        photos: data.photos || []
      }
    })

    // Update verification counters
    const updateData: any = {
      scannedAssets: { increment: 1 }
    }

    if (status === VerificationItemStatus.VERIFIED) {
      updateData.verifiedAssets = { increment: 1 }
    } else if (status === VerificationItemStatus.DISCREPANCY) {
      updateData.discrepancies = { increment: 1 }
    }

    await prisma.inventoryVerification.update({
      where: { id: data.verificationId },
      data: updateData
    })

    revalidatePath(`/asset-management/inventory`)

    return { 
      success: hasDiscrepancy 
        ? "Asset scanned with discrepancy noted" 
        : "Asset verified successfully",
      hasDiscrepancy
    }
  } catch (error) {
    console.error("Error scanning asset:", error)
    return { error: "Failed to scan asset" }
  }
}

export async function markAssetNotFound(data: MarkAssetNotFoundData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Find and update verification item
    const verificationItem = await prisma.verificationItem.findFirst({
      where: {
        verificationId: data.verificationId,
        assetId: data.assetId
      }
    })

    if (!verificationItem) {
      return { error: "Asset not found in this verification" }
    }

    await prisma.verificationItem.update({
      where: { id: verificationItem.id },
      data: {
        scannedAt: new Date(),
        scannedBy: session.user.id,
        status: VerificationItemStatus.NOT_FOUND,
        notes: data.notes
      }
    })

    // Update verification counters
    await prisma.inventoryVerification.update({
      where: { id: data.verificationId },
      data: {
        scannedAssets: { increment: 1 },
        discrepancies: { increment: 1 }
      }
    })

    revalidatePath(`/asset-management/inventory`)

    return { success: "Asset marked as not found" }
  } catch (error) {
    console.error("Error marking asset as not found:", error)
    return { error: "Failed to mark asset as not found" }
  }
}

export async function getAvailableEmployees(businessUnitId: string) {
  try {
    const employees = await prisma.user.findMany({
      where: {
        businessUnitId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return employees
  } catch (error) {
    console.error("Error fetching employees:", error)
    throw new Error("Failed to fetch employees")
  }
}

export async function getAvailableLocations(businessUnitId: string) {
  try {
    const locations = await prisma.asset.findMany({
      where: {
        businessUnitId,
        location: { not: null }
      },
      select: {
        location: true
      },
      distinct: ['location']
    })

    return locations.map(l => l.location).filter((location): location is string => Boolean(location))
  } catch (error) {
    console.error("Error fetching locations:", error)
    throw new Error("Failed to fetch locations")
  }
}

export async function getAvailableCategories(businessUnitId: string) {
  try {
    const categories = await prisma.assetCategory.findMany({
      where: {
        isActive: true,
        assets: {
          some: {
            businessUnitId
          }
        }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            assets: {
              where: {
                businessUnitId
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      assetCount: cat._count.assets
    }))
  } catch (error) {
    console.error("Error fetching categories:", error)
    throw new Error("Failed to fetch categories")
  }
}

export async function reportDiscrepancy(data: ReportDiscrepancyData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Find and update verification item
    const verificationItem = await prisma.verificationItem.findFirst({
      where: {
        verificationId: data.verificationId,
        assetId: data.assetId
      }
    })

    if (!verificationItem) {
      return { error: "Asset not found in this verification" }
    }

    await prisma.verificationItem.update({
      where: { id: verificationItem.id },
      data: {
        scannedAt: new Date(),
        scannedBy: session.user.id,
        status: VerificationItemStatus.DISCREPANCY,
        notes: data.notes
      }
    })

    // Update verification counters
    await prisma.inventoryVerification.update({
      where: { id: data.verificationId },
      data: {
        scannedAssets: { increment: 1 },
        discrepancies: { increment: 1 }
      }
    })

    revalidatePath(`/asset-management/inventory`)

    return { success: "Discrepancy reported successfully" }
  } catch (error) {
    console.error("Error reporting discrepancy:", error)
    return { error: "Failed to report discrepancy" }
  }
}