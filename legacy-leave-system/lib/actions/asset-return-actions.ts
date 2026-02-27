"use server"

import { prisma } from "@/lib/prisma"
import { DeploymentStatus, AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface DeployedAssetData {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  brand: string | null
  purchasePrice: number | null
  category: {
    id: string
    name: string
  }
  currentDeployment: {
    id: string
    transmittalNumber: string
    deployedDate: Date | null
    expectedReturnDate: Date | null
    deploymentNotes: string | null
    employee: {
      id: string
      name: string
      employeeId: string
      department: {
        id: string
        name: string
      } | null
    }
  }
}

export interface DeployedAssetsResponse {
  assets: DeployedAssetData[]
  totalCount: number
  employees: { id: string; name: string; employeeId: string; assetCount: number }[]
}

export interface GetDeployedAssetsFilters {
  businessUnitId: string
  employeeId?: string
  search?: string
  page?: number
  limit?: number
}

export async function getDeployedAssets(filters: GetDeployedAssetsFilters): Promise<DeployedAssetsResponse> {
  try {
    const {
      businessUnitId,
      employeeId,
      search,
      page = 1,
      limit = 20
    } = filters

    const where = {
      businessUnitId,
      status: AssetStatus.DEPLOYED,
      currentlyAssignedTo: employeeId || undefined,
      ...(search && {
        OR: [
          { itemCode: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { serialNumber: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } }
        ]
      })
    }

    const [assets, totalCount, employeeStats] = await Promise.all([
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
              status: {
                in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED]
              },
              returnedDate: null
            },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  employeeId: true,
                  department: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
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
          { itemCode: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.asset.count({ where }),
      prisma.asset.groupBy({
        by: ['currentlyAssignedTo'],
        where: {
          businessUnitId,
          status: AssetStatus.DEPLOYED,
          currentlyAssignedTo: { not: null }
        },
        _count: {
          currentlyAssignedTo: true
        },
        orderBy: {
          _count: {
            currentlyAssignedTo: 'desc'
          }
        }
      })
    ])

    // Get employee details for stats
    const employeeIds = employeeStats.map(stat => stat.currentlyAssignedTo).filter(Boolean) as string[]
    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, employeeId: true }
    })

    const employeesWithCount = employeeStats.map(stat => {
      const employee = employees.find(e => e.id === stat.currentlyAssignedTo)
      return {
        id: stat.currentlyAssignedTo!,
        name: employee?.name || 'Unknown',
        employeeId: employee?.employeeId || 'Unknown',
        assetCount: stat._count.currentlyAssignedTo
      }
    })

    // Transform assets to include current deployment
    const transformedAssets: DeployedAssetData[] = assets.map(asset => ({
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      serialNumber: asset.serialNumber,
      brand: asset.brand,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      category: asset.category,
      currentDeployment: {
        id: asset.deployments[0].id,
        transmittalNumber: asset.deployments[0].transmittalNumber,
        deployedDate: asset.deployments[0].deployedDate,
        expectedReturnDate: asset.deployments[0].expectedReturnDate,
        deploymentNotes: asset.deployments[0].deploymentNotes,
        employee: asset.deployments[0].employee
      }
    }))

    return {
      assets: transformedAssets,
      totalCount,
      employees: employeesWithCount
    }
  } catch (error) {
    console.error("Error fetching deployed assets:", error)
    throw new Error("Failed to fetch deployed assets")
  }
}

export interface ReturnAssetsData {
  assetIds: string[]
  returnedDate: Date
  returnNotes?: string
  businessUnitId: string
}

export async function returnAssets(data: ReturnAssetsData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Validate that all assets exist and are currently deployed
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: data.assetIds },
        businessUnitId: data.businessUnitId,
        status: AssetStatus.DEPLOYED
      },
      include: {
        deployments: {
          where: {
            status: {
              in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED]
            },
            returnedDate: null
          },
          include: {
            employee: {
              select: {
                name: true,
                employeeId: true
              }
            }
          }
        }
      }
    })

    if (assets.length !== data.assetIds.length) {
      return { error: "Some assets are not currently deployed or not found" }
    }

    // Update deployment records to mark as returned
    const updateDeploymentPromises = assets.map(asset => {
      const currentDeployment = asset.deployments[0]
      return prisma.assetDeployment.update({
        where: { id: currentDeployment.id },
        data: {
          returnedDate: data.returnedDate,
          status: DeploymentStatus.RETURNED,
          returnNotes: data.returnNotes
        }
      })
    })

    // Update assets to reflect return
    const updateAssetPromises = data.assetIds.map(assetId =>
      prisma.asset.update({
        where: { id: assetId },
        data: {
          currentlyAssignedTo: null,
          status: AssetStatus.AVAILABLE // Change back to AVAILABLE
        }
      })
    )

    // Create asset history entries
    const historyPromises = assets.map(asset => {
      const currentDeployment = asset.deployments[0]
      return prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'RETURNED',
          notes: `Returned from ${currentDeployment.employee.name} (${currentDeployment.employee.employeeId}) via transmittal ${currentDeployment.transmittalNumber}`,
          performedById: session.user.id,
          businessUnitId: data.businessUnitId
        }
      })
    })

    // Execute all operations in a transaction
    await prisma.$transaction([
      ...updateDeploymentPromises,
      ...updateAssetPromises,
      ...historyPromises
    ])

    revalidatePath(`/${data.businessUnitId}/asset-management/returns`)
    revalidatePath(`/${data.businessUnitId}/asset-management/assets`)
    revalidatePath(`/${data.businessUnitId}/asset-management/deployments`)

    return { 
      success: `Successfully returned ${data.assetIds.length} assets`
    }
  } catch (error) {
    console.error("Error returning assets:", error)
    return { error: "Failed to return assets" }
  }
}

export async function getEmployeesWithAssets(businessUnitId: string) {
  try {
    // Get employees who have deployed assets
    const employeesWithAssets = await prisma.asset.groupBy({
      by: ['currentlyAssignedTo'],
      where: {
        businessUnitId,
        status: AssetStatus.DEPLOYED,
        currentlyAssignedTo: { not: null }
      },
      _count: {
        currentlyAssignedTo: true
      }
    })

    const employeeIds = employeesWithAssets.map(item => item.currentlyAssignedTo).filter(Boolean) as string[]
    
    const employees = await prisma.user.findMany({
      where: {
        id: { in: employeeIds },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return employees.map(employee => {
      const assetCount = employeesWithAssets.find(item => item.currentlyAssignedTo === employee.id)?._count.currentlyAssignedTo || 0
      return {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId,
        department: employee.department,
        assetCount
      }
    })
  } catch (error) {
    console.error("Error fetching employees with assets:", error)
    throw new Error("Failed to fetch employees with assets")
  }
}