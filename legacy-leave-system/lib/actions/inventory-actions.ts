"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// Helper to check authentication
async function checkAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user
}

// Get single inventory item by ID
export async function getInventoryItemById(itemId: string) {
  try {
    await checkAuth()

    const item = await prisma.damagedInventoryItem.findUnique({
      where: { id: itemId },
      include: {
        damagedInventory: {
          select: {
            id: true,
            businessUnitId: true,
            damageType: true,
            location: true,
            createdAt: true
          }
        }
      }
    })

    if (!item) {
      return null
    }

    const acquisitionCost = Number(item.totalAcquisitionCost)
    const sellingAmount = Number(item.totalRecoveredAmount)
    const profitLoss = item.unitRecoveredPrice ? sellingAmount - acquisitionCost : 0

    return {
      id: item.id,
      itemCode: item.itemCode,
      description: item.description,
      quantity: item.quantity,
      uom: item.uom,
      unitAcquisitionCost: Number(item.unitAcquisitionCost),
      totalAcquisitionCost: acquisitionCost,
      damageType: item.damagedInventory.damageType,
      damageCondition: item.damageCondition,
      location: item.damagedInventory.location,
      isServiceable: item.isServiceable,
      estimatedRecoveryValue: item.estimatedRecoveryValue ? Number(item.estimatedRecoveryValue) : null,
      unitSellingPrice: item.unitRecoveredPrice ? Number(item.unitRecoveredPrice) : null,
      totalSellingAmount: sellingAmount,
      soldQuantity: item.soldQuantity,
      saleDate: item.saleDate,
      saleNotes: item.saleNotes,
      profitLoss,
      status: item.isServiceable ? (sellingAmount > 0 ? 'SOLD' : 'AVAILABLE') : 'DAMAGED',
      remarks: item.remarks,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }
  } catch (error) {
    console.error("Error fetching inventory item:", error)
    throw new Error("Failed to fetch inventory item")
  }
}

// Get all inventory items for a business unit
export async function getInventoryItems(businessUnitId: string, filters?: {
  status?: string
  search?: string
}) {
  try {
    await checkAuth()
    
    const items = await prisma.damagedInventoryItem.findMany({
      where: {
        damagedInventory: {
          businessUnitId
        }
      },
      include: {
        damagedInventory: {
          select: {
            id: true,
            businessUnitId: true,
            damageType: true,
            location: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Convert Decimal to number and calculate profit/loss
    return items.map(item => {
      const acquisitionCost = Number(item.totalAcquisitionCost)
      const sellingAmount = Number(item.totalRecoveredAmount)
      const profitLoss = item.unitRecoveredPrice ? sellingAmount - acquisitionCost : 0
      
      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        unitAcquisitionCost: Number(item.unitAcquisitionCost),
        totalAcquisitionCost: acquisitionCost,
        damageType: item.damagedInventory.damageType,
        damageCondition: item.damageCondition,
        location: item.damagedInventory.location,
        isServiceable: item.isServiceable,
        estimatedRecoveryValue: item.estimatedRecoveryValue ? Number(item.estimatedRecoveryValue) : null,
        unitSellingPrice: item.unitRecoveredPrice ? Number(item.unitRecoveredPrice) : null,
        totalSellingAmount: sellingAmount,
        soldQuantity: item.soldQuantity,
        saleDate: item.saleDate,
        saleNotes: item.saleNotes,
        profitLoss,
        status: item.isServiceable ? (sellingAmount > 0 ? 'SOLD' : 'AVAILABLE') : 'DAMAGED',
        remarks: item.remarks,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    })
  } catch (error) {
    console.error("Error fetching inventory items:", error)
    throw new Error("Failed to fetch inventory items")
  }
}

// Get dashboard summary
export async function getInventorySummary(businessUnitId: string) {
  try {
    await checkAuth()
    
    const items = await getInventoryItems(businessUnitId)
    
    const totalItems = items.length
    const totalAcquisitionCost = items.reduce((sum, item) => sum + item.totalAcquisitionCost, 0)
    const totalSellingAmount = items.reduce((sum, item) => sum + item.totalSellingAmount, 0)
    const totalProfitLoss = items
      .filter(item => item.unitSellingPrice !== null)
      .reduce((sum, item) => sum + item.profitLoss, 0)
    
    const availableCount = items.filter(i => i.status === 'AVAILABLE').length
    const soldCount = items.filter(i => i.status === 'SOLD').length
    const damagedCount = items.filter(i => i.status === 'DAMAGED').length
    
    return {
      totalItems,
      totalAcquisitionCost,
      totalSellingAmount,
      totalProfitLoss,
      statusCounts: {
        available: availableCount,
        sold: soldCount,
        damaged: damagedCount
      }
    }
  } catch (error) {
    console.error("Error fetching inventory summary:", error)
    throw new Error("Failed to fetch inventory summary")
  }
}

// Add new inventory item
export async function addInventoryItem(data: {
  businessUnitId: string
  damageType: string
  damageSeverity: string
  location?: string
  tenantName?: string
  tenantContact?: string
  itemCode?: string
  description: string
  quantity: number
  uom: string
  unitAcquisitionCost: number
  damageCondition?: string
  isDamaged?: boolean
  estimatedRecoveryValue?: number
  remarks?: string
}) {
  try {
    const user = await checkAuth()
    
    const totalAcquisitionCost = data.quantity * data.unitAcquisitionCost
    
    // Create a simple "incident" container (we're reusing the existing schema)
    const container = await prisma.damagedInventory.create({
      data: {
        damageNumber: `INV-${Date.now()}`, // Simple unique number
        businessUnitId: data.businessUnitId,
        damageType: data.damageType as any,
        damageSeverity: data.damageSeverity as any,
        damageDate: new Date(),
        location: data.location,
        tenantName: data.tenantName,
        tenantContact: data.tenantContact,
        totalAcquisitionCost,
        totalRecoveredAmount: 0,
        totalLossAmount: 0,
        reportedById: user.id,
        status: 'APPROVED', // Skip workflow
        recoveryStatus: 'PENDING_ASSESSMENT'
      }
    })
    
    // Create the actual item
    await prisma.damagedInventoryItem.create({
      data: {
        damagedInventoryId: container.id,
        itemCode: data.itemCode,
        description: data.description,
        quantity: data.quantity,
        uom: data.uom,
        unitAcquisitionCost: data.unitAcquisitionCost,
        totalAcquisitionCost,
        damageCondition: data.damageCondition,
        isServiceable: !data.isDamaged,
        estimatedRecoveryValue: data.estimatedRecoveryValue,
        unitRecoveredPrice: null,
        totalRecoveredAmount: 0,
        unitLossAmount: 0,
        totalLossAmount: 0,
        remarks: data.remarks
      }
    })
    
    revalidatePath(`/${data.businessUnitId}/inventory`)
    
    return { 
      success: true, 
      message: "Inventory item added successfully"
    }
  } catch (error) {
    console.error("Error adding inventory item:", error)
    return { 
      success: false, 
      error: "Failed to add inventory item" 
    }
  }
}

// Update inventory item
export async function updateInventoryItem(
  itemId: string,
  businessUnitId: string,
  data: {
    itemCode?: string
    description?: string
    quantity?: number
    uom?: string
    unitAcquisitionCost?: number
    damageCondition?: string
    isDamaged?: boolean
    estimatedRecoveryValue?: number
    remarks?: string
  }
) {
  try {
    await checkAuth()
    
    const item = await prisma.damagedInventoryItem.findUnique({
      where: { id: itemId }
    })
    
    if (!item) {
      return { success: false, error: "Item not found" }
    }
    
    // Calculate new values
    const quantity = data.quantity ?? item.quantity
    const unitAcquisitionCost = data.unitAcquisitionCost ?? Number(item.unitAcquisitionCost)
    const totalAcquisitionCost = quantity * unitAcquisitionCost
    
    await prisma.damagedInventoryItem.update({
      where: { id: itemId },
      data: {
        itemCode: data.itemCode,
        description: data.description,
        quantity,
        uom: data.uom,
        unitAcquisitionCost,
        totalAcquisitionCost,
        damageCondition: data.damageCondition,
        isServiceable: data.isDamaged !== undefined ? !data.isDamaged : item.isServiceable,
        estimatedRecoveryValue: data.estimatedRecoveryValue,
        remarks: data.remarks
      }
    })
    
    revalidatePath(`/${businessUnitId}/inventory`)
    
    return { 
      success: true, 
      message: "Inventory item updated successfully"
    }
  } catch (error) {
    console.error("Error updating inventory item:", error)
    return { 
      success: false, 
      error: "Failed to update inventory item" 
    }
  }
}

// Delete inventory item
export async function deleteInventoryItem(itemId: string, businessUnitId: string) {
  try {
    await checkAuth()
    
    await prisma.damagedInventoryItem.delete({
      where: { id: itemId }
    })
    
    revalidatePath(`/${businessUnitId}/inventory`)
    
    return { 
      success: true, 
      message: "Inventory item deleted successfully"
    }
  } catch (error) {
    console.error("Error deleting inventory item:", error)
    return { 
      success: false, 
      error: "Failed to delete inventory item" 
    }
  }
}

// Sell inventory item
export async function sellInventoryItem(
  itemId: string,
  businessUnitId: string,
  unitSellingPrice: number,
  quantitySold: number,
  buyerName?: string,
  saleRemarks?: string
) {
  try {
    await checkAuth()

    const item = await prisma.damagedInventoryItem.findUnique({
      where: { id: itemId }
    })

    if (!item) {
      return { success: false, error: "Item not found" }
    }

    if (item.unitRecoveredPrice) {
      return { success: false, error: "Item has already been sold" }
    }

    if (quantitySold > item.quantity) {
      return { success: false, error: "Cannot sell more than available quantity" }
    }

    const totalSellingAmount = quantitySold * unitSellingPrice
    const acquisitionCostForSale = quantitySold * Number(item.unitAcquisitionCost)
    const profitLoss = totalSellingAmount - acquisitionCostForSale

    await prisma.damagedInventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: item.quantity - quantitySold,
        soldQuantity: (item.soldQuantity || 0) + quantitySold,
        saleDate: new Date(),
        saleNotes: [
          buyerName ? `Buyer: ${buyerName}` : null,
          saleRemarks
        ].filter(Boolean).join(' | ') || null,
        unitRecoveredPrice: unitSellingPrice,
        totalRecoveredAmount: Number(item.totalRecoveredAmount) + totalSellingAmount,
        unitLossAmount: profitLoss < 0 ? Math.abs(profitLoss) / quantitySold : 0,
        totalLossAmount: Number(item.totalLossAmount) + (profitLoss < 0 ? Math.abs(profitLoss) : 0)
      }
    })

    revalidatePath(`/${businessUnitId}/inventory`)
    revalidatePath(`/${businessUnitId}/inventory/${itemId}`)

    return {
      success: true,
      message: `Successfully sold ${quantitySold} ${item.uom}`
    }
  } catch (error) {
    console.error("Error selling inventory item:", error)
    return {
      success: false,
      error: "Failed to sell inventory item"
    }
  }
}

// Get damaged inventory report by date range
export async function getDamagedInventoryReport(
  businessUnitId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    await checkAuth()

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const items = await prisma.damagedInventoryItem.findMany({
      where: {
        damagedInventory: {
          businessUnitId
        },
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        damagedInventory: {
          select: {
            id: true,
            businessUnitId: true,
            damageType: true,
            location: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const mappedItems = items.map(item => {
      const acquisitionCost = Number(item.totalAcquisitionCost)
      const sellingAmount = Number(item.totalRecoveredAmount)
      const profitLoss = item.unitRecoveredPrice ? sellingAmount - acquisitionCost : 0

      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom,
        unitAcquisitionCost: Number(item.unitAcquisitionCost),
        totalAcquisitionCost: acquisitionCost,
        damageType: item.damagedInventory.damageType,
        damageCondition: item.damageCondition,
        location: item.damagedInventory.location,
        unitSellingPrice: item.unitRecoveredPrice ? Number(item.unitRecoveredPrice) : null,
        totalSellingAmount: sellingAmount,
        soldQuantity: item.soldQuantity,
        saleDate: item.saleDate,
        profitLoss,
        status: item.isServiceable ? (sellingAmount > 0 ? 'SOLD' : 'AVAILABLE') : 'DAMAGED',
        createdAt: item.createdAt
      }
    })

    // Calculate summary
    const totalItems = mappedItems.length
    const totalItemsAdded = mappedItems.length
    const totalItemsSold = mappedItems.filter(i => i.soldQuantity && i.soldQuantity > 0).length
    const totalAcquisitionCost = mappedItems.reduce((sum, item) => sum + item.totalAcquisitionCost, 0)
    const totalSellingAmount = mappedItems.reduce((sum, item) => sum + item.totalSellingAmount, 0)
    const totalProfitLoss = mappedItems
      .filter(item => item.unitSellingPrice !== null)
      .reduce((sum, item) => sum + item.profitLoss, 0)

    return {
      items: mappedItems,
      summary: {
        totalItems,
        totalItemsAdded,
        totalItemsSold,
        totalAcquisitionCost,
        totalSellingAmount,
        totalProfitLoss
      }
    }
  } catch (error) {
    console.error("Error generating damaged inventory report:", error)
    throw new Error("Failed to generate report")
  }
}

// Import inventory from CSV
export async function importInventoryFromCSV(businessUnitId: string, csvText: string) {
  try {
    const user = await checkAuth()

    // Parse CSV
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return { success: false, error: 'CSV file is empty or invalid' }
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const rows = lines.slice(1).filter(line => line.trim())

    let successCount = 0
    let failCount = 0
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const values = rows[i].split(',').map(v => v.trim())
      const rowData: Record<string, string> = {}
      
      headers.forEach((header, index) => {
        rowData[header] = values[index] || ''
      })

      try {
        // Validate required fields
        if (!rowData.damageType || !rowData.damageSeverity || !rowData.description || 
            !rowData.quantity || !rowData.uom || !rowData.unitAcquisitionCost) {
          errors.push({ row: i + 2, error: 'Missing required fields' })
          failCount++
          continue
        }

        const totalAcquisitionCost = parseInt(rowData.quantity) * parseFloat(rowData.unitAcquisitionCost)

        // Create container
        const container = await prisma.damagedInventory.create({
          data: {
            damageNumber: `INV-${Date.now()}-${i}`,
            businessUnitId,
            damageType: rowData.damageType as any,
            damageSeverity: rowData.damageSeverity as any,
            damageDate: new Date(),
            location: rowData.location || null,
            tenantName: rowData.tenantName || null,
            tenantContact: rowData.tenantContact || null,
            totalAcquisitionCost,
            totalRecoveredAmount: 0,
            totalLossAmount: 0,
            reportedById: user.id,
            status: 'APPROVED',
            recoveryStatus: 'PENDING_ASSESSMENT'
          }
        })

        // Create item
        await prisma.damagedInventoryItem.create({
          data: {
            damagedInventoryId: container.id,
            itemCode: rowData.itemCode || null,
            description: rowData.description,
            quantity: parseInt(rowData.quantity),
            uom: rowData.uom,
            unitAcquisitionCost: parseFloat(rowData.unitAcquisitionCost),
            totalAcquisitionCost,
            damageCondition: rowData.damageCondition || null,
            isServiceable: rowData.isNonServiceable?.toUpperCase() !== 'TRUE',
            estimatedRecoveryValue: rowData.estimatedRecoveryValue ? parseFloat(rowData.estimatedRecoveryValue) : null,
            unitRecoveredPrice: null,
            totalRecoveredAmount: 0,
            unitLossAmount: 0,
            totalLossAmount: 0,
            remarks: rowData.remarks || null
          }
        })

        successCount++
      } catch (error) {
        console.error(`Error importing row ${i + 2}:`, error)
        errors.push({ row: i + 2, error: 'Failed to import row' })
        failCount++
      }
    }

    revalidatePath(`/${businessUnitId}/inventory`)

    return {
      success: successCount > 0,
      message: `Successfully imported ${successCount} items`,
      successCount,
      failCount,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    console.error('Error importing CSV:', error)
    return { success: false, error: 'Failed to import CSV file' }
  }
}
