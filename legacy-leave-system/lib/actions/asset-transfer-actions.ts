"use server"

import { prisma } from "@/lib/prisma"
import { DeploymentStatus, AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface TransferAssetsData {
  assetIds: string[]
  transferType: 'EMPLOYEE' | 'BUSINESS_UNIT'
  // For employee transfers
  fromEmployeeId?: string
  toEmployeeId?: string
  // For business unit transfers
  fromBusinessUnitId: string
  toBusinessUnitId?: string
  toDepartmentId?: string
  transferDate: Date
  transferNotes?: string
  transferReason: string
}

export async function getBusinessUnits() {
  try {
    const businessUnits = await prisma.businessUnit.findMany({
      select: {
        id: true,
        name: true,
        code: true
      },
      orderBy: { name: 'asc' }
    })

    return businessUnits
  } catch (error) {
    console.error("Error fetching business units:", error)
    throw new Error("Failed to fetch business units")
  }
}

export async function getDepartmentsByBusinessUnit(businessUnitId: string) {
  try {
    const departments = await prisma.department.findMany({
      where: {
        businessUnitId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        code: true
      },
      orderBy: { name: 'asc' }
    })

    return departments
  } catch (error) {
    console.error("Error fetching departments:", error)
    throw new Error("Failed to fetch departments")
  }
}

export async function getEmployeesByBusinessUnit(businessUnitId: string) {
  try {
    const employees = await prisma.user.findMany({
      where: {
        businessUnitId,
        isActive: true,
        role: { in: ['USER', 'MANAGER', 'HR'] } // Only actual employees
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
      orderBy: { name: 'asc' }
    })

    return employees
  } catch (error) {
    console.error("Error fetching employees:", error)
    throw new Error("Failed to fetch employees")
  }
}

export async function transferAssets(data: TransferAssetsData) {
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
        businessUnitId: data.fromBusinessUnitId,
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

    if (data.transferType === 'EMPLOYEE') {
      return await handleEmployeeTransfer(data, assets, session.user.id)
    } else {
      return await handleBusinessUnitTransfer(data, assets, session.user.id)
    }
  } catch (error) {
    console.error("Error transferring assets:", error)
    return { error: "Failed to transfer assets" }
  }
}

async function handleEmployeeTransfer(data: TransferAssetsData, assets: any[], userId: string) {
  if (!data.toEmployeeId) {
    return { error: "Target employee is required for employee transfer" }
  }

  // Validate target employee exists
  const targetEmployee = await prisma.user.findFirst({
    where: {
      id: data.toEmployeeId,
      businessUnitId: data.fromBusinessUnitId,
      isActive: true
    }
  })

  if (!targetEmployee) {
    return { error: "Target employee not found" }
  }

  // Generate transfer transmittal number
  const transferTransmittalNumber = await generateTransferTransmittalNumber(data.fromBusinessUnitId, 'EMP')

  // Close current deployments
  const closeDeploymentPromises = assets.map(asset => {
    const currentDeployment = asset.deployments[0]
    return prisma.assetDeployment.update({
      where: { id: currentDeployment.id },
      data: {
        returnedDate: data.transferDate,
        status: DeploymentStatus.RETURNED,
        returnNotes: `Transferred to ${targetEmployee.name} (${targetEmployee.employeeId}) via ${transferTransmittalNumber}`
      }
    })
  })

  // Create new deployments for target employee
  const newDeploymentPromises = data.assetIds.map((assetId, index) => 
    prisma.assetDeployment.create({
      data: {
        assetId,
        employeeId: data.toEmployeeId!,
        transmittalNumber: `${transferTransmittalNumber}-${String(index + 1).padStart(2, '0')}`,
        deployedDate: data.transferDate,
        deploymentNotes: `Transferred from previous assignment. Reason: ${data.transferReason}`,
        status: DeploymentStatus.DEPLOYED,
        businessUnitId: data.fromBusinessUnitId
      }
    })
  )

  // Update assets assignment
  const updateAssetPromises = data.assetIds.map(assetId =>
    prisma.asset.update({
      where: { id: assetId },
      data: {
        currentlyAssignedTo: data.toEmployeeId,
        lastAssignedDate: data.transferDate
      }
    })
  )

  // Create asset history entries
  const historyPromises = assets.map(asset => {
    const currentDeployment = asset.deployments[0]
    return prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'TRANSFERRED',
        notes: `Transferred from ${currentDeployment.employee.name} (${currentDeployment.employee.employeeId}) to ${targetEmployee.name} (${targetEmployee.employeeId}). Reason: ${data.transferReason}`,
        performedById: userId,
        businessUnitId: data.fromBusinessUnitId
      }
    })
  })

  // Execute all operations in a transaction
  await prisma.$transaction([
    ...closeDeploymentPromises,
    ...newDeploymentPromises,
    ...updateAssetPromises,
    ...historyPromises
  ])

  revalidatePath(`/${data.fromBusinessUnitId}/asset-management/transfers`)
  revalidatePath(`/${data.fromBusinessUnitId}/asset-management/assets`)

  return { 
    success: `Successfully transferred ${data.assetIds.length} assets to ${targetEmployee.name}`,
    transferTransmittalNumber
  }
}

async function handleBusinessUnitTransfer(data: TransferAssetsData, assets: any[], userId: string) {
  if (!data.toBusinessUnitId) {
    return { error: "Target business unit is required for business unit transfer" }
  }

  // Validate target business unit exists
  const targetBusinessUnit = await prisma.businessUnit.findFirst({
    where: {
      id: data.toBusinessUnitId
    }
  })

  if (!targetBusinessUnit) {
    return { error: "Target business unit not found" }
  }

  // Generate transfer transmittal number
  const transferTransmittalNumber = await generateTransferTransmittalNumber(data.fromBusinessUnitId, 'BU')

  // Close current deployments
  const closeDeploymentPromises = assets.map(asset => {
    const currentDeployment = asset.deployments[0]
    return prisma.assetDeployment.update({
      where: { id: currentDeployment.id },
      data: {
        returnedDate: data.transferDate,
        status: DeploymentStatus.RETURNED,
        returnNotes: `Transferred to ${targetBusinessUnit.name} via ${transferTransmittalNumber}`
      }
    })
  })

  // Update assets to new business unit
  const updateAssetPromises = data.assetIds.map(assetId =>
    prisma.asset.update({
      where: { id: assetId },
      data: {
        businessUnitId: data.toBusinessUnitId!,
        departmentId: data.toDepartmentId || null,
        currentlyAssignedTo: null, // Unassign when transferring to different BU
        status: AssetStatus.AVAILABLE, // Make available in new BU
        lastAssignedDate: data.transferDate
      }
    })
  )

  // Create asset history entries for source BU
  const sourceHistoryPromises = assets.map(asset => {
    const currentDeployment = asset.deployments[0]
    return prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'TRANSFERRED',
        notes: `Transferred from ${currentDeployment.employee.name} (${currentDeployment.employee.employeeId}) to ${targetBusinessUnit.name}. Reason: ${data.transferReason}`,
        performedById: userId,
        businessUnitId: data.fromBusinessUnitId
      }
    })
  })

  // Create asset history entries for target BU
  const targetHistoryPromises = assets.map(asset =>
    prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: 'TRANSFERRED',
        notes: `Received from ${asset.businessUnit?.name || 'Previous Business Unit'}. Reason: ${data.transferReason}`,
        performedById: userId,
        businessUnitId: data.toBusinessUnitId!
      }
    })
  )

  // Execute all operations in a transaction
  await prisma.$transaction([
    ...closeDeploymentPromises,
    ...updateAssetPromises,
    ...sourceHistoryPromises,
    ...targetHistoryPromises
  ])

  revalidatePath(`/${data.fromBusinessUnitId}/asset-management/transfers`)
  revalidatePath(`/${data.fromBusinessUnitId}/asset-management/assets`)
  revalidatePath(`/${data.toBusinessUnitId}/asset-management/assets`)

  return { 
    success: `Successfully transferred ${data.assetIds.length} assets to ${targetBusinessUnit.name}`,
    transferTransmittalNumber
  }
}

async function generateTransferTransmittalNumber(businessUnitId: string, type: 'EMP' | 'BU'): Promise<string> {
  try {
    // Get business unit code
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { code: true }
    })

    const buCode = businessUnit?.code || 'BU'
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const prefix = `${buCode}-TXF${type}-${year}${month}`

    // Get the last transfer transmittal number for this business unit and month
    const lastTransfer = await prisma.assetHistory.findFirst({
      where: {
        businessUnitId,
        action: 'TRANSFERRED',
        notes: {
          contains: prefix
        }
      },
      orderBy: {
        performedAt: 'desc'
      },
      select: {
        notes: true
      }
    })

    let nextNumber = 1
    if (lastTransfer) {
      // Extract number from notes (this is a simple approach)
      const match = lastTransfer.notes?.match(new RegExp(`${prefix}-(\\d+)`))
      if (match) {
        const currentNumber = parseInt(match[1]) || 0
        nextNumber = currentNumber + 1
      }
    }

    // Format: BU-TXFEMP-YYYYMM-001 or BU-TXFBU-YYYYMM-001
    const formattedNumber = nextNumber.toString().padStart(3, '0')
    return `${prefix}-${formattedNumber}`
  } catch (error) {
    console.error("Error generating transfer transmittal number:", error)
    // Fallback to timestamp-based number
    return `TXF${type}-${Date.now()}`
  }
}