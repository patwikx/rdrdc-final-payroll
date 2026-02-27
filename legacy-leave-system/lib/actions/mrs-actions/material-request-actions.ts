"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { MRSRequestStatus, RequestType, ApprovalStatus, ApproverType } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/auth"
import { Decimal } from "@prisma/client/runtime/library"

// Validation schemas
const MaterialRequestItemSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  uom: z.string().min(1, "Unit of measurement is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().optional(),
  remarks: z.string().optional(),
  isNew: z.boolean().default(true),
}).refine((data) => {
  if (!data.isNew && !data.itemCode) {
    return false
  }
  return true
}, {
  message: "Item code is required for existing items",
  path: ["itemCode"]
})

const CreateMaterialRequestSchema = z.object({
  docNo: z.string().optional(), // Will be generated server-side
  series: z.string().min(1, "Series is required"),
  type: z.nativeEnum(RequestType),
  status: z.nativeEnum(MRSRequestStatus).default(MRSRequestStatus.DRAFT),
  datePrepared: z.date(),
  dateRequired: z.date(),
  businessUnitId: z.string().min(1, "Business unit is required"),
  departmentId: z.string().optional(),
  recApproverId: z.string().optional(),
  finalApproverId: z.string().optional(),
  chargeTo: z.string().optional(),
  bldgCode: z.string().optional(),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
  deliverTo: z.string().optional(),
  freight: z.number().default(0),
  discount: z.number().default(0),
  isStoreUse: z.boolean().default(false),
  items: z.array(MaterialRequestItemSchema).min(1, "At least one item is required"),
})

const UpdateMaterialRequestSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(RequestType),
  datePrepared: z.date(),
  dateRequired: z.date(),
  businessUnitId: z.string().min(1, "Business unit is required"),
  departmentId: z.string().optional(),
  recApproverId: z.string().optional(),
  finalApproverId: z.string().optional(),
  chargeTo: z.string().optional(),
  bldgCode: z.string().optional(),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
  deliverTo: z.string().optional(),
  freight: z.number().default(0),
  discount: z.number().default(0),
  items: z.array(MaterialRequestItemSchema).min(1, "At least one item is required"),
})

const ApprovalSchema = z.object({
  requestId: z.string(),
  status: z.nativeEnum(ApprovalStatus),
  remarks: z.string().optional(),
})

export type CreateMaterialRequestInput = z.infer<typeof CreateMaterialRequestSchema>
export type UpdateMaterialRequestInput = z.infer<typeof UpdateMaterialRequestSchema>
export type ApprovalInput = z.infer<typeof ApprovalSchema>

export interface ActionResult {
  success: boolean
  message: string
  data?: {
    autoPosted?: boolean
    [key: string]: unknown
  }
}

// Generate document number
async function generateDocumentNumber(series: string): Promise<string> {
  const currentYear = new Date().getFullYear()
  const yearSuffix = currentYear.toString().slice(-2)
  
  // Get the latest document number for this series
  const latestRequest = await prisma.materialRequest.findFirst({
    where: {
      series: series,
      docNo: {
        contains: `-${yearSuffix}-`
      }
    },
    orderBy: {
      docNo: 'desc'
    }
  })

  let nextNumber = 1
  if (latestRequest) {
    const parts = latestRequest.docNo.split('-')
    if (parts.length >= 3) {
      const lastNumber = parseInt(parts[2])
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1
      }
    }
  }

  return `${series}-${yearSuffix}-${nextNumber.toString().padStart(5, '0')}`
}

export async function createMaterialRequest(input: CreateMaterialRequestInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const validatedData = CreateMaterialRequestSchema.parse(input)
    


    // Generate document number automatically
    const docNo = await generateDocumentNumber(validatedData.series)

    // Calculate total
    const total = validatedData.items.reduce((sum, item) => {
      const itemTotal = (item.unitPrice || 0) * item.quantity
      return sum + itemTotal
    }, 0) + validatedData.freight - validatedData.discount

    // Create the material request with items
    const materialRequest = await prisma.materialRequest.create({
      data: {
        docNo: docNo,
        series: validatedData.series,
        type: validatedData.type,
        status: validatedData.status,
        datePrepared: validatedData.datePrepared,
        dateRequired: validatedData.dateRequired,
        businessUnitId: validatedData.businessUnitId,
        departmentId: validatedData.departmentId || null,
        recApproverId: validatedData.recApproverId || null,
        finalApproverId: validatedData.finalApproverId || null,
        chargeTo: validatedData.chargeTo || null,
        bldgCode: validatedData.bldgCode || null,
        purpose: validatedData.purpose || null,
        remarks: validatedData.remarks || null,
        deliverTo: validatedData.deliverTo || null,
        freight: new Decimal(validatedData.freight),
        discount: new Decimal(validatedData.discount),
        total: new Decimal(total),
        isStoreUse: validatedData.isStoreUse,
        requestedById: session.user.id,
        items: {
          create: validatedData.items.map(item => ({
            itemCode: item.itemCode || null,
            description: item.description,
            uom: item.uom,
            quantity: new Decimal(item.quantity),
            unitPrice: item.unitPrice ? new Decimal(item.unitPrice) : null,
            totalPrice: item.unitPrice ? new Decimal(item.unitPrice * item.quantity) : null,
            remarks: item.remarks || null,
          }))
        }
      },
      include: {
        items: true,
        businessUnit: true,
        department: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedMaterialRequest = {
      ...materialRequest,
      freight: Number(materialRequest.freight),
      discount: Number(materialRequest.discount),
      total: Number(materialRequest.total),
      items: materialRequest.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }

    revalidatePath("/material-requests")
    
    return {
      success: true,
      message: "Material request created successfully",
      data: serializedMaterialRequest
    }
  } catch (error) {
    console.error("Error creating material request:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      const fieldPath = firstError.path.join('.')
      return {
        success: false,
        message: `Validation error in ${fieldPath}: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to create material request"
    }
  }
}

export async function updateMaterialRequest(input: UpdateMaterialRequestInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const validatedData = UpdateMaterialRequestSchema.parse(input)

    // Check if user can edit this request
    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: validatedData.id },
      include: { items: true }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    if (existingRequest.requestedById !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You can only edit your own requests" }
    }

    // Check if any approval has been made
    const hasAnyApproval = 
      existingRequest.budgetApprovalStatus === ApprovalStatus.APPROVED ||
      existingRequest.recApprovalStatus === ApprovalStatus.APPROVED || 
      existingRequest.finalApprovalStatus === ApprovalStatus.APPROVED

    // Allow editing if:
    // 1. Status is DRAFT or FOR_EDIT, OR
    // 2. No approvals have been made yet AND status is not DISAPPROVED, POSTED, or DEPLOYED
    const canEdit = 
      existingRequest.status === MRSRequestStatus.DRAFT || 
      existingRequest.status === MRSRequestStatus.FOR_EDIT ||
      (!hasAnyApproval && 
        existingRequest.status !== MRSRequestStatus.DISAPPROVED &&
        existingRequest.status !== MRSRequestStatus.POSTED &&
        existingRequest.status !== MRSRequestStatus.DEPLOYED)

    if (!canEdit) {
      return { success: false, message: "Cannot edit request in current status. Request has already been approved or is in a final state." }
    }

    // Calculate total
    const total = validatedData.items.reduce((sum, item) => {
      const itemTotal = (item.unitPrice || 0) * item.quantity
      return sum + itemTotal
    }, 0) + validatedData.freight - validatedData.discount

    // Update the material request
    const materialRequest = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.materialRequestItem.deleteMany({
        where: { materialRequestId: validatedData.id }
      })

      // Update request and create new items
      return await tx.materialRequest.update({
        where: { id: validatedData.id },
        data: {
          type: validatedData.type,
          datePrepared: validatedData.datePrepared,
          dateRequired: validatedData.dateRequired,
          businessUnitId: validatedData.businessUnitId,
          departmentId: validatedData.departmentId || null,
          chargeTo: validatedData.chargeTo || null,
          bldgCode: validatedData.bldgCode || null,
          purpose: validatedData.purpose || null,
          remarks: validatedData.remarks || null,
          deliverTo: validatedData.deliverTo || null,
          freight: new Decimal(validatedData.freight),
          discount: new Decimal(validatedData.discount),
          total: new Decimal(total),
          status: MRSRequestStatus.DRAFT, // Reset to draft when edited
          items: {
            create: validatedData.items.map(item => ({
              itemCode: item.itemCode || null,
              description: item.description,
              uom: item.uom,
              quantity: new Decimal(item.quantity),
              unitPrice: item.unitPrice ? new Decimal(item.unitPrice) : null,
              totalPrice: item.unitPrice ? new Decimal(item.unitPrice * item.quantity) : null,
              remarks: item.remarks || null,
            }))
          }
        },
        include: {
          items: true,
          businessUnit: true,
          department: true,
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true,
            }
          },
        }
      })
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedMaterialRequest = {
      ...materialRequest,
      freight: Number(materialRequest.freight),
      discount: Number(materialRequest.discount),
      total: Number(materialRequest.total),
      items: materialRequest.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }

    revalidatePath("/material-requests")
    
    return {
      success: true,
      message: "Material request updated successfully",
      data: serializedMaterialRequest
    }
  } catch (error) {
    console.error("Error updating material request:", error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.message || "Validation error"
      }
    }

    return {
      success: false,
      message: "Failed to update material request"
    }
  }
}

export async function deleteMaterialRequest(requestId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    if (existingRequest.requestedById !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You can only delete your own requests" }
    }

    if (existingRequest.status !== MRSRequestStatus.DRAFT) {
      return { success: false, message: "Cannot delete request in current status" }
    }

    await prisma.materialRequest.delete({
      where: { id: requestId }
    })

    revalidatePath("/material-requests")
    
    return {
      success: true,
      message: "Material request deleted successfully"
    }
  } catch (error) {
    console.error("Error deleting material request:", error)
    
    return {
      success: false,
      message: "Failed to delete material request"
    }
  }
}

export async function cancelMaterialRequest(requestId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    if (existingRequest.requestedById !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You can only cancel your own requests" }
    }

    // Check if any approval has been made
    const hasAnyApproval = 
      existingRequest.budgetApprovalStatus === ApprovalStatus.APPROVED ||
      existingRequest.recApprovalStatus === ApprovalStatus.APPROVED || 
      existingRequest.finalApprovalStatus === ApprovalStatus.APPROVED

    if (hasAnyApproval) {
      return { success: false, message: "Cannot cancel request that has already been approved" }
    }

    // Check if request is already in a final state
    const finalStates: MRSRequestStatus[] = [MRSRequestStatus.CANCELLED, MRSRequestStatus.DISAPPROVED, MRSRequestStatus.POSTED, MRSRequestStatus.DEPLOYED]
    if (finalStates.includes(existingRequest.status)) {
      return { success: false, message: "Cannot cancel request in current status" }
    }

    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: MRSRequestStatus.CANCELLED
      }
    })

    revalidatePath("/material-requests")
    
    return {
      success: true,
      message: "Material request cancelled successfully"
    }
  } catch (error) {
    console.error("Error cancelling material request:", error)
    
    return {
      success: false,
      message: "Failed to cancel material request"
    }
  }
}

export async function submitForApproval(requestId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: true,
        department: {
          include: {
            approvers: {
              where: { 
                isActive: true,
                approverType: ApproverType.RECOMMENDING 
              },
              include: { employee: true }
            }
          }
        }
      }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    if (existingRequest.requestedById !== session.user.id) {
      return { success: false, message: "You can only submit your own requests" }
    }

    if (existingRequest.status !== MRSRequestStatus.DRAFT) {
      return { success: false, message: "Request is not in draft status" }
    }

    // Check if approvers are assigned
    if (!existingRequest.recApproverId && !existingRequest.finalApproverId) {
      return { success: false, message: "No approvers assigned to this request" }
    }

    // Special business unit and department check
    const SPECIAL_BUSINESS_UNIT_ID = "cmhek3mk20000of0k546dlzcw"
    const SPECIAL_DEPARTMENTS = ["Operations", "RDH Santiago", "RDH Warehouse"]
    
    // Check if this request requires FOR_REVIEW first
    const requiresReview = 
      existingRequest.businessUnitId === SPECIAL_BUSINESS_UNIT_ID &&
      existingRequest.department &&
      SPECIAL_DEPARTMENTS.includes(existingRequest.department.name)

    // Determine next status based on isStoreUse flag, special department rules, and requestor's isRDHMRS flag
    // Priority order:
    // 1. If isStoreUse = true, go to review first (FOR_REVIEW)
    // 2. If special business unit + special department, go to review first (FOR_REVIEW)
    //    - After review, the isRDHMRS flag will determine if it goes to PENDING_BUDGET_APPROVAL or FOR_REC_APPROVAL
    // 3. If requestor has isRDHMRS = true, go directly to budget approval (PENDING_BUDGET_APPROVAL)
    // 4. Otherwise, follow normal flow (FOR_REC_APPROVAL)
    let nextStatus: MRSRequestStatus
    
    if (existingRequest.isStoreUse) {
      // Store use requests go to review first
      nextStatus = MRSRequestStatus.FOR_REVIEW
    } else if (requiresReview) {
      // Special business unit + department combination requires review first
      // After review, isRDHMRS flag will determine the next status
      nextStatus = MRSRequestStatus.FOR_REVIEW
    } else if (existingRequest.requestedBy.isRDHMRS) {
      // RDH requests go directly to budget approval (bypassing review)
      nextStatus = MRSRequestStatus.PENDING_BUDGET_APPROVAL
    } else {
      // Normal flow
      nextStatus = MRSRequestStatus.FOR_REC_APPROVAL
    }

    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        recApprovalStatus: nextStatus === MRSRequestStatus.FOR_REC_APPROVAL ? ApprovalStatus.PENDING : null,
      }
    })

    revalidatePath("/material-requests")
    
    let successMessage: string
    if (existingRequest.isStoreUse) {
      successMessage = "Material request submitted for review successfully"
    } else if (requiresReview) {
      successMessage = "Material request submitted for review successfully"
    } else if (existingRequest.requestedBy.isRDHMRS) {
      successMessage = "Material request submitted for budget approval successfully"
    } else {
      successMessage = "Material request submitted for approval successfully"
    }
    
    return {
      success: true,
      message: successMessage
    }
  } catch (error) {
    console.error("Error submitting for approval:", error)
    
    return {
      success: false,
      message: "Failed to submit for approval"
    }
  }
}

// Get functions with proper typing
export async function getMaterialRequests(filters?: {
  status?: MRSRequestStatus
  businessUnitId?: string
  departmentId?: string
  requestedById?: string
  type?: RequestType
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const whereClause: {
      status?: MRSRequestStatus
      businessUnitId?: string
      departmentId?: string
      requestedById?: string
      type?: RequestType
    } = {}

    if (filters?.status) {
      whereClause.status = filters.status
    }

    if (filters?.businessUnitId) {
      whereClause.businessUnitId = filters.businessUnitId
    }

    if (filters?.departmentId) {
      whereClause.departmentId = filters.departmentId
    }

    if (filters?.requestedById) {
      whereClause.requestedById = filters.requestedById
    }

    if (filters?.type) {
      whereClause.type = filters.type
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        businessUnit: true,
        department: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedRequests = requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))

    return serializedRequests
  } catch (error) {
    console.error("Error fetching material requests:", error)
    return []
  }
}

export async function getMaterialRequestById(requestId: string) {
  try {
    const request = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        items: true,
        businessUnit: true,
        department: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        budgetApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
      }
    })

    if (!request) return null

    // Convert Decimal fields to numbers for client serialization
    const serializedRequest = {
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }

    return serializedRequest
  } catch (error) {
    console.error("Error fetching material request:", error)
    return null
  }
}

export async function getNextDocumentNumber(series: string): Promise<string> {
  try {
    return await generateDocumentNumber(series)
  } catch (error) {
    console.error("Error generating document number:", error)
    const currentYear = new Date().getFullYear()
    const yearSuffix = currentYear.toString().slice(-2)
    return `${series}-${yearSuffix}-00001`
  }
}

export async function saveAcknowledgement(requestId: string, signatureData: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    // Update the material request with acknowledgement data
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: session.user.id,
        signatureData: signatureData,
      }
    })

    revalidatePath("/material-requests")
    
    return {
      success: true,
      message: "Acknowledgement saved successfully"
    }
  } catch (error) {
    console.error("Error saving acknowledgement:", error)
    
    return {
      success: false,
      message: "Failed to save acknowledgement"
    }
  }
}

export async function getForPostingRequests(filters?: {
  businessUnitId?: string
  status?: MRSRequestStatus
  search?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const whereClause: any = {
      status: MRSRequestStatus.FOR_POSTING
    }

    if (filters?.businessUnitId) {
      whereClause.businessUnitId = filters.businessUnitId
    }

    if (filters?.search) {
      whereClause.OR = [
        { docNo: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { requestedBy: { name: { contains: filters.search, mode: 'insensitive' } } }
      ]
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        businessUnit: true,
        department: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            profilePicture: true,
          }
        },
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        budgetApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
      },
      orderBy: {
        datePosted: 'desc'
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedRequests = requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))

    return serializedRequests
  } catch (error) {
    console.error("Error fetching posted requests:", error)
    return []
  }
}

export async function markAsReceived(requestId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission to receive (PURCHASER, STOCKROOM, ADMIN, MANAGER)
    if (!["ADMIN", "MANAGER", "PURCHASER", "STOCKROOM"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to receive material requests" }
    }

    const existingRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!existingRequest) {
      return { success: false, message: "Material request not found" }
    }

    if (existingRequest.status !== MRSRequestStatus.POSTED) {
      return { success: false, message: "Request must be posted before marking as received" }
    }

    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: MRSRequestStatus.RECEIVED,
        dateReceived: new Date(),
      }
    })

    revalidatePath("/mrs-coordinator")
    
    return {
      success: true,
      message: "Material request marked as received successfully"
    }
  } catch (error) {
    console.error("Error marking request as received:", error)
    return {
      success: false,
      message: "Failed to mark request as received"
    }
  }
}

export async function getApprovedRequestsForAcknowledgement(filters?: {
  businessUnitId?: string
}) {
  try {
    const requests = await prisma.materialRequest.findMany({
      where: {
        businessUnitId: filters?.businessUnitId,
        status: MRSRequestStatus.POSTED,
        // Only show requests that don't have an e-signature yet
        signatureData: null,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnitId: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            description: true,
          }
        },
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        items: true,
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        budgetApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        acknowledgmentForm: true,
      },
      orderBy: {
        finalApprovalDate: 'desc'
      }
    })

    // Transform the data to match the MaterialRequest type
    return requests.map(request => ({
      ...request,
      total: request.items.reduce((sum, item) => {
        const unitPrice = item.unitPrice ? Number(item.unitPrice) : 0
        const quantity = Number(item.quantity)
        return sum + (unitPrice * quantity)
      }, 0) + Number(request.freight || 0) - Number(request.discount || 0),
      freight: request.freight ? Number(request.freight) : 0,
      discount: request.discount ? Number(request.discount) : 0,
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : 0,
      }))
    }))
  } catch (error) {
    console.error("Error fetching approved requests for acknowledgement:", error)
    return []
  }
}

export async function getDoneRequests(filters?: {
  businessUnitId?: string
  search?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const whereClause: any = {
      status: MRSRequestStatus.POSTED
    }

    if (filters?.businessUnitId) {
      whereClause.businessUnitId = filters.businessUnitId
    }

    if (filters?.search) {
      whereClause.OR = [
        { docNo: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { confirmationNo: { contains: filters.search, mode: 'insensitive' } },
        { supplierName: { contains: filters.search, mode: 'insensitive' } },
        { purchaseOrderNumber: { contains: filters.search, mode: 'insensitive' } },
        { requestedBy: { name: { contains: filters.search, mode: 'insensitive' } } }
      ]
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnitId: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            description: true,
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            profilePicture: true,
          }
        },
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        budgetApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        acknowledgmentForm: true,
      },
      orderBy: {
        datePosted: 'desc'
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedRequests = requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))

    return serializedRequests
  } catch (error) {
    console.error("Error fetching done requests:", error)
    return []
  }
}

// Get requests that are ready to be served (FOR_SERVING status)
export async function getRequestsToServe(filters?: {
  businessUnitId?: string
  search?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const whereClause: Record<string, unknown> = {
      status: MRSRequestStatus.FOR_SERVING
    }

    if (filters?.businessUnitId) {
      whereClause.businessUnitId = filters.businessUnitId
    }

    if (filters?.search) {
      whereClause.OR = [
        { docNo: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        { requestedBy: { name: { contains: filters.search, mode: 'insensitive' } } }
      ]
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        items: true,
        businessUnit: true,
        department: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            profilePicture: true,
          }
        },
        recApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        finalApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        budgetApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert Decimal fields to numbers for client serialization
    const serializedRequests = requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))

    return serializedRequests
  } catch (error) {
    console.error("Error fetching requests to serve:", error)
    return []
  }
}

// Mark a request as served and move it to FOR_POSTING status
export async function markRequestAsServed(params: {
  requestId: string
  businessUnitId: string
  notes?: string
  supplierBPCode?: string
  supplierName?: string
  purchaseOrderNumber?: string
  servedQuantities?: Record<string, number>
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Check if user has permission to mark as served
    const isPurchaser = session.user.isPurchaser || false
    if (session.user.role !== "ADMIN" && !isPurchaser) {
      return { success: false, error: "You don't have permission to mark requests as served" }
    }

    // Verify the request exists and is in FOR_SERVING status
    const request = await prisma.materialRequest.findFirst({
      where: {
        id: params.requestId,
        businessUnitId: params.businessUnitId,
        status: MRSRequestStatus.FOR_SERVING
      },
      include: {
        items: true
      }
    })

    if (!request) {
      return { success: false, error: "Request not found or not in FOR_SERVING status" }
    }

    // Update item quantities served
    if (params.servedQuantities) {
      for (const item of request.items) {
        const servedQty = params.servedQuantities[item.id]
        if (servedQty !== undefined && servedQty > 0) {
          await prisma.materialRequestItem.update({
            where: { id: item.id },
            data: {
              quantityServed: (item.quantityServed?.toNumber() || 0) + servedQty
            }
          })
        }
      }
    }

    // Check if all items are fully served
    const updatedRequest = await prisma.materialRequest.findUnique({
      where: { id: params.requestId },
      include: { items: true }
    })

    const allItemsFullyServed = updatedRequest?.items.every(item => {
      const served = item.quantityServed?.toNumber() || 0
      const requested = item.quantity.toNumber()
      return served >= requested
    })

    // Determine the new status
    const newStatus = allItemsFullyServed ? MRSRequestStatus.FOR_POSTING : MRSRequestStatus.FOR_SERVING

    // Update the request
    await prisma.materialRequest.update({
      where: { id: params.requestId },
      data: {
        status: newStatus,
        servedAt: new Date(),
        servedBy: session.user.id,
        servedNotes: params.notes,
        supplierBPCode: params.supplierBPCode,
        supplierName: params.supplierName,
        purchaseOrderNumber: params.purchaseOrderNumber,
        updatedAt: new Date()
      }
    })

    // Revalidate relevant paths
    revalidatePath(`/${params.businessUnitId}/mrs-coordinator/to-serve`)
    revalidatePath(`/${params.businessUnitId}/mrs-coordinator/for-serving`)
    revalidatePath(`/${params.businessUnitId}/mrs-coordinator/for-posting`)
    revalidatePath(`/${params.businessUnitId}/material-requests/${params.requestId}`)

    const statusMessage = allItemsFullyServed 
      ? "has been fully served and is now ready for posting"
      : "has been partially served and remains in 'For Serving' status"

    return {
      success: true,
      message: `Request ${request.docNo} ${statusMessage}`
    }
  } catch (error) {
    console.error("Error marking request as served:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark request as served"
    }
  }
}


export async function markAsPosted(requestId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (ADMIN or users with isAcctg permission)
    if (session.user.role !== "ADMIN" && !session.user.isAcctg) {
      return { success: false, message: "You don't have permission to mark requests as posted" }
    }

    // Get the request
    const request = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!request) {
      return { success: false, message: "Request not found" }
    }

    // Check if request is in FOR_POSTING status
    if (request.status !== MRSRequestStatus.FOR_POSTING) {
      return { success: false, message: "Request must be in FOR_POSTING status" }
    }

    // Update the request status to POSTED
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: MRSRequestStatus.POSTED,
        datePosted: new Date(),
        processedBy: session.user.id,
        processedAt: new Date(),
      }
    })

    revalidatePath("/")
    return { success: true, message: "Request marked as posted successfully" }
  } catch (error) {
    console.error("Error marking request as posted:", error)
    return { success: false, message: "Failed to mark request as posted" }
  }
}


// Mark request for edit by purchaser
export async function markRequestForEdit(params: {
  requestId: string
  reason?: string
}): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user is purchaser
    if (!session.user.isPurchaser) {
      return { success: false, message: "Only purchasers can mark requests for edit" }
    }

    const request = await prisma.materialRequest.findUnique({
      where: { id: params.requestId }
    })

    if (!request) {
      return { success: false, message: "Request not found" }
    }

    // Update the request
    await prisma.materialRequest.update({
      where: { id: params.requestId },
      data: {
        isMarkedForEdit: true,
        markedForEditAt: new Date(),
        markedForEditBy: session.user.id,
        markedForEditReason: params.reason || null,
        editCompletedAt: null,
        editAcknowledgedAt: null,
      }
    })

    revalidatePath("/")
    return { success: true, message: "Request marked for edit successfully" }
  } catch (error) {
    console.error("Error marking request for edit:", error)
    return { success: false, message: "Failed to mark request for edit" }
  }
}

// Update item descriptions when marked for edit
const UpdateItemDescriptionsSchema = z.object({
  requestId: z.string(),
  items: z.array(z.object({
    itemId: z.string(),
    description: z.string().min(1, "Description is required"),
  }))
})

export async function updateItemDescriptions(input: z.infer<typeof UpdateItemDescriptionsSchema>): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const validatedData = UpdateItemDescriptionsSchema.parse(input)

    const request = await prisma.materialRequest.findUnique({
      where: { id: validatedData.requestId },
      include: { items: true }
    })

    if (!request) {
      return { success: false, message: "Request not found" }
    }

    // Check if user is the requestor
    if (request.requestedById !== session.user.id) {
      return { success: false, message: "Only the original requestor can edit descriptions" }
    }

    // Check if request is marked for edit
    if (!request.isMarkedForEdit) {
      return { success: false, message: "Request is not marked for edit" }
    }

    // Update item descriptions
    await prisma.$transaction(
      validatedData.items.map(item =>
        prisma.materialRequestItem.update({
          where: { id: item.itemId },
          data: { description: item.description }
        })
      )
    )

    // Mark edit as completed
    await prisma.materialRequest.update({
      where: { id: validatedData.requestId },
      data: {
        editCompletedAt: new Date(),
      }
    })

    revalidatePath("/")
    return { success: true, message: "Item descriptions updated successfully" }
  } catch (error) {
    console.error("Error updating item descriptions:", error)
    return { success: false, message: "Failed to update item descriptions" }
  }
}

// Acknowledge that edit is completed (by purchaser)
export async function acknowledgeEditCompletion(requestId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user is purchaser
    if (!session.user.isPurchaser) {
      return { success: false, message: "Only purchasers can acknowledge edit completion" }
    }

    const request = await prisma.materialRequest.findUnique({
      where: { id: requestId }
    })

    if (!request) {
      return { success: false, message: "Request not found" }
    }

    if (!request.isMarkedForEdit) {
      return { success: false, message: "Request is not marked for edit" }
    }

    if (!request.editCompletedAt) {
      return { success: false, message: "Edit has not been completed yet" }
    }

    // Acknowledge and clear the edit flag
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        editAcknowledgedAt: new Date(),
        isMarkedForEdit: false,
      }
    })

    revalidatePath("/")
    return { success: true, message: "Edit completion acknowledged successfully" }
  } catch (error) {
    console.error("Error acknowledging edit completion:", error)
    return { success: false, message: "Failed to acknowledge edit completion" }
  }
}

// Get requests marked for edit for the current user in a specific business unit
export async function getMyRequestsMarkedForEdit(businessUnitId?: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    const whereClause: {
      requestedById: string
      isMarkedForEdit: boolean
      editCompletedAt: null
      businessUnitId?: string
    } = {
      requestedById: session.user.id,
      isMarkedForEdit: true,
      editCompletedAt: null,
    }

    // Filter by business unit if provided
    if (businessUnitId) {
      whereClause.businessUnitId = businessUnitId
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        businessUnit: true,
        department: true,
        items: true,
      },
      orderBy: {
        markedForEditAt: 'desc'
      }
    })

    return requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))
  } catch (error) {
    console.error("Error fetching requests marked for edit:", error)
    return []
  }
}

// Budget approval action for isAcctg users
const BudgetApprovalSchema = z.object({
  requestId: z.string(),
  isWithinBudget: z.boolean(),
  remarks: z.string().optional(),
})

export async function approveBudget(input: z.infer<typeof BudgetApprovalSchema>): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has accounting permissions
    if (!session.user.isAcctg) {
      return { success: false, message: "Only accounting users can approve budgets" }
    }

    const validatedData = BudgetApprovalSchema.parse(input)

    const request = await prisma.materialRequest.findUnique({
      where: { id: validatedData.requestId }
    })

    if (!request) {
      return { success: false, message: "Request not found" }
    }

    if (request.status !== MRSRequestStatus.PENDING_BUDGET_APPROVAL) {
      return { success: false, message: "Request is not pending budget approval" }
    }

    // Update the request with budget approval
    await prisma.materialRequest.update({
      where: { id: validatedData.requestId },
      data: {
        budgetApproverId: session.user.id,
        budgetApprovalDate: new Date(),
        budgetApprovalStatus: validatedData.isWithinBudget ? ApprovalStatus.APPROVED : ApprovalStatus.DISAPPROVED,
        isWithinBudget: validatedData.isWithinBudget,
        budgetRemarks: validatedData.remarks || null,
        // Always move to FOR_REC_APPROVAL regardless of budget status
        // The budget status is just an indicator, not a blocker
        status: MRSRequestStatus.FOR_REC_APPROVAL,
      }
    })

    // Get business unit for revalidation
    const businessUnitId = request.businessUnitId
    revalidatePath(`/${businessUnitId}/approvals/material-requests/budget`)
    revalidatePath("/")
    
    return { 
      success: true, 
      message: validatedData.isWithinBudget 
        ? "Budget review completed (Within Budget) - Request moved to recommending approval" 
        : "Budget review completed (Not Within Budget) - Request moved to recommending approval"
    }
  } catch (error) {
    console.error("Error approving budget:", error)
    return { success: false, message: "Failed to process budget approval" }
  }
}

// Get requests pending budget approval
export async function getRequestsPendingBudgetApproval(filters?: {
  businessUnitId?: string
  search?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    // Only accounting users can see budget approval requests
    if (!session.user.isAcctg) {
      return []
    }

    const whereClause: {
      status: MRSRequestStatus
      businessUnitId?: string
      OR?: Array<{
        docNo?: { contains: string; mode: 'insensitive' }
        requestedBy?: { name?: { contains: string; mode: 'insensitive' } }
      }>
    } = {
      status: MRSRequestStatus.PENDING_BUDGET_APPROVAL,
    }

    if (filters?.businessUnitId) {
      whereClause.businessUnitId = filters.businessUnitId
    }

    if (filters?.search) {
      whereClause.OR = [
        { docNo: { contains: filters.search, mode: 'insensitive' } },
        { requestedBy: { name: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: true,
        businessUnit: true,
        department: true,
        items: true,
        budgetApprover: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))
  } catch (error) {
    console.error("Error fetching budget approval requests:", error)
    return []
  }
}

// Get REC_APPROVED requests for RDH/MRS users and Managers
export async function getRDHApprovedRequests(businessUnitId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return []
    }

    // Only users with isRDHMRS = true OR MANAGER role OR isAcctg = true can see this view
    if (!session.user.isRDHMRS && session.user.role !== 'MANAGER' && !session.user.isAcctg) {
      return []
    }

    const whereClause: {
      businessUnitId: string
      status: MRSRequestStatus
      requestedById?: string
    } = {
      businessUnitId,
      status: MRSRequestStatus.FOR_FINAL_APPROVAL, // After recommending approval, it goes to FOR_FINAL_APPROVAL
    }

    // If user is RDH/MRS but not a manager or accounting user, only show their own requests
    // If user is a manager or accounting user, show all REC_APPROVED requests in the business unit
    if (session.user.isRDHMRS && session.user.role !== 'MANAGER' && !session.user.isAcctg) {
      whereClause.requestedById = session.user.id
    }

    const requests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: true,
        recApprover: true,
        items: true,
      },
      orderBy: {
        recApprovalDate: 'desc'
      }
    })

    return requests.map(request => ({
      ...request,
      freight: Number(request.freight),
      discount: Number(request.discount),
      total: Number(request.total),
      items: request.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        quantityServed: Number(item.quantityServed),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
      }))
    }))
  } catch (error) {
    console.error("Error fetching RDH approved requests:", error)
    return []
  }
}
