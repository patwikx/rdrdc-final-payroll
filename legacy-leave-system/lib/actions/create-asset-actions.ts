"use server"

import { prisma } from "@/lib/prisma"
import { DepreciationMethod, AssetStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { generateQRCode } from "@/lib/utils/qr-code-generator"

export interface CreateAssetData {
  // Basic Information
  itemCode: string
  description: string
  serialNumber?: string
  modelNumber?: string
  brand?: string
  specifications?: Record<string, unknown>
  categoryId: string
  departmentId?: string
  quantity: number
  location?: string
  notes?: string
  
  // Purchase Information
  purchaseDate?: Date
  purchasePrice?: number
  warrantyExpiry?: Date
  
  // Financial Configuration
  assetAccountId?: string
  depreciationExpenseAccountId?: string
  accumulatedDepAccountId?: string
  
  // Depreciation Configuration
  depreciationMethod?: DepreciationMethod
  usefulLifeYears?: number
  usefulLifeMonths?: number
  salvageValue?: number
  depreciationStartDate?: Date
  
  // Pre-depreciation fields for assets already partially depreciated
  originalPurchaseDate?: Date
  originalPurchasePrice?: number
  originalUsefulLifeYears?: number
  originalUsefulLifeMonths?: number
  priorDepreciationAmount?: number
  priorDepreciationMonths?: number
  systemEntryDate?: Date
  systemEntryBookValue?: number
  remainingUsefulLifeYears?: number
  remainingUsefulLifeMonths?: number
  isPreDepreciated?: boolean
  useSystemEntryAsStart?: boolean
  
  // Units of Production specific
  totalExpectedUnits?: number
  
  // Declining Balance specific
  depreciationRate?: number
  
  // Status
  status: AssetStatus
  isActive: boolean
}

export async function getAssetCategories(businessUnitId: string) {
  try {
    const categories = await prisma.assetCategory.findMany({
      where: { 
        isActive: true,
        businessUnitId: businessUnitId
      },
      select: {
        id: true,
        name: true,
        code: true,
        defaultAssetAccountId: true,
        defaultDepreciationExpenseAccountId: true,
        defaultAccumulatedDepAccountId: true,
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
        }
      },
      orderBy: { name: 'asc' }
    })
    
    return categories
  } catch (error) {
    console.error("Error fetching asset categories:", error)
    throw new Error("Failed to fetch asset categories")
  }
}

export async function getDepartments(businessUnitId?: string, includeInactive: boolean = false) {
  try {
    let whereClause: any = {}
    
    if (businessUnitId) {
      // Include departments that belong to this business unit OR have no business unit assigned
      whereClause.OR = [
        { businessUnitId },
        { businessUnitId: null }
      ]
    }
    
    if (!includeInactive) {
      whereClause.OR ? 
        whereClause.AND = [{ OR: whereClause.OR }, { isActive: { not: false } }] :
        whereClause.isActive = { not: false } // This includes true and null values
      delete whereClause.OR
    }
      
    const departments = await prisma.department.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        businessUnitId: true
      },
      orderBy: { name: 'asc' }
    })
    
    console.log(`Found ${departments.length} departments for businessUnit: ${businessUnitId}`, departments)
    
    return departments
  } catch (error) {
    console.error("Error fetching departments:", error)
    throw new Error("Failed to fetch departments")
  }
}

export async function getGLAccounts() {
  try {
    const accounts = await prisma.gLAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true
      },
      orderBy: { accountCode: 'asc' }
    })
    
    return accounts
  } catch (error) {
    console.error("Error fetching GL accounts:", error)
    throw new Error("Failed to fetch GL accounts")
  }
}

export async function generateItemCode(categoryId: string) {
  try {
    const category = await prisma.assetCategory.findUnique({
      where: { id: categoryId },
      select: { code: true }
    })
    
    if (!category) {
      throw new Error("Category not found")
    }
    
    // Get the last asset with this category code
    const lastAsset = await prisma.asset.findFirst({
      where: {
        itemCode: {
          startsWith: `${category.code}-`
        }
      },
      orderBy: {
        itemCode: 'desc'
      },
      select: {
        itemCode: true
      }
    })
    
    let nextNumber = 1
    if (lastAsset) {
      // Extract the number part from the item code (after the dash)
      const parts = lastAsset.itemCode.split('-')
      if (parts.length >= 2) {
        const currentNumber = parseInt(parts[parts.length - 1]) || 0
        nextNumber = currentNumber + 1
      }
    }
    
    // Format with leading zeros (e.g., ITSZ-00001, ITSZ-00002, etc.)
    const formattedNumber = nextNumber.toString().padStart(5, '0')
    return `${category.code}-${formattedNumber}`
    
  } catch (error) {
    console.error("Error generating item code:", error)
    throw new Error("Failed to generate item code")
  }
}

export async function createAsset(data: CreateAssetData, businessUnitId: string) {
  try {
    // Get current user from auth
    const { auth } = await import("@/auth")
    const session = await auth()
    
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }
    // Check if item code already exists
    const existingAsset = await prisma.asset.findUnique({
      where: { itemCode: data.itemCode }
    })
    
    if (existingAsset) {
      return { error: "Item code already exists" }
    }
    
    // Calculate depreciation values if depreciation is configured
    let calculatedValues = {}
    
    if (data.depreciationMethod) {
      // Handle pre-depreciated assets
      if (data.isPreDepreciated && data.systemEntryBookValue && (data.originalUsefulLifeYears || (data.originalUsefulLifeMonths && data.originalUsefulLifeMonths > 0))) {
        const remainingBookValue = data.systemEntryBookValue - (data.salvageValue || 0)
        
        // Calculate original total months - handle both formats
        let originalTotalMonths = 0;
        if (data.originalUsefulLifeMonths && data.originalUsefulLifeMonths > 12) {
          // New format: total months stored in originalUsefulLifeMonths
          originalTotalMonths = data.originalUsefulLifeMonths;
        } else {
          // Old format: years * 12 + additional months
          originalTotalMonths = (data.originalUsefulLifeYears || 0) * 12 + (data.originalUsefulLifeMonths || 0);
        }
        const priorMonths = data.priorDepreciationMonths || 0
        const remainingMonths = originalTotalMonths - priorMonths
        
        calculatedValues = {
          monthlyDepreciation: remainingMonths > 0 ? remainingBookValue / remainingMonths : 0,
          currentBookValue: data.systemEntryBookValue,
          accumulatedDepreciation: data.priorDepreciationAmount || 0,
          remainingUsefulLifeYears: Math.floor(remainingMonths / 12),
          remainingUsefulLifeMonths: remainingMonths % 12
        }
      }
      // Standard depreciation calculation
      else if (data.purchasePrice && (data.usefulLifeYears || (data.usefulLifeMonths && data.usefulLifeMonths > 0))) {
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
              currentBookValue: purchasePrice
            }
            break
            
          case 'DECLINING_BALANCE':
            if (data.depreciationRate) {
              const annualDepreciation = purchasePrice * (data.depreciationRate / 100)
              calculatedValues = {
                monthlyDepreciation: annualDepreciation / 12,
                currentBookValue: purchasePrice,
                depreciationRate: data.depreciationRate
              }
            }
            break
            
          case 'UNITS_OF_PRODUCTION':
            if (data.totalExpectedUnits && data.totalExpectedUnits > 0) {
              calculatedValues = {
                depreciationPerUnit: depreciableAmount / data.totalExpectedUnits,
                totalExpectedUnits: data.totalExpectedUnits,
                currentBookValue: purchasePrice
              }
            }
            break
            
          case 'SUM_OF_YEARS_DIGITS':
            // Calculate total years from months
            const totalYears = Math.ceil(totalMonths / 12)
            const sumOfYears = (totalYears * (totalYears + 1)) / 2
            const firstYearDepreciation = (depreciableAmount * totalYears) / sumOfYears
            calculatedValues = {
              monthlyDepreciation: firstYearDepreciation / 12,
              currentBookValue: purchasePrice
            }
            break
        }
      }
    }
    
    // Set next depreciation date
    let nextDepreciationDate = null
    if (data.isPreDepreciated && data.useSystemEntryAsStart && data.systemEntryDate) {
      // For pre-depreciated assets, start from system entry date
      nextDepreciationDate = new Date(data.systemEntryDate)
      nextDepreciationDate.setMonth(nextDepreciationDate.getMonth() + 1)
    } else if (data.depreciationStartDate) {
      // Standard depreciation start date
      nextDepreciationDate = new Date(data.depreciationStartDate)
      nextDepreciationDate.setMonth(nextDepreciationDate.getMonth() + 1)
    }
    
    // Create the asset first to get the ID
    const asset = await prisma.asset.create({
      data: {
        itemCode: data.itemCode,
        description: data.description,
        serialNumber: data.serialNumber || null,
        modelNumber: data.modelNumber || null,
        brand: data.brand || null,
        specifications: data.specifications ? JSON.parse(JSON.stringify(data.specifications)) : null,
        purchaseDate: data.purchaseDate || null,
        purchasePrice: data.purchasePrice || null,
        warrantyExpiry: data.warrantyExpiry || null,
        categoryId: data.categoryId,
        businessUnitId,
        departmentId: data.departmentId || null,
        quantity: data.quantity,
        status: data.status,
        location: data.location || null,
        notes: data.notes || null,
        createdById: session.user.id,
        isActive: data.isActive,
        
        // Financial Configuration
        assetAccountId: data.assetAccountId || null,
        depreciationExpenseAccountId: data.depreciationExpenseAccountId || null,
        accumulatedDepAccountId: data.accumulatedDepAccountId || null,
        
        // Depreciation Configuration
        depreciationMethod: data.depreciationMethod || null,
        usefulLifeYears: data.usefulLifeYears || null,
        usefulLifeMonths: data.usefulLifeMonths || null,
        salvageValue: data.salvageValue || 0,
        depreciationStartDate: data.depreciationStartDate || null,
        nextDepreciationDate,
        
        // Pre-depreciation fields
        originalPurchaseDate: data.originalPurchaseDate || null,
        originalPurchasePrice: data.originalPurchasePrice || null,
        originalUsefulLifeYears: data.originalUsefulLifeYears || null,
        originalUsefulLifeMonths: data.originalUsefulLifeMonths || null,
        priorDepreciationAmount: data.priorDepreciationAmount || 0,
        priorDepreciationMonths: data.priorDepreciationMonths || 0,
        systemEntryDate: data.systemEntryDate || null,
        systemEntryBookValue: data.systemEntryBookValue || null,
        remainingUsefulLifeYears: data.remainingUsefulLifeYears || null,
        remainingUsefulLifeMonths: data.remainingUsefulLifeMonths || null,
        isPreDepreciated: data.isPreDepreciated || false,
        useSystemEntryAsStart: data.useSystemEntryAsStart || false,
        
        // QR Code - will be generated after asset creation
        barcodeValue: null,
        barcodeType: 'QR_CODE',
        barcodeGenerated: null,
        
        // Calculated values
        ...calculatedValues
      }
    })

    // Generate QR code and store it in the database
    let qrCodeDataURL = null
    try {
      qrCodeDataURL = await generateQRCode({
        itemCode: data.itemCode,
        description: data.description,
        serialNumber: data.serialNumber,
        businessUnitId,
        assetId: asset.id
      })

      // Update the asset with the QR code data
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          barcodeValue: qrCodeDataURL,
          barcodeGenerated: new Date()
        }
      })
    } catch (error) {
      console.error("Error generating QR code:", error)
      // Continue without QR code - can be generated later
    }
    
    // Convert Decimal fields to numbers for client serialization
    const serializedAsset = {
      ...asset,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      originalPurchasePrice: asset.originalPurchasePrice ? Number(asset.originalPurchasePrice) : null,
      salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      monthlyDepreciation: asset.monthlyDepreciation ? Number(asset.monthlyDepreciation) : null,
      depreciationRate: asset.depreciationRate ? Number(asset.depreciationRate) : null,
      depreciationPerUnit: asset.depreciationPerUnit ? Number(asset.depreciationPerUnit) : null,
      priorDepreciationAmount: Number(asset.priorDepreciationAmount),
      systemEntryBookValue: asset.systemEntryBookValue ? Number(asset.systemEntryBookValue) : null
    }

    revalidatePath(`/${businessUnitId}/asset-management/assets`)
    return { 
      success: "Asset created successfully", 
      data: { 
        ...serializedAsset,
        qrCode: qrCodeDataURL 
      } 
    }
    
  } catch (error) {
    console.error("Error creating asset:", error)
    return { error: "Failed to create asset" }
  }
}