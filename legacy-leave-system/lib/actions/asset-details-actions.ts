"use server"

import { prisma } from "@/lib/prisma"
import { AssetStatus, DepreciationMethod, DeploymentStatus } from "@prisma/client"

export interface AssetDetailsData {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  modelNumber: string | null
  brand: string | null
  specifications: any
  purchaseDate: Date | null
  purchasePrice: number | null
  warrantyExpiry: Date | null
  quantity: number
  status: AssetStatus
  location: string | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Depreciation fields
  depreciationMethod: DepreciationMethod | null
  usefulLifeYears: number | null
  usefulLifeMonths: number | null
  salvageValue: number | null
  currentBookValue: number | null
  accumulatedDepreciation: number
  depreciationStartDate: Date | null
  lastDepreciationDate: Date | null
  nextDepreciationDate: Date | null
  monthlyDepreciation: number | null
  isFullyDepreciated: boolean
  depreciationRate: number | null
  totalExpectedUnits: number | null
  currentUnits: number | null
  depreciationPerUnit: number | null
  
  // Pre-depreciation fields
  originalPurchaseDate: Date | null
  originalPurchasePrice: number | null
  originalUsefulLifeYears: number | null
  originalUsefulLifeMonths: number | null
  priorDepreciationAmount: number
  priorDepreciationMonths: number
  systemEntryDate: Date | null
  systemEntryBookValue: number | null
  remainingUsefulLifeYears: number | null
  remainingUsefulLifeMonths: number | null
  isPreDepreciated: boolean
  useSystemEntryAsStart: boolean
  
  // QR Code fields
  barcodeValue: string | null
  barcodeType: string | null
  barcodeGenerated: Date | null
  tagNumber: string | null
  
  // Assignment fields
  currentlyAssignedTo: string | null
  currentDeploymentId: string | null
  lastAssignedDate: Date | null
  
  // Relations
  category: {
    id: string
    name: string
    code: string
    description: string | null
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
    email: string | null
  }
  
  // GL Accounts
  assetAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  depreciationExpenseAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  accumulatedDepAccount: {
    id: string
    accountCode: string
    accountName: string
  } | null
  
  // Current deployment
  currentDeployment: {
    id: string
    transmittalNumber: string
    deployedDate: Date | null
    expectedReturnDate: Date | null
    status: DeploymentStatus
    deploymentNotes: string | null
    employee: {
      id: string
      name: string
      email: string | null
      employeeId: string
    }
  } | null
  
  // Recent history
  recentHistory: {
    id: string
    action: string
    performedAt: Date
    notes: string | null
    employee: {
      id: string
      name: string
    } | null
  }[]
  
  // Deployment history
  deploymentHistory: {
    id: string
    transmittalNumber: string
    deployedDate: Date | null
    returnedDate: Date | null
    status: DeploymentStatus
    employee: {
      id: string
      name: string
      employeeId: string
    }
  }[]
}

export async function getAssetDetails(assetId: string, businessUnitId: string): Promise<AssetDetailsData | null> {
  try {
    console.log(`Fetching asset details: ID=${assetId}, BusinessUnit=${businessUnitId}`)
    
    // Validate ID formats (support both UUID and CUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const cuidRegex = /^c[a-z0-9]{24}$/i
    
    const isValidId = (id: string) => uuidRegex.test(id) || cuidRegex.test(id)
    
    if (!isValidId(businessUnitId)) {
      console.log(`Invalid business unit ID format: ${businessUnitId}`)
      return null
    }
    
    // Try to find asset by ID first, then by item code as fallback
    let asset = null
    
    if (isValidId(assetId)) {
      // Standard UUID/CUID lookup
      asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          businessUnitId
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true
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
            email: true
          }
        },
        assetAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        depreciationExpenseAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        accumulatedDepAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        deployments: {
          where: {
            status: {
              in: ['DEPLOYED', 'APPROVED']
            },
            returnedDate: null
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true
              }
            }
          },
          orderBy: {
            deployedDate: 'desc'
          },
          take: 1
        },
        assetHistories: {
          include: {
            employee: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            performedAt: 'desc'
          },
          take: 10
        }
      }
    })
    } else {
      // Fallback: try to find by item code
      console.log(`Trying to find asset by item code: ${assetId}`)
      asset = await prisma.asset.findFirst({
        where: {
          itemCode: assetId,
          businessUnitId
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true
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
              email: true
            }
          },
          assetAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          depreciationExpenseAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          accumulatedDepAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          deployments: {
            where: {
              status: {
                in: ['DEPLOYED', 'APPROVED']
              },
              returnedDate: null
            },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  employeeId: true
                }
              }
            },
            orderBy: {
              deployedDate: 'desc'
            },
            take: 1
          },
          assetHistories: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              performedAt: 'desc'
            },
            take: 10
          }
        }
      })
    }

    if (!asset) {
      console.log(`Asset not found in database: ID/ItemCode=${assetId}, BusinessUnit=${businessUnitId}`)
      return null
    }
    
    console.log(`Asset found: ${asset.itemCode} - ${asset.description}`)

    // Get deployment history
    const deploymentHistory = await prisma.assetDeployment.findMany({
      where: {
        assetId: asset.id
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
      take: 20
    })

    return {
      ...asset,
      // Convert all Decimal fields to numbers
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      originalPurchasePrice: asset.originalPurchasePrice ? Number(asset.originalPurchasePrice) : null,
      salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
      depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
      totalExpectedUnits: asset.totalExpectedUnits || null,
      currentUnits: asset.currentUnits || null,
      depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(asset.priorDepreciationAmount),
      systemEntryBookValue: asset.systemEntryBookValue ? Number(asset.systemEntryBookValue) : null,
      // Relations
      currentDeployment: asset.deployments?.[0] || null,
      recentHistory: asset.assetHistories || [],
      deploymentHistory
    } as AssetDetailsData
  } catch (error) {
    console.error("Error fetching asset details:", error)
    throw new Error("Failed to fetch asset details")
  }
}

export async function updateAssetStatus(assetId: string, status: AssetStatus, businessUnitId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        businessUnitId
      }
    })

    if (!asset) {
      return { error: "Asset not found" }
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { status }
    })

    // Create history entry
    await prisma.assetHistory.create({
      data: {
        assetId,
        action: 'STATUS_CHANGED',
        previousStatus: asset.status,
        newStatus: status,
        notes: `Status changed from ${asset.status} to ${status}`,
        performedById: session.user.id,
        businessUnitId
      }
    })

    // Convert Decimal fields to numbers before returning
    const serializedAsset = {
      ...updatedAsset,
      purchasePrice: updatedAsset.purchasePrice ? Number(updatedAsset.purchasePrice) : null,
      originalPurchasePrice: updatedAsset.originalPurchasePrice ? Number(updatedAsset.originalPurchasePrice) : null,
      salvageValue: updatedAsset.salvageValue ? Number(updatedAsset.salvageValue) : null,
      currentBookValue: updatedAsset.currentBookValue ? Number(updatedAsset.currentBookValue) : null,
      accumulatedDepreciation: Number(updatedAsset.accumulatedDepreciation),
      monthlyDepreciation: updatedAsset.monthlyDepreciation ? Number(updatedAsset.monthlyDepreciation) : null,
      depreciationRate: updatedAsset.depreciationRate ? Number(updatedAsset.depreciationRate) : null,
      depreciationPerUnit: updatedAsset.depreciationPerUnit ? Number(updatedAsset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(updatedAsset.priorDepreciationAmount),
      systemEntryBookValue: updatedAsset.systemEntryBookValue ? Number(updatedAsset.systemEntryBookValue) : null
    }

    return { success: "Asset status updated successfully", data: serializedAsset }
  } catch (error) {
    console.error("Error updating asset status:", error)
    return { error: "Failed to update asset status" }
  }
}

export async function updateAssetLocation(assetId: string, location: string, businessUnitId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        businessUnitId
      }
    })

    if (!asset) {
      return { error: "Asset not found" }
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { location }
    })

    // Create history entry
    await prisma.assetHistory.create({
      data: {
        assetId,
        action: 'LOCATION_CHANGED',
        previousLocation: asset.location,
        newLocation: location,
        notes: `Location changed from "${asset.location || 'Not specified'}" to "${location}"`,
        performedById: session.user.id,
        businessUnitId
      }
    })

    // Convert Decimal fields to numbers before returning
    const serializedAsset = {
      ...updatedAsset,
      purchasePrice: updatedAsset.purchasePrice ? Number(updatedAsset.purchasePrice) : null,
      originalPurchasePrice: updatedAsset.originalPurchasePrice ? Number(updatedAsset.originalPurchasePrice) : null,
      salvageValue: updatedAsset.salvageValue ? Number(updatedAsset.salvageValue) : null,
      currentBookValue: updatedAsset.currentBookValue ? Number(updatedAsset.currentBookValue) : null,
      accumulatedDepreciation: Number(updatedAsset.accumulatedDepreciation),
      monthlyDepreciation: updatedAsset.monthlyDepreciation ? Number(updatedAsset.monthlyDepreciation) : null,
      depreciationRate: updatedAsset.depreciationRate ? Number(updatedAsset.depreciationRate) : null,
      depreciationPerUnit: updatedAsset.depreciationPerUnit ? Number(updatedAsset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(updatedAsset.priorDepreciationAmount),
      systemEntryBookValue: updatedAsset.systemEntryBookValue ? Number(updatedAsset.systemEntryBookValue) : null
    }

    return { success: "Asset location updated successfully", data: serializedAsset }
  } catch (error) {
    console.error("Error updating asset location:", error)
    return { error: "Failed to update asset location" }
  }
}

export interface UpdateAssetData {
  description: string
  serialNumber?: string
  modelNumber?: string
  brand?: string
  categoryId: string
  departmentId?: string
  location?: string
  notes?: string
  purchaseDate?: Date
  purchasePrice?: number
  warrantyExpiry?: Date
  status: AssetStatus
  isActive: boolean
  
  // Depreciation fields
  depreciationMethod?: DepreciationMethod
  usefulLifeYears?: number
  usefulLifeMonths?: number
  salvageValue?: number
  depreciationStartDate?: Date
  
  // GL Account fields
  assetAccountId?: string
  depreciationExpenseAccountId?: string
  accumulatedDepAccountId?: string
}

export async function updateAsset(assetId: string, data: UpdateAssetData, businessUnitId: string) {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    // Get current asset for comparison
    const currentAsset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        businessUnitId
      }
    })

    if (!currentAsset) {
      return { error: "Asset not found" }
    }

    // Calculate depreciation values if applicable
    let calculatedValues = {}
    let nextDepreciationDate = null

    // Check if we have depreciation method, purchase price, and useful life (in years or months)
    const hasUsefulLife = data.usefulLifeYears || (data.usefulLifeMonths && data.usefulLifeMonths > 0);
    
    if (data.depreciationMethod && data.purchasePrice && hasUsefulLife) {
      const purchasePrice = data.purchasePrice
      const salvageValue = data.salvageValue || 0
      const depreciableAmount = purchasePrice - salvageValue
      
      // Calculate total months - handle both formats
      let totalMonths = 0;
      if (data.usefulLifeMonths && data.usefulLifeMonths > 12) {
        // New format: total months stored in usefulLifeMonths
        totalMonths = data.usefulLifeMonths;
      } else {
        // Old format: years * 12 + additional months
        totalMonths = (data.usefulLifeYears || 0) * 12 + (data.usefulLifeMonths || 0);
      }

      switch (data.depreciationMethod) {
        case 'STRAIGHT_LINE':
          calculatedValues = {
            monthlyDepreciation: totalMonths > 0 ? depreciableAmount / totalMonths : 0,
            currentBookValue: purchasePrice - (currentAsset.accumulatedDepreciation ? Number(currentAsset.accumulatedDepreciation) : 0)
          }
          break
        // Add other depreciation methods as needed
      }

      // Set next depreciation date if depreciation start date is provided
      if (data.depreciationStartDate) {
        nextDepreciationDate = new Date(data.depreciationStartDate)
        nextDepreciationDate.setMonth(nextDepreciationDate.getMonth() + 1)
      }
    }

    // Update the asset
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        description: data.description,
        serialNumber: data.serialNumber || null,
        modelNumber: data.modelNumber || null,
        brand: data.brand || null,
        categoryId: data.categoryId,
        departmentId: data.departmentId || null,
        location: data.location || null,
        notes: data.notes || null,
        purchaseDate: data.purchaseDate || null,
        purchasePrice: data.purchasePrice || null,
        warrantyExpiry: data.warrantyExpiry || null,
        status: data.status,
        isActive: data.isActive,
        
        // Depreciation Configuration
        depreciationMethod: data.depreciationMethod || null,
        usefulLifeYears: data.usefulLifeYears || null,
        usefulLifeMonths: data.usefulLifeMonths || null,
        salvageValue: data.salvageValue || 0,
        depreciationStartDate: data.depreciationStartDate || null,
        nextDepreciationDate,
        
        // GL Accounts
        assetAccountId: data.assetAccountId || null,
        depreciationExpenseAccountId: data.depreciationExpenseAccountId || null,
        accumulatedDepAccountId: data.accumulatedDepAccountId || null,
        
        // Calculated values
        ...calculatedValues
      }
    })

    // Create history entry for the update
    await prisma.assetHistory.create({
      data: {
        assetId,
        action: 'UPDATED',
        notes: 'Asset information updated',
        performedById: session.user.id,
        businessUnitId
      }
    })

    // Create specific history entries for significant changes
    if (currentAsset.status !== data.status) {
      await prisma.assetHistory.create({
        data: {
          assetId,
          action: 'STATUS_CHANGED',
          previousStatus: currentAsset.status,
          newStatus: data.status,
          notes: `Status changed from ${currentAsset.status} to ${data.status}`,
          performedById: session.user.id,
          businessUnitId
        }
      })
    }

    if (currentAsset.location !== data.location) {
      await prisma.assetHistory.create({
        data: {
          assetId,
          action: 'LOCATION_CHANGED',
          previousLocation: currentAsset.location,
          newLocation: data.location,
          notes: `Location changed from "${currentAsset.location || 'Not specified'}" to "${data.location || 'Not specified'}"`,
          performedById: session.user.id,
          businessUnitId
        }
      })
    }

    // Convert Decimal fields to numbers before returning
    const serializedAsset = {
      ...updatedAsset,
      purchasePrice: updatedAsset.purchasePrice ? Number(updatedAsset.purchasePrice) : null,
      originalPurchasePrice: updatedAsset.originalPurchasePrice ? Number(updatedAsset.originalPurchasePrice) : null,
      salvageValue: updatedAsset.salvageValue ? Number(updatedAsset.salvageValue) : null,
      currentBookValue: updatedAsset.currentBookValue ? Number(updatedAsset.currentBookValue) : null,
      accumulatedDepreciation: Number(updatedAsset.accumulatedDepreciation),
      monthlyDepreciation: updatedAsset.monthlyDepreciation ? Number(updatedAsset.monthlyDepreciation) : null,
      depreciationRate: updatedAsset.depreciationRate ? Number(updatedAsset.depreciationRate) : null,
      depreciationPerUnit: updatedAsset.depreciationPerUnit ? Number(updatedAsset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(updatedAsset.priorDepreciationAmount),
      systemEntryBookValue: updatedAsset.systemEntryBookValue ? Number(updatedAsset.systemEntryBookValue) : null
    }

    return { success: "Asset updated successfully", data: serializedAsset }
  } catch (error) {
    console.error("Error updating asset:", error)
    return { error: "Failed to update asset" }
  }
}