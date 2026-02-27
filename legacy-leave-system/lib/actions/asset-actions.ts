"use server"

import { prisma } from "@/lib/prisma"
import { DeploymentStatus } from "@prisma/client"
import { AssetDeployment } from "@/types/asset-types"

export async function getUserAssetDeployments(userId: string): Promise<AssetDeployment[]> {
  try {
    const deployments = await prisma.assetDeployment.findMany({
      where: {
        employeeId: userId,
        status: {
          in: [DeploymentStatus.DEPLOYED, DeploymentStatus.APPROVED]
        }
      },
      include: {
        asset: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: {
        deployedDate: 'desc'
      }
    })

    return deployments.map(deployment => ({
      id: deployment.id,
      transmittalNumber: deployment.transmittalNumber,
      deployedDate: deployment.deployedDate,
      expectedReturnDate: deployment.expectedReturnDate,
      returnedDate: deployment.returnedDate,
      status: deployment.status,
      deploymentNotes: deployment.deploymentNotes,
      returnNotes: deployment.returnNotes,
      deploymentCondition: deployment.deploymentCondition,
      returnCondition: deployment.returnCondition,
      asset: {
        id: deployment.asset.id,
        itemCode: deployment.asset.itemCode,
        description: deployment.asset.description,
        serialNumber: deployment.asset.serialNumber,
        brand: deployment.asset.brand,
        modelNumber: deployment.asset.modelNumber,
        status: deployment.asset.status,
        category: deployment.asset.category
      }
    }))
  } catch (error) {
    console.error("Error fetching user asset deployments:", error)
    throw new Error("Failed to fetch asset deployments")
  }
}

export async function getAllUserAssetDeployments(userId: string): Promise<AssetDeployment[]> {
  try {
    const deployments = await prisma.assetDeployment.findMany({
      where: {
        employeeId: userId
      },
      include: {
        asset: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: {
        deployedDate: 'desc'
      }
    })

    return deployments.map(deployment => ({
      id: deployment.id,
      transmittalNumber: deployment.transmittalNumber,
      deployedDate: deployment.deployedDate,
      expectedReturnDate: deployment.expectedReturnDate,
      returnedDate: deployment.returnedDate,
      status: deployment.status,
      deploymentNotes: deployment.deploymentNotes,
      returnNotes: deployment.returnNotes,
      deploymentCondition: deployment.deploymentCondition,
      returnCondition: deployment.returnCondition,
      asset: {
        id: deployment.asset.id,
        itemCode: deployment.asset.itemCode,
        description: deployment.asset.description,
        serialNumber: deployment.asset.serialNumber,
        brand: deployment.asset.brand,
        modelNumber: deployment.asset.modelNumber,
        status: deployment.asset.status,
        category: deployment.asset.category
      }
    }))
  } catch (error) {
    console.error("Error fetching all user asset deployments:", error)
    throw new Error("Failed to fetch asset deployments")
  }
}