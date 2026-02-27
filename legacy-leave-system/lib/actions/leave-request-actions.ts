"use server";

import { prisma } from "@/lib/prisma";

type RequestStatus = 'PENDING_MANAGER' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequestWithDetails {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  session: string;
  days: number;
  createdAt: Date;
  leaveType: {
    id: string;
    name: string;
  };
  managerActionBy?: string | null;
  managerComments?: string | null;
  hrComments?: string | null;
}

export interface LeaveRequestsResponse {
  requests: LeaveRequestWithDetails[];
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

export interface GetLeaveRequestsParams {
  userId: string;
  businessUnitId: string;
  status?: string;
  leaveTypeId?: string;
  page?: number;
  limit?: number;
}

export async function getLeaveRequests({
  userId,
  businessUnitId,
  status,
  leaveTypeId,
  page = 1,
  limit = 10
}: GetLeaveRequestsParams): Promise<LeaveRequestsResponse> {
  try {
    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: {
        userId,
        user: {
          businessUnitId
        },
        ...(status && status !== 'all-status' && { status: status as RequestStatus }),
        ...(leaveTypeId && { leaveTypeId })
      }
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    // Fetch requests with pagination
    const requests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        user: {
          businessUnitId
        },
        ...(status && status !== 'all-status' && { status: status as RequestStatus }),
        ...(leaveTypeId && { leaveTypeId })
      },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get available leave types for filtering
    const leaveTypes = await prisma.leaveType.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform requests to include calculated days
    const transformedRequests: LeaveRequestWithDetails[] = requests.map(request => {
      // Calculate days based on date range
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
        leaveType: {
          id: request.leaveType.id,
          name: request.leaveType.name
        },
        managerComments: request.managerComments,
        hrComments: request.hrComments
      };
    });

    return {
      requests: transformedRequests,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      leaveTypes
    };
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    throw new Error("Failed to fetch leave requests");
  }
}

export async function getLeaveRequestById(
  requestId: string,
  userId: string
): Promise<LeaveRequestWithDetails | null> {
  try {
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        userId
      },
      include: {
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
      leaveType: request.leaveType,
      managerActionBy: request.managerActionBy,
      managerComments: request.managerComments,
      hrComments: request.hrComments
    };
  } catch (error) {
    console.error("Error fetching leave request:", error);
    throw new Error("Failed to fetch leave request");
  }
}

export async function cancelLeaveRequest(
  requestId: string,
  userId: string
): Promise<{ success?: string; error?: string }> {
  try {
    // Check if request exists and belongs to user
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        userId
      }
    });

    if (!request) {
      return { error: "Leave request not found" };
    }

    // Check if request can be cancelled (only pending requests)
    if (!request.status.includes('PENDING')) {
      return { error: "Only pending requests can be cancelled" };
    }

    // Update request status to cancelled
    await prisma.leaveRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: 'CANCELLED'
      }
    });

    return { success: "Leave request cancelled successfully" };
  } catch (error) {
    console.error("Error cancelling leave request:", error);
    return { error: "Failed to cancel leave request" };
  }
}

export async function updateLeaveRequest(
  requestId: string,
  data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    session: string;
    reason: string;
  }
): Promise<{ success?: string; error?: string }> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    // Check if request exists and belongs to user
    const request = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        userId: session.user.id
      }
    });

    if (!request) {
      return { error: "Leave request not found" };
    }

    // Check if request can be edited (only pending requests that haven't been approved by manager)
    if (!request.status.includes('PENDING') || request.managerActionBy) {
      return { error: "This request cannot be edited as it has already been processed by a manager" };
    }

    // Validate dates
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    if (start > end) {
      return { error: "End date must be after start date" };
    }

    // Check if leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId }
    });

    if (!leaveType) {
      return { error: "Invalid leave type" };
    }

    // Update leave request
    await prisma.leaveRequest.update({
      where: {
        id: requestId
      },
      data: {
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        session: data.session as "FULL_DAY" | "MORNING" | "AFTERNOON",
        reason: data.reason,
        updatedAt: new Date()
      }
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${session.user.businessUnit?.id}/leave-requests`);
    revalidatePath(`/${session.user.businessUnit?.id}/leave-requests/${requestId}`);

    return { success: "Leave request updated successfully" };
  } catch (error) {
    console.error("Error updating leave request:", error);
    return { error: "Failed to update leave request" };
  }
}