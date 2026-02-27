"use server"

import { prisma } from "@/lib/prisma"
import { DeploymentStatus, AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface DeployAssetsData {
  assetIds: string[]
  employeeId: string
  deployedDate: Date
  expectedReturnDate?: Date
  deploymentNotes?: string
  businessUnitId: string
}

export async function getEmployees(businessUnitId: string) {
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
        email: true,
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

    return employees
  } catch (error) {
    console.error("Error fetching employees:", error)
    throw new Error("Failed to fetch employees")
  }
}

export async function deployAssets(data: DeployAssetsData) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Validate that all assets exist and are available for deployment
    const assets = await prisma.asset.findMany({
      where: {
        id: { in: data.assetIds },
        businessUnitId: data.businessUnitId,
        isActive: true,
        status: AssetStatus.AVAILABLE // Only AVAILABLE assets can be deployed
      },
      // Check current deployments separately
    })

    if (assets.length !== data.assetIds.length) {
      return { error: "Some assets are not available for deployment" }
    }

    // Check if any assets are already deployed
    const currentDeployments = await prisma.assetDeployment.findMany({
      where: {
        assetId: { in: data.assetIds },
        status: {
          in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED, DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]
        },
        returnedDate: null
      },
      include: {
        asset: {
          select: {
            itemCode: true
          }
        }
      }
    })

    if (currentDeployments.length > 0) {
      return { 
        error: `Assets ${currentDeployments.map(d => d.asset.itemCode).join(', ')} are already deployed` 
      }
    }

    // Validate employee exists
    const employee = await prisma.user.findFirst({
      where: {
        id: data.employeeId,
        businessUnitId: data.businessUnitId,
        isActive: true
      }
    })

    if (!employee) {
      return { error: "Employee not found" }
    }

    // Generate base transmittal number
    const baseTransmittalNumber = await generateTransmittalNumber(data.businessUnitId)

    // Create deployment records for all assets with related transmittal numbers
    const deploymentPromises = data.assetIds.map((assetId, index) => 
      prisma.assetDeployment.create({
        data: {
          assetId,
          employeeId: data.employeeId,
          transmittalNumber: `${baseTransmittalNumber}-${String(index + 1).padStart(2, '0')}`, // Add suffix for uniqueness
          deployedDate: data.deployedDate,
          expectedReturnDate: data.expectedReturnDate,
          deploymentNotes: data.deploymentNotes,
          status: DeploymentStatus.DEPLOYED,
          // createdById: session.user.id,
          businessUnitId: data.businessUnitId
        }
      })
    )

    // Update assets to reflect current deployment
    const updateAssetPromises = data.assetIds.map(assetId =>
      prisma.asset.update({
        where: { id: assetId },
        data: {
          currentlyAssignedTo: data.employeeId,
          lastAssignedDate: data.deployedDate,
          status: AssetStatus.DEPLOYED // Change status from ACTIVE to DEPLOYED
        }
      })
    )

    // Create asset history entries
    const historyPromises = data.assetIds.map((assetId, index) =>
      prisma.assetHistory.create({
        data: {
          assetId,
          action: 'DEPLOYED',
          notes: `Deployed to ${employee.name} (${employee.employeeId}) via transmittal ${baseTransmittalNumber}-${String(index + 1).padStart(2, '0')}`,
          performedById: session.user.id,
          businessUnitId: data.businessUnitId
        }
      })
    )

    // Execute all operations in a transaction
    await prisma.$transaction([
      ...deploymentPromises,
      ...updateAssetPromises,
      ...historyPromises
    ])

    revalidatePath(`/${data.businessUnitId}/asset-management/deployments`)
    revalidatePath(`/${data.businessUnitId}/asset-management/assets`)

    return { 
      success: `Successfully deployed ${data.assetIds.length} assets to ${employee.name} under transmittal batch ${baseTransmittalNumber}`,
      transmittalNumber: baseTransmittalNumber
    }
  } catch (error) {
    console.error("Error deploying assets:", error)
    return { error: "Failed to deploy assets" }
  }
}

async function generateTransmittalNumber(businessUnitId: string): Promise<string> {
  try {
    // Get business unit code
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { code: true }
    })

    const buCode = businessUnit?.code || 'BU'
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')

    // Get the last transmittal number for this business unit and month
    const lastDeployment = await prisma.assetDeployment.findFirst({
      where: {
        businessUnitId,
        transmittalNumber: {
          startsWith: `${buCode}-${year}${month}-`
        }
      },
      orderBy: {
        transmittalNumber: 'desc'
      },
      select: {
        transmittalNumber: true
      }
    })

    let nextNumber = 1
    if (lastDeployment) {
      // Extract the number part from the transmittal number
      const parts = lastDeployment.transmittalNumber.split('-')
      if (parts.length >= 3) {
        const currentNumber = parseInt(parts[2]) || 0
        nextNumber = currentNumber + 1
      }
    }

    // Format: BU-YYYYMM-001
    const formattedNumber = nextNumber.toString().padStart(3, '0')
    return `${buCode}-${year}${month}-${formattedNumber}`
  } catch (error) {
    console.error("Error generating transmittal number:", error)
    // Fallback to timestamp-based number
    return `TXN-${Date.now()}`
  }
}

export async function getDeploymentHistory(businessUnitId: string, page = 1, limit = 20) {
  try {
    const deployments = await prisma.assetDeployment.findMany({
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
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: {
              select: {
                name: true
              }
            }
          }
        },
        // createdBy: {
        //   select: {
        //     name: true
        //   }
        // }
      },
      orderBy: {
        deployedDate: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const totalCount = await prisma.assetDeployment.count({
      where: {
        businessUnitId
      }
    })

    return {
      deployments,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  } catch (error) {
    console.error("Error fetching deployment history:", error)
    throw new Error("Failed to fetch deployment history")
  }
}