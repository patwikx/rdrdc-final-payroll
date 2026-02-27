"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MRSRequestStatus, ApprovalStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

// Store Use Reviewer Employee ID
const STORE_USE_REVIEWER_EMPLOYEE_ID = 'R-033'

export interface PendingReviewRequest {
  id: string
  docNo: string
  series: string
  type: "ITEM" | "SERVICE"
  status: MRSRequestStatus
  datePrepared: Date
  dateRequired: Date
  total: number
  purpose: string | null
  isStoreUse: boolean
  requestedBy: {
    id: string
    name: string
    employeeId: string
  }
  businessUnit: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  } | null
  items: {
    id: string
    description: string
    quantity: number
    uom: string
    unitPrice: number | null
  }[]
}

export interface PendingReviewRequestsResponse {
  materialRequests: PendingReviewRequest[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface GetPendingReviewRequestsParams {
  businessUnitId: string
  page?: number
  limit?: number
}

/**
 * Get pending review requests for store use material requests.
 * Only the designated reviewer (R-033) can access this.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */
export async function getPendingReviewRequests({
  businessUnitId,
  page = 1,
  limit = 10
}: GetPendingReviewRequestsParams): Promise<PendingReviewRequestsResponse> {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userEmployeeId = session.user.employeeId
  
  // Only R-033 can view pending review requests (Requirement 2.3)
  if (userEmployeeId !== STORE_USE_REVIEWER_EMPLOYEE_ID) {
    throw new Error("Unauthorized - Only designated reviewer can access this")
  }

  try {
    // Build where clause for pending review requests (Requirement 2.1)
    const whereClause = {
      status: MRSRequestStatus.FOR_REVIEW,
      isStoreUse: true
    }

    // Get total count
    const totalCount = await prisma.materialRequest.count({
      where: whereClause
    })

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit)
    const skip = (page - 1) * limit

    // Get paginated results with required includes (Requirement 2.2)
    const materialRequests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            employeeId: true
          }
        },
        businessUnit: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            uom: true,
            unitPrice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })

    return {
      materialRequests: materialRequests.map(request => ({
        id: request.id,
        docNo: request.docNo,
        series: request.series,
        type: request.type as "ITEM" | "SERVICE",
        status: request.status,
        datePrepared: request.datePrepared,
        dateRequired: request.dateRequired,
        total: Number(request.total),
        purpose: request.purpose,
        isStoreUse: request.isStoreUse,
        requestedBy: request.requestedBy,
        businessUnit: request.businessUnit,
        department: request.department,
        items: request.items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity),
          uom: item.uom,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  } catch (error) {
    console.error("Error fetching pending review requests:", error)
    throw new Error("Failed to fetch pending review requests")
  }
}

export interface PendingMaterialRequest {
  id: string
  docNo: string
  series: string
  type: "ITEM" | "SERVICE"
  status: MRSRequestStatus
  datePrepared: Date
  dateRequired: Date
  total: number
  purpose: string | null
  deliverTo: string | null
  remarks: string | null
  createdAt: Date
  requestedBy: {
    id: string
    name: string
    employeeId: string
    profilePicture?: string | null
  }
  businessUnit: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  } | null
  items: {
    id: string
    description: string
    quantity: number
    uom: string
    unitPrice: number | null
  }[]
  recApprovalStatus: ApprovalStatus | null
  finalApprovalStatus: ApprovalStatus | null
}

export interface PendingMaterialRequestsResponse {
  materialRequests: PendingMaterialRequest[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface GetPendingMaterialRequestsParams {
  businessUnitId: string
  status?: string
  type?: string
  page?: number
  limit?: number
}

export async function getPendingMaterialRequests({
  businessUnitId,
  status,
  type,
  page = 1,
  limit = 10
}: GetPendingMaterialRequestsParams): Promise<PendingMaterialRequestsResponse> {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const userEmployeeId = session.user.employeeId

  try {
    // Special case: If user is C-002, show all requests across all business units
    const isSpecialApprover = userEmployeeId === 'C-002'
    
    // Build where clause for pending requests assigned to the current user
    const whereClause: any = {
      // Only filter by businessUnitId if NOT the special approver
      ...(isSpecialApprover ? {} : { businessUnitId }),
      OR: [
        // For recommending approval - user is the recommending approver and status is FOR_REC_APPROVAL
        {
          AND: [
            { recApproverId: userId },
            { status: MRSRequestStatus.FOR_REC_APPROVAL },
            {
              OR: [
                { recApprovalStatus: null },
                { recApprovalStatus: ApprovalStatus.PENDING }
              ]
            }
          ]
        },
        // For final approval - user is the final approver, rec approval is done, and status is FOR_FINAL_APPROVAL
        {
          AND: [
            { finalApproverId: userId },
            { status: MRSRequestStatus.FOR_FINAL_APPROVAL },
            { recApprovalStatus: ApprovalStatus.APPROVED },
            {
              OR: [
                { finalApprovalStatus: null },
                { finalApprovalStatus: ApprovalStatus.PENDING }
              ]
            }
          ]
        }
      ]
    }


    // Add status filter if provided
    if (status && status !== "all-status") {
      whereClause.status = status as MRSRequestStatus
    }

    // Add type filter if provided
    if (type && type !== "all-types") {
      whereClause.type = type
    }

    // Get total count
    const totalCount = await prisma.materialRequest.count({
      where: whereClause
    })


    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit)
    const skip = (page - 1) * limit

    // Get paginated results
    const materialRequests = await prisma.materialRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            profilePicture: true
          }
        },
        businessUnit: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            uom: true,
            unitPrice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })

    return {
      materialRequests: materialRequests.map(request => ({
        ...request,
        freight: Number(request.freight),
        discount: Number(request.discount),
        total: Number(request.total),
        items: request.items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  } catch (error) {
    console.error("Error fetching pending material requests:", error)
    throw new Error("Failed to fetch pending material requests")
  }
}

export async function approveMaterialRequest(
  requestId: string,
  businessUnitId: string,
  comments?: string
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  const userId = session.user.id
  const userEmployeeId = session.user.employeeId
  
  // Special approver can approve across all business units
  const isSpecialApprover = userEmployeeId === 'C-002'

  try {
    // Get the material request
    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: true
      }
    })

    if (!materialRequest) {
      return { error: "Material request not found" }
    }

    // Only enforce business unit check for non-special approvers
    if (!isSpecialApprover && materialRequest.businessUnitId !== businessUnitId) {
      return { error: "Unauthorized" }
    }

    // Determine approval type based on current status and user role
    let updateData: any = {}
    
    if (materialRequest.status === MRSRequestStatus.FOR_REC_APPROVAL && 
        materialRequest.recApproverId === userId) {
      // Recommending approval
      updateData = {
        recApprovalStatus: ApprovalStatus.APPROVED,
        recApprovalDate: new Date(),
        recApprovalRemarks: comments || null,
        status: MRSRequestStatus.REC_APPROVED
      }
      
      // If there's a final approver, move to final approval
      if (materialRequest.finalApproverId) {
        updateData.status = MRSRequestStatus.FOR_FINAL_APPROVAL
      } else {
        // No final approver, move directly to final approved
        updateData.status = MRSRequestStatus.FINAL_APPROVED
      }
    } else if (materialRequest.status === MRSRequestStatus.FOR_FINAL_APPROVAL && 
               materialRequest.finalApproverId === userId &&
               materialRequest.recApprovalStatus === ApprovalStatus.APPROVED) {
      // Final approval - move to FOR_SERVING so purchaser can serve it
      updateData = {
        finalApprovalStatus: ApprovalStatus.APPROVED,
        finalApprovalDate: new Date(),
        finalApprovalRemarks: comments || null,
        status: MRSRequestStatus.FOR_SERVING, // Changed from POSTED to FOR_SERVING
        dateApproved: new Date()
      }
    } else {
      return { error: "You are not authorized to approve this request" }
    }

    // Update the material request
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: updateData
    })

    // Check if this was a final approval that moves to serving
    const isFinalApproval = materialRequest.status === MRSRequestStatus.FOR_FINAL_APPROVAL && 
                           materialRequest.finalApproverId === userId &&
                           materialRequest.recApprovalStatus === ApprovalStatus.APPROVED

    // Revalidate paths for current business unit
    revalidatePath(`/${businessUnitId}/approvals/material-requests/pending`)
    revalidatePath(`/${businessUnitId}/mrs-coordinator/to-serve`)
    
    // Also revalidate paths for the request's actual business unit if different (cross-BU approval)
    if (materialRequest.businessUnitId !== businessUnitId) {
      revalidatePath(`/${materialRequest.businessUnitId}/approvals/material-requests/pending`)
      revalidatePath(`/${materialRequest.businessUnitId}/mrs-coordinator/to-serve`)
    }
    
    if (isFinalApproval) {
      return { success: "Material request approved and ready for serving!", isPosting: false }
    }
    
    return { success: "Material request approved successfully" }
  } catch (error) {
    console.error("Error approving material request:", error)
    return { error: "Failed to approve material request" }
  }
}

export interface ActionResult {
  success?: string
  error?: string
}

/**
 * Mark a store use material request as reviewed.
 * Only the designated reviewer (R-033) can perform this action.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function markAsReviewed(
  requestId: string,
  businessUnitId: string,
  remarks?: string
): Promise<ActionResult> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  const userEmployeeId = session.user.employeeId
  
  // Only R-033 can mark as reviewed (Requirement 3.1)
  if (userEmployeeId !== STORE_USE_REVIEWER_EMPLOYEE_ID) {
    return { error: "Unauthorized - Only designated reviewer can review requests" }
  }

  try {
    // Fetch the request with requestedBy to check isRDHMRS flag
    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: true }
    })

    if (!materialRequest) {
      return { error: "Material request not found" }
    }

    // Verify request is in FOR_REVIEW status
    if (materialRequest.status !== MRSRequestStatus.FOR_REVIEW) {
      return { error: "Request is not pending review" }
    }

    // Determine next status based on requestor's isRDHMRS flag (Requirement 3.3)
    // After review, always check isRDHMRS flag to determine next status
    const nextStatus = materialRequest.requestedBy.isRDHMRS 
      ? MRSRequestStatus.PENDING_BUDGET_APPROVAL 
      : MRSRequestStatus.FOR_REC_APPROVAL

    // Update the request with review information (Requirements 3.1, 3.2, 3.4)
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        reviewerId: session.user.id,
        reviewedAt: new Date(),
        reviewStatus: ApprovalStatus.APPROVED,
        reviewRemarks: remarks || null,
        // Set recApprovalStatus to PENDING if going to FOR_REC_APPROVAL
        recApprovalStatus: nextStatus === MRSRequestStatus.FOR_REC_APPROVAL 
          ? ApprovalStatus.PENDING 
          : null
      }
    })

    // Revalidate relevant paths
    revalidatePath(`/${businessUnitId}/approvals/review`)
    revalidatePath(`/${businessUnitId}/approvals/material-requests/pending`)
    revalidatePath(`/${businessUnitId}/material-requests`)
    
    // Also revalidate paths for the request's actual business unit if different
    if (materialRequest.businessUnitId !== businessUnitId) {
      revalidatePath(`/${materialRequest.businessUnitId}/approvals/review`)
      revalidatePath(`/${materialRequest.businessUnitId}/approvals/material-requests/pending`)
      revalidatePath(`/${materialRequest.businessUnitId}/material-requests`)
    }
    
    return { success: "Request marked as reviewed successfully" }
  } catch (error) {
    console.error("Error marking request as reviewed:", error)
    return { error: "Failed to mark request as reviewed" }
  }
}

export async function rejectMaterialRequest(
  requestId: string,
  businessUnitId: string,
  comments: string
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  const userId = session.user.id
  const userEmployeeId = session.user.employeeId
  
  // Special approver can reject across all business units
  const isSpecialApprover = userEmployeeId === 'C-002'

  try {
    // Get the material request
    const materialRequest = await prisma.materialRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: true
      }
    })

    if (!materialRequest) {
      return { error: "Material request not found" }
    }

    // Only enforce business unit check for non-special approvers
    if (!isSpecialApprover && materialRequest.businessUnitId !== businessUnitId) {
      return { error: "Unauthorized" }
    }

    // Determine rejection type based on current status and user role
    let updateData: any = {
      status: MRSRequestStatus.DISAPPROVED
    }
    
    if (materialRequest.status === MRSRequestStatus.FOR_REC_APPROVAL && 
        materialRequest.recApproverId === userId) {
      // Recommending rejection
      updateData.recApprovalStatus = ApprovalStatus.DISAPPROVED
      updateData.recApprovalDate = new Date()
      updateData.recApprovalRemarks = comments
    } else if (materialRequest.status === MRSRequestStatus.FOR_FINAL_APPROVAL && 
               materialRequest.finalApproverId === userId) {
      // Final rejection
      updateData.finalApprovalStatus = ApprovalStatus.DISAPPROVED
      updateData.finalApprovalDate = new Date()
      updateData.finalApprovalRemarks = comments
    } else {
      return { error: "You are not authorized to reject this request" }
    }

    // Update the material request
    await prisma.materialRequest.update({
      where: { id: requestId },
      data: updateData
    })

    // Revalidate paths for current business unit
    revalidatePath(`/${businessUnitId}/approvals/material-requests/pending`)
    
    // Also revalidate paths for the request's actual business unit if different (cross-BU rejection)
    if (materialRequest.businessUnitId !== businessUnitId) {
      revalidatePath(`/${materialRequest.businessUnitId}/approvals/material-requests/pending`)
    }
    
    return { success: "Material request rejected successfully" }
  } catch (error) {
    console.error("Error rejecting material request:", error)
    return { error: "Failed to reject material request" }
  }
}