"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export interface PendingLeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: RequestStatus;
  session: string;
  days: number;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture?: string | null;
  };
  leaveType: {
    id: string;
    name: string;
  };
  managerComments?: string | null;
  hrComments?: string | null;
}

export interface PendingApprovalsResponse {
  leaveRequests: PendingLeaveRequest[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  leaveTypes: {
    id: string;
    name: string;
  }[];
}

export interface GetPendingApprovalsParams {
  businessUnitId: string;
  status?: string;
  leaveTypeId?: string;
  page?: number;
  limit?: number;
}

// Check if user has approval permissions
async function checkApprovalPermissions(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only managers, HR, and admins can approve requests
  if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER" && session.user.role !== "ACCTG_MANAGER" && session.user.role !== "PURCHASING_MANAGER") {
    throw new Error("Insufficient permissions to approve requests");
  }
  
  // Check business unit access
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    if (!session.user.businessUnit?.id || session.user.businessUnit.id !== businessUnitId) {
      throw new Error("Access denied to this business unit");
    }
  }
  
  return session.user;
}

// Get leave request details for approval
export async function getLeaveRequestForApproval(requestId: string, businessUnitId: string) {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId: businessUnitId })
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
            approver: {
              select: {
                id: true,
                name: true,
                employeeId: true,
              }
            },
            department: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        leaveType: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!request) {
      return null;
    }

    // Check if user has permission to approve this specific request
    if (user.role === "MANAGER") {
      if (request.user.approver?.id !== user.id) {
        throw new Error("You can only approve requests from your direct reports");
      }
      if (request.status !== "PENDING_MANAGER") {
        throw new Error("This request is not pending manager approval");
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        throw new Error("This request is not pending HR approval");
      }
    }

    // Calculate days
    const timeDifference = request.endDate.getTime() - request.startDate.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
    const sessionMultiplier = request.session === "FULL_DAY" ? 1 : 0.5;
    const calculatedDays = daysDifference * sessionMultiplier;

    return {
      id: request.id,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      status: request.status,
      session: request.session,
      days: calculatedDays,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      managerActionBy: request.managerActionBy,
      managerActionAt: request.managerActionAt,
      managerComments: request.managerComments,
      hrActionBy: request.hrActionBy,
      hrActionAt: request.hrActionAt,
      hrComments: request.hrComments,
      user: request.user,
      leaveType: request.leaveType
    };
  } catch (error) {
    console.error("Error fetching leave request for approval:", error);
    throw error;
  }
}

// Get overtime request details for approval
export async function getOvertimeRequestForApproval(requestId: string, businessUnitId: string) {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    const request = await prisma.overtimeRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId: businessUnitId })
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
            approver: {
              select: {
                id: true,
                name: true,
                employeeId: true,
              }
            },
            department: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (!request) {
      return null;
    }

    // Check if user has permission to approve this specific request
    if (user.role === "MANAGER") {
      if (request.user.approver?.id !== user.id) {
        throw new Error("You can only approve requests from your direct reports");
      }
      if (request.status !== "PENDING_MANAGER") {
        throw new Error("This request is not pending manager approval");
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        throw new Error("This request is not pending HR approval");
      }
    }

    // Calculate hours
    const startTime = new Date(request.startTime);
    const endTime = new Date(request.endTime);
    const timeDifference = endTime.getTime() - startTime.getTime();
    const calculatedHours = Math.round((timeDifference / (1000 * 60 * 60)) * 100) / 100;

    return {
      id: request.id,
      startTime: request.startTime,
      endTime: request.endTime,
      reason: request.reason,
      status: request.status,
      hours: calculatedHours,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      managerActionBy: request.managerActionBy,
      managerActionAt: request.managerActionAt,
      managerComments: request.managerComments,
      hrActionBy: request.hrActionBy,
      hrActionAt: request.hrActionAt,
      hrComments: request.hrComments,
      user: request.user
    };
  } catch (error) {
    console.error("Error fetching overtime request for approval:", error);
    throw error;
  }
}

// Get pending leave requests for approval
export async function getPendingLeaveRequests({
  businessUnitId,
  status,
  leaveTypeId,
  page = 1,
  limit = 10
}: GetPendingApprovalsParams): Promise<PendingApprovalsResponse> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    let whereClause: any = {};
    
    if (user.role === "ADMIN") {
      // Admins can see all pending requests in the business unit
      whereClause = {
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: status ? status as RequestStatus : {
          in: ["PENDING_MANAGER", "PENDING_HR"],
        },
        ...(leaveTypeId && { leaveTypeId }),
      };
    } else if (user.role === "HR") {
      // HR sees only requests that are pending HR approval AND have been approved by manager first
      whereClause = {
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_HR", // HR only sees PENDING_HR requests
        managerActionBy: { not: null }, // Must be approved by manager first
        ...(leaveTypeId && { leaveTypeId }),
      };
    } else if (user.role === "MANAGER") {
      // Managers see only requests from their direct reports that are pending manager approval (regardless of business unit)
      whereClause = {
        user: { 
          approverId: user.id,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_MANAGER", // Managers only see PENDING_MANAGER requests, ignore status filter
        ...(leaveTypeId && { leaveTypeId }),
      };
    }
    
    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: whereClause
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    // Fetch pending requests and leave types in parallel
    const [requests, leaveTypes] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              profilePicture: true,
            },
          },
          leaveType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      
      // Get available leave types for filtering
      prisma.leaveType.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'desc'
        }
      })
    ]);
    
    // Transform requests to include calculated days
    const transformedRequests: PendingLeaveRequest[] = requests.map(request => {
      const timeDifference = request.endDate.getTime() - request.startDate.getTime();
      const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
      const sessionMultiplier = request.session === "FULL_DAY" ? 1 : 0.5;
      const calculatedDays = daysDifference * sessionMultiplier;
      
      return {
        id: request.id,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        status: request.status,
        session: request.session,
        days: calculatedDays,
        createdAt: request.createdAt,
        user: request.user,
        leaveType: request.leaveType,
        managerComments: request.managerComments,
        hrComments: request.hrComments,
      };
    });
    
    return {
      leaveRequests: transformedRequests,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      leaveTypes,
    };
  } catch (error) {
    console.error("Error fetching pending leave requests:", error);
    throw new Error("Failed to fetch pending leave requests");
  }
}

// Approve a leave request
export async function approveLeaveRequest(
  requestId: string,
  businessUnitId: string,
  comments?: string
): Promise<{ success?: string; error?: string }> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    // Get the request to check current status and permissions
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId })
        }
      },
      include: {
        user: true,
      },
    });
    
    if (!request) {
      return { error: "Leave request not found" };
    }
    
    // Check if user can approve this request
    if (user.role === "MANAGER") {
      if (request.user.approverId !== user.id) {
        return { error: "You can only approve requests from your direct reports" };
      }
      if (request.status !== "PENDING_MANAGER") {
        return { error: "This request is not pending manager approval" };
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        return { error: "This request is not pending HR approval" };
      }
    }
    
    // Determine next status based on current status and user role
    let newStatus: RequestStatus;
    let updateData: Record<string, string> = {};
    
    if (request.status === "PENDING_MANAGER") {
      // Manager approval moves to HR approval
      newStatus = "PENDING_HR";
      updateData.managerComments = comments || "";
    } else if (request.status === "PENDING_HR") {
      // HR approval completes the process
      newStatus = "APPROVED";
      updateData.hrComments = comments || "";
    } else {
      return { error: "Invalid request status for approval" };
    }
    
    // Update the request with action tracking
    const actionData: Record<string, unknown> = {
      status: newStatus,
      ...updateData,
    };
    
    if (request.status === "PENDING_MANAGER") {
      actionData.managerActionBy = user.id;
      actionData.managerActionAt = new Date();
    } else if (request.status === "PENDING_HR") {
      actionData.hrActionBy = user.id;
      actionData.hrActionAt = new Date();
    }
    
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: actionData,
    });

    // If HR approved the request (final approval), deduct leave days from user's balance
    if (newStatus === "APPROVED" && request.status === "PENDING_HR") {
      await deductLeaveBalance(request);
    }
    
    // Revalidate the approvals pages to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${businessUnitId}/approvals/leave/pending`);
    revalidatePath(`/[businessUnitId]/approvals/leave/pending`, "page");
    
    const statusMessage = newStatus === "APPROVED" ? "approved" : "forwarded to HR";
    return { success: `Leave request ${statusMessage} successfully` };
  } catch (error) {
    console.error("Error approving leave request:", error);
    return { error: "Failed to approve leave request" };
  }
}

// Reject a leave request
export async function rejectLeaveRequest(
  requestId: string,
  businessUnitId: string,
  comments: string
): Promise<{ success?: string; error?: string }> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    if (!comments.trim()) {
      return { error: "Comments are required when rejecting a request" };
    }
    
    // Get the request to check current status and permissions
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId })
        }
      },
      include: {
        user: true,
      },
    });
    
    if (!request) {
      return { error: "Leave request not found" };
    }
    
    // Check if user can reject this request
    if (user.role === "MANAGER") {
      if (request.user.approverId !== user.id) {
        return { error: "You can only reject requests from your direct reports" };
      }
      if (request.status !== "PENDING_MANAGER") {
        return { error: "This request is not pending manager approval" };
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        return { error: "This request is not pending HR approval" };
      }
    }
    
    // When rejecting, set the overall status to REJECTED and record who rejected it
    const actionData: Record<string, unknown> = {
      status: "REJECTED",
    };
    
    if (request.status === "PENDING_MANAGER") {
      // Manager rejected - set manager fields and clear any HR fields
      actionData.managerActionBy = user.id;
      actionData.managerActionAt = new Date();
      actionData.managerComments = comments;
      // Clear HR fields since manager rejection overrides everything
      actionData.hrActionBy = null;
      actionData.hrActionAt = null;
      actionData.hrComments = null;
    } else if (request.status === "PENDING_HR") {
      // HR rejected - keep manager approval but set HR rejection
      actionData.hrActionBy = user.id;
      actionData.hrActionAt = new Date();
      actionData.hrComments = comments;
      // Note: We keep manager approval fields as they were already approved
    }
    
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: actionData,
    });
    
    // Revalidate the approvals pages to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${businessUnitId}/approvals/leave/pending`);
    revalidatePath(`/[businessUnitId]/approvals/leave/pending`, "page");
    
    return { success: "Leave request rejected successfully" };
  } catch (error) {
    console.error("Error rejecting leave request:", error);
    return { error: "Failed to reject leave request" };
  }
}
// Server action to approve a leave request (for form submission)
export async function approveLeaveRequestAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const businessUnitId = formData.get("businessUnitId") as string;
  const comments = formData.get("comments") as string;
  
  if (!requestId || !businessUnitId) {
    throw new Error("Missing required parameters");
  }
  
  const result = await approveLeaveRequest(requestId, businessUnitId, comments);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  // Redirect back to the pending approvals page
  const { redirect } = await import("next/navigation");
  redirect(`/${businessUnitId}/approvals/leave/pending`);
}

// Server action to reject a leave request (for form submission)
export async function rejectLeaveRequestAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const businessUnitId = formData.get("businessUnitId") as string;
  const comments = formData.get("comments") as string;
  
  if (!requestId || !businessUnitId) {
    throw new Error("Missing required parameters");
  }
  
  if (!comments?.trim()) {
    throw new Error("Comments are required when rejecting a request");
  }
  
  const result = await rejectLeaveRequest(requestId, businessUnitId, comments);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  // Redirect back to the pending approvals page
  const { redirect } = await import("next/navigation");
  redirect(`/${businessUnitId}/approvals/leave/pending`);
}

// Overtime-related interfaces and functions
export interface PendingOvertimeRequest {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: RequestStatus;
  hours: number;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture?: string | null;
  };
  managerComments?: string | null;
  hrComments?: string | null;
}

export interface PendingOvertimeApprovalsResponse {
  overtimeRequests: PendingOvertimeRequest[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface GetPendingOvertimeApprovalsParams {
  businessUnitId: string;
  status?: string;
  page?: number;
  limit?: number;
}

// Get pending overtime requests for approval
export async function getPendingOvertimeRequests({
  businessUnitId,
  status,
  page = 1,
  limit = 10
}: GetPendingOvertimeApprovalsParams): Promise<PendingOvertimeApprovalsResponse> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    let whereClause: any = {};
    
    if (user.role === "ADMIN") {
      // Admins can see all pending requests in the business unit
      whereClause = {
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: status ? status as RequestStatus : {
          in: ["PENDING_MANAGER", "PENDING_HR"],
        },
      };
    } else if (user.role === "HR") {
      // HR sees only requests that are pending HR approval AND have been approved by manager first
      whereClause = {
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_HR", // HR only sees PENDING_HR requests
        managerActionBy: { not: null }, // Must be approved by manager first
      };
    } else if (user.role === "MANAGER") {
      // Managers see only requests from their direct reports that are pending manager approval (regardless of business unit)
      whereClause = {
        user: { 
          approverId: user.id,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_MANAGER", // Managers only see PENDING_MANAGER requests, ignore status filter
      };
    }
    
    // Get total count for pagination
    const totalCount = await prisma.overtimeRequest.count({
      where: whereClause
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    // Fetch pending requests
    const requests = await prisma.overtimeRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
    
    // Transform requests to include calculated hours
    const transformedRequests: PendingOvertimeRequest[] = requests.map(request => {
      const timeDifference = request.endTime.getTime() - request.startTime.getTime();
      const hours = timeDifference / (1000 * 60 * 60); // Convert to hours
      
      return {
        id: request.id,
        startTime: request.startTime,
        endTime: request.endTime,
        reason: request.reason,
        status: request.status,
        hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
        createdAt: request.createdAt,
        user: request.user,
        managerComments: request.managerComments,
        hrComments: request.hrComments,
      };
    });
    
    return {
      overtimeRequests: transformedRequests,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching pending overtime requests:", error);
    throw new Error("Failed to fetch pending overtime requests");
  }
}

// Approve an overtime request
export async function approveOvertimeRequest(
  requestId: string,
  businessUnitId: string,
  comments?: string
): Promise<{ success?: string; error?: string }> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    // Get the request to check current status and permissions
    const request = await prisma.overtimeRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId })
        }
      },
      include: {
        user: true,
      },
    });
    
    if (!request) {
      return { error: "Overtime request not found" };
    }
    
    // Check if user can approve this request
    if (user.role === "MANAGER") {
      if (request.user.approverId !== user.id) {
        return { error: "You can only approve requests from your direct reports" };
      }
      if (request.status !== "PENDING_MANAGER") {
        return { error: "This request is not pending manager approval" };
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        return { error: "This request is not pending HR approval" };
      }
    }
    
    // Determine next status based on current status and user role
    let newStatus: RequestStatus;
    let updateData: Record<string, string> = {};
    
    if (request.status === "PENDING_MANAGER") {
      // Manager approval moves to HR approval
      newStatus = "PENDING_HR";
      updateData.managerComments = comments || "";
    } else if (request.status === "PENDING_HR") {
      // HR approval completes the process
      newStatus = "APPROVED";
      updateData.hrComments = comments || "";
    } else {
      return { error: "Invalid request status for approval" };
    }
    
    // Update the request with action tracking
    const actionData: Record<string, unknown> = {
      status: newStatus,
      ...updateData,
    };
    
    if (request.status === "PENDING_MANAGER") {
      actionData.managerActionBy = user.id;
      actionData.managerActionAt = new Date();
    } else if (request.status === "PENDING_HR") {
      actionData.hrActionBy = user.id;
      actionData.hrActionAt = new Date();
    }
    
    await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: actionData,
    });
    
    // Revalidate the approvals pages to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${businessUnitId}/approvals/overtime/pending`);
    revalidatePath(`/[businessUnitId]/approvals/overtime/pending`, "page");
    
    const statusMessage = newStatus === "APPROVED" ? "approved" : "forwarded to HR";
    return { success: `Overtime request ${statusMessage} successfully` };
  } catch (error) {
    console.error("Error approving overtime request:", error);
    return { error: "Failed to approve overtime request" };
  }
}

// Reject an overtime request
export async function rejectOvertimeRequest(
  requestId: string,
  businessUnitId: string,
  comments: string
): Promise<{ success?: string; error?: string }> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    
    if (!comments.trim()) {
      return { error: "Comments are required when rejecting a request" };
    }
    
    // Get the request to check current status and permissions
    const request = await prisma.overtimeRequest.findFirst({
      where: {
        id: requestId,
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          },
          // Remove business unit restriction for managers and HR
          ...(user.role === "ADMIN" && { businessUnitId })
        }
      },
      include: {
        user: true,
      },
    });
    
    if (!request) {
      return { error: "Overtime request not found" };
    }
    
    // Check if user can reject this request
    if (user.role === "MANAGER") {
      if (request.user.approverId !== user.id) {
        return { error: "You can only reject requests from your direct reports" };
      }
      if (request.status !== "PENDING_MANAGER") {
        return { error: "This request is not pending manager approval" };
      }
    } else if (user.role === "HR") {
      if (request.status !== "PENDING_HR") {
        return { error: "This request is not pending HR approval" };
      }
    }
    
    // When rejecting, set the overall status to REJECTED and record who rejected it
    const actionData: Record<string, unknown> = {
      status: "REJECTED",
    };
    
    if (request.status === "PENDING_MANAGER") {
      // Manager rejected - set manager fields and clear any HR fields
      actionData.managerActionBy = user.id;
      actionData.managerActionAt = new Date();
      actionData.managerComments = comments;
      // Clear HR fields since manager rejection overrides everything
      actionData.hrActionBy = null;
      actionData.hrActionAt = null;
      actionData.hrComments = null;
    } else if (request.status === "PENDING_HR") {
      // HR rejected - keep manager approval but set HR rejection
      actionData.hrActionBy = user.id;
      actionData.hrActionAt = new Date();
      actionData.hrComments = comments;
      // Note: We keep manager approval fields as they were already approved
    }
    
    await prisma.overtimeRequest.update({
      where: { id: requestId },
      data: actionData,
    });
    
    // Revalidate the approvals pages to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${businessUnitId}/approvals/overtime/pending`);
    revalidatePath(`/[businessUnitId]/approvals/overtime/pending`, "page");
    
    return { success: "Overtime request rejected successfully" };
  } catch (error) {
    console.error("Error rejecting overtime request:", error);
    return { error: "Failed to reject overtime request" };
  }
}

// Server action to approve an overtime request (for form submission)
export async function approveOvertimeRequestAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const businessUnitId = formData.get("businessUnitId") as string;
  const comments = formData.get("comments") as string;
  
  if (!requestId || !businessUnitId) {
    throw new Error("Missing required parameters");
  }
  
  const result = await approveOvertimeRequest(requestId, businessUnitId, comments);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  // Redirect back to the pending approvals page
  const { redirect } = await import("next/navigation");
  redirect(`/${businessUnitId}/approvals/overtime/pending`);
}

// Server action to reject an overtime request (for form submission)
export async function rejectOvertimeRequestAction(formData: FormData) {
  const requestId = formData.get("requestId") as string;
  const businessUnitId = formData.get("businessUnitId") as string;
  const comments = formData.get("comments") as string;
  
  if (!requestId || !businessUnitId) {
    throw new Error("Missing required parameters");
  }
  
  if (!comments?.trim()) {
    throw new Error("Comments are required when rejecting a request");
  }
  
  const result = await rejectOvertimeRequest(requestId, businessUnitId, comments);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  // Redirect back to the pending approvals page
  const { redirect } = await import("next/navigation");
  redirect(`/${businessUnitId}/approvals/overtime/pending`);
}

// Approval History interfaces and functions
export interface ApprovalHistoryLeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: RequestStatus;
  session: string;
  days: number;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  user: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture?: string | null;
  };
  leaveType: {
    id: string;
    name: string;
  };
  managerComments?: string | null;
  hrComments?: string | null;
  actionTaken: 'APPROVED' | 'REJECTED';
  actionComments?: string | null;
}

export interface ApprovalHistoryOvertimeRequest {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: RequestStatus;
  hours: number;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  user: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture?: string | null;
  };
  managerComments?: string | null;
  hrComments?: string | null;
  actionTaken: 'APPROVED' | 'REJECTED';
  actionComments?: string | null;
}

export interface ApprovalHistoryResponse {
  leaveRequests: ApprovalHistoryLeaveRequest[];
  overtimeRequests: ApprovalHistoryOvertimeRequest[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  leaveTypes: {
    id: string;
    name: string;
  }[];
}

export interface GetApprovalHistoryParams {
  businessUnitId: string;
  type?: 'leave' | 'overtime' | 'all';
  status?: 'APPROVED' | 'REJECTED' | 'all';
  leaveTypeId?: string;
  page?: number;
  limit?: number;
}

// Get approval history for the current user
export async function getApprovalHistory({
  businessUnitId,
  type = 'all',
  status = 'all',
  leaveTypeId,
  page = 1,
  limit = 10
}: GetApprovalHistoryParams): Promise<ApprovalHistoryResponse> {
  try {
    const user = await checkApprovalPermissions(businessUnitId);
    

    
    let leaveRequests: ApprovalHistoryLeaveRequest[] = [];
    let overtimeRequests: ApprovalHistoryOvertimeRequest[] = [];
    let totalCount = 0;
    
    // Build status filter
    const statusFilter = status === 'all' ? ['APPROVED', 'REJECTED'] as RequestStatus[] : [status as RequestStatus];
    
    if (type === 'leave' || type === 'all') {
      // Get leave requests that this user has approved/rejected
      let leaveWhereClause: Record<string, unknown> = {
        status: { in: statusFilter },
        ...(leaveTypeId && { leaveTypeId }),
      };
      
      // Add role-specific filters
      if (user.role === 'MANAGER') {
        // For managers, include requests where they are the action taker OR the approver (for backward compatibility)
        leaveWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            user: { 
              approverId: user.id,
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            },
            // Only include if no action tracking is set (backward compatibility) or if manager took action
            OR: [
              { managerActionBy: null, hrActionBy: null }, // No action tracking set
              { managerActionBy: user.id } // Manager took action
            ]
          }
        ];
      } else if (user.role === 'HR') {
        leaveWhereClause.hrActionBy = user.id;
        leaveWhereClause.user = {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        };
      } else if (user.role === 'ADMIN') {
        leaveWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            hrActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          }
        ];
      }
      
      const leaveCount = await prisma.leaveRequest.count({
        where: leaveWhereClause
      });
      
      totalCount += leaveCount;
      
      if (type === 'leave') {
        const skip = (page - 1) * limit;
        const leaveRequestsData = await prisma.leaveRequest.findMany({
          where: leaveWhereClause,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                profilePicture: true,
              },
            },
            leaveType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { managerActionAt: 'desc' },
            { hrActionAt: 'desc' },
            { updatedAt: 'desc' }
          ],
          skip,
          take: limit,
        });
        
        leaveRequests = leaveRequestsData.map(request => {
          const timeDifference = request.endDate.getTime() - request.startDate.getTime();
          const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
          const sessionMultiplier = request.session === "FULL_DAY" ? 1 : 0.5;
          const calculatedDays = daysDifference * sessionMultiplier;
          
          // Determine which action this user took
          let actionTaken: 'APPROVED' | 'REJECTED' = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          let actionComments: string | null = null;
          let approvedAt: Date | null = null;
          let rejectedAt: Date | null = null;
          
          if (user.role === 'MANAGER' && request.managerActionBy === user.id) {
            actionComments = request.managerComments;
            actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            approvedAt = request.status !== 'REJECTED' ? request.managerActionAt : null;
            rejectedAt = request.status === 'REJECTED' ? request.managerActionAt : null;
          } else if (user.role === 'HR' && request.hrActionBy === user.id) {
            actionComments = request.hrComments;
            actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            approvedAt = request.status === 'APPROVED' ? request.hrActionAt : null;
            rejectedAt = request.status === 'REJECTED' ? request.hrActionAt : null;
          }
          
          return {
            id: request.id,
            startDate: request.startDate,
            endDate: request.endDate,
            reason: request.reason,
            status: request.status,
            session: request.session,
            days: calculatedDays,
            createdAt: request.createdAt,
            approvedAt,
            rejectedAt,
            user: request.user,
            leaveType: request.leaveType,
            managerComments: request.managerComments,
            hrComments: request.hrComments,
            actionTaken,
            actionComments,
          };
        });
      }
    }
    
    if (type === 'overtime' || type === 'all') {
      // Get overtime requests that this user has approved/rejected
      let overtimeWhereClause: Record<string, unknown> = {
        status: { in: statusFilter },
      };
      
      // Add role-specific filters
      if (user.role === 'MANAGER') {
        // For managers, include requests where they are the action taker OR the approver (for backward compatibility)
        overtimeWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            user: { 
              approverId: user.id,
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            },
            // Only include if no action tracking is set (backward compatibility) or if manager took action
            OR: [
              { managerActionBy: null, hrActionBy: null }, // No action tracking set
              { managerActionBy: user.id } // Manager took action
            ]
          }
        ];
      } else if (user.role === 'HR') {
        overtimeWhereClause.hrActionBy = user.id;
        overtimeWhereClause.user = {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        };
      } else if (user.role === 'ADMIN') {
        overtimeWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            hrActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          }
        ];
      }
      
      const overtimeCount = await prisma.overtimeRequest.count({
        where: overtimeWhereClause
      });
      

      
      totalCount += overtimeCount;
      
      if (type === 'overtime') {
        const skip = (page - 1) * limit;
        const overtimeRequestsData = await prisma.overtimeRequest.findMany({
          where: overtimeWhereClause,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                approverId: true,
                profilePicture: true,
              },
            },
          },
          orderBy: [
            { managerActionAt: 'desc' },
            { hrActionAt: 'desc' },
            { updatedAt: 'desc' }
          ],
          skip,
          take: limit,
        });
        

        
        overtimeRequests = overtimeRequestsData.map(request => {
          const timeDifference = request.endTime.getTime() - request.startTime.getTime();
          const hours = Math.round((timeDifference / (1000 * 60 * 60)) * 100) / 100;
          
          // Determine which action this user took
          let actionTaken: 'APPROVED' | 'REJECTED' = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          let actionComments: string | null = null;
          let approvedAt: Date | null = null;
          let rejectedAt: Date | null = null;
          
          if (user.role === 'MANAGER') {
            if (request.managerActionBy === user.id) {
              // New tracking system - manager took action
              actionComments = request.managerComments;
              actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
              approvedAt = request.status !== 'REJECTED' ? request.managerActionAt : null;
              rejectedAt = request.status === 'REJECTED' ? request.managerActionAt : null;
            } else if (request.user.approverId === user.id && !request.managerActionBy && !request.hrActionBy) {
              // Backward compatibility - manager is approver but no action tracking
              actionComments = request.managerComments || request.hrComments;
              actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
              approvedAt = request.status === 'APPROVED' ? request.updatedAt : null;
              rejectedAt = request.status === 'REJECTED' ? request.updatedAt : null;
            }
          } else if (user.role === 'HR' && request.hrActionBy === user.id) {
            actionComments = request.hrComments;
            actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            approvedAt = request.status === 'APPROVED' ? request.hrActionAt : null;
            rejectedAt = request.status === 'REJECTED' ? request.hrActionAt : null;
          }
          
          return {
            id: request.id,
            startTime: request.startTime,
            endTime: request.endTime,
            reason: request.reason,
            status: request.status,
            hours,
            createdAt: request.createdAt,
            approvedAt,
            rejectedAt,
            user: request.user,
            managerComments: request.managerComments,
            hrComments: request.hrComments,
            actionTaken,
            actionComments,
          };
        });
      }
    }
    
    // For 'all' type, we need to combine and paginate both types
    if (type === 'all') {
      
      // Get both leave and overtime requests with proper pagination
      const leaveWhereClause: Record<string, unknown> = {
        status: { in: statusFilter },
        ...(leaveTypeId && { leaveTypeId }),
      };
      
      const overtimeWhereClause: Record<string, unknown> = {
        status: { in: statusFilter },
      };
      
      // Add role-specific filters
      if (user.role === 'MANAGER') {
        // For managers, include requests where they are the action taker OR the approver (for backward compatibility)
        leaveWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            user: { 
              approverId: user.id,
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            },
            OR: [
              { managerActionBy: null, hrActionBy: null },
              { managerActionBy: user.id }
            ]
          }
        ];
        overtimeWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            user: { 
              approverId: user.id,
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            },
            OR: [
              { managerActionBy: null, hrActionBy: null },
              { managerActionBy: user.id }
            ]
          }
        ];
      } else if (user.role === 'HR') {
        leaveWhereClause.hrActionBy = user.id;
        leaveWhereClause.user = {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        };
        overtimeWhereClause.hrActionBy = user.id;
        overtimeWhereClause.user = {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        };
      } else if (user.role === 'ADMIN') {
        leaveWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            hrActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          }
        ];
        overtimeWhereClause.OR = [
          { 
            managerActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          },
          { 
            hrActionBy: user.id,
            user: {
              employeeId: {
                notIn: ["T-123", "admin"]
              }
            }
          }
        ];
      }
      
      const [leaveRequestsData, overtimeRequestsData] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: leaveWhereClause,
          include: {
            user: { select: { id: true, name: true, employeeId: true, approverId: true, profilePicture: true } },
            leaveType: { select: { id: true, name: true } },
          },
          orderBy: [
            { managerActionAt: 'desc' },
            { hrActionAt: 'desc' },
            { updatedAt: 'desc' }
          ],
          take: Math.ceil(limit / 2), // Split the limit between leave and overtime
        }),
        
        prisma.overtimeRequest.findMany({
          where: overtimeWhereClause,
          include: {
            user: { select: { id: true, name: true, employeeId: true, approverId: true, profilePicture: true } },
          },
          orderBy: [
            { managerActionAt: 'desc' },
            { hrActionAt: 'desc' },
            { updatedAt: 'desc' }
          ],
          take: Math.ceil(limit / 2), // Split the limit between leave and overtime
        })
      ]);
      
      // Transform leave requests
      leaveRequests = leaveRequestsData.map(request => {
        const timeDifference = request.endDate.getTime() - request.startDate.getTime();
        const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
        const sessionMultiplier = request.session === "FULL_DAY" ? 1 : 0.5;
        const calculatedDays = daysDifference * sessionMultiplier;
        
        let actionTaken: 'APPROVED' | 'REJECTED' = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
        let actionComments: string | null = null;
        let approvedAt: Date | null = null;
        let rejectedAt: Date | null = null;
        
        if (user.role === 'MANAGER' && request.managerActionBy === user.id) {
          actionComments = request.managerComments;
          actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          approvedAt = request.status !== 'REJECTED' ? request.managerActionAt : null;
          rejectedAt = request.status === 'REJECTED' ? request.managerActionAt : null;
        } else if (user.role === 'HR' && request.hrActionBy === user.id) {
          actionComments = request.hrComments;
          actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          approvedAt = request.status === 'APPROVED' ? request.hrActionAt : null;
          rejectedAt = request.status === 'REJECTED' ? request.hrActionAt : null;
        }
        
        return {
          id: request.id,
          startDate: request.startDate,
          endDate: request.endDate,
          reason: request.reason,
          status: request.status,
          session: request.session,
          days: calculatedDays,
          createdAt: request.createdAt,
          approvedAt,
          rejectedAt,
          user: request.user,
          leaveType: request.leaveType,
          managerComments: request.managerComments,
          hrComments: request.hrComments,
          actionTaken,
          actionComments,
        };
      });
      
      // Transform overtime requests
      overtimeRequests = overtimeRequestsData.map(request => {
        const timeDifference = request.endTime.getTime() - request.startTime.getTime();
        const hours = Math.round((timeDifference / (1000 * 60 * 60)) * 100) / 100;
        
        let actionTaken: 'APPROVED' | 'REJECTED' = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
        let actionComments: string | null = null;
        let approvedAt: Date | null = null;
        let rejectedAt: Date | null = null;
        
        if (user.role === 'MANAGER') {
          if (request.managerActionBy === user.id) {
            // New tracking system - manager took action
            actionComments = request.managerComments;
            actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            approvedAt = request.status !== 'REJECTED' ? request.managerActionAt : null;
            rejectedAt = request.status === 'REJECTED' ? request.managerActionAt : null;
          } else if (request.user.approverId === user.id && !request.managerActionBy && !request.hrActionBy) {
            // Backward compatibility - manager is approver but no action tracking
            actionComments = request.managerComments || request.hrComments;
            actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            approvedAt = request.status === 'APPROVED' ? request.updatedAt : null;
            rejectedAt = request.status === 'REJECTED' ? request.updatedAt : null;
          }
        } else if (user.role === 'HR' && request.hrActionBy === user.id) {
          actionComments = request.hrComments;
          actionTaken = request.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          approvedAt = request.status === 'APPROVED' ? request.hrActionAt : null;
          rejectedAt = request.status === 'REJECTED' ? request.hrActionAt : null;
        }
        
        return {
          id: request.id,
          startTime: request.startTime,
          endTime: request.endTime,
          reason: request.reason,
          status: request.status,
          hours,
          createdAt: request.createdAt,
          approvedAt,
          rejectedAt,
          user: request.user,
          managerComments: request.managerComments,
          hrComments: request.hrComments,
          actionTaken,
          actionComments,
        };
      });
    }
    
    // Get leave types for filtering
    const leaveTypes = await prisma.leaveType.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'desc'
      }
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      leaveRequests,
      overtimeRequests,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      leaveTypes,
    };
  } catch (error) {
    console.error("Error fetching approval history:", error);
    throw new Error("Failed to fetch approval history");
  }
}

// Helper function to deduct leave days from user's balance when HR approves a leave request
async function deductLeaveBalance(request: {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  session: string;
}) {
  try {
    // Calculate the number of days to deduct
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    
    // Adjust for session type
    let daysToDeduct = daysDiff;
    if (request.session === 'MORNING' || request.session === 'AFTERNOON') {
      daysToDeduct = daysDiff * 0.5; // Half day
    }
    
    // Get the current year for the leave balance
    const currentYear = new Date().getFullYear();
    
    // Find the user's leave balance for this leave type and year
    const leaveBalance = await prisma.leaveBalance.findFirst({
      where: {
        userId: request.userId,
        leaveTypeId: request.leaveTypeId,
        year: currentYear
      }
    });
    
    if (!leaveBalance) {
      console.error(`No leave balance found for user ${request.userId}, leave type ${request.leaveTypeId}, year ${currentYear}`);
      return;
    }
    
    // Check if user has enough remaining days
    const remainingDays = leaveBalance.allocatedDays - leaveBalance.usedDays;
    if (remainingDays < daysToDeduct) {
      console.error(`Insufficient leave balance. Remaining: ${remainingDays}, Requested: ${daysToDeduct}`);
      // Note: We still proceed with the deduction but log the issue
      // In a production system, you might want to handle this differently
    }
    
    // Update the leave balance by adding to usedDays
    await prisma.leaveBalance.update({
      where: {
        id: leaveBalance.id
      },
      data: {
        usedDays: {
          increment: daysToDeduct
        }
      }
    });
    
    console.log(`Successfully deducted ${daysToDeduct} days from leave balance for user ${request.userId}`);
    
  } catch (error) {
    console.error("Error deducting leave balance:", error);
    // Don't throw the error to avoid breaking the approval process
    // The approval should still succeed even if balance deduction fails
  }
}