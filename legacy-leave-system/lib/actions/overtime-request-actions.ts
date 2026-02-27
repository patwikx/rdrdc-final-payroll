"use server";

import { prisma } from "@/lib/prisma";

type RequestStatus = 'PENDING_MANAGER' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface OvertimeRequestWithDetails {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: string;
  hours: number;
  createdAt: Date;
  managerComments?: string | null;
  hrComments?: string | null;
}

export interface OvertimeRequestsResponse {
  requests: OvertimeRequestWithDetails[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface GetOvertimeRequestsParams {
  userId: string;
  businessUnitId: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getOvertimeRequests({
  userId,
  businessUnitId,
  status,
  page = 1,
  limit = 10
}: GetOvertimeRequestsParams): Promise<OvertimeRequestsResponse> {
  try {
    // Get total count for pagination
    const totalCount = await prisma.overtimeRequest.count({
      where: {
        userId,
        user: {
          businessUnitId
        },
        ...(status && status !== 'all-status' && { status: status as RequestStatus })
      }
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    // Fetch requests with pagination
    const requests = await prisma.overtimeRequest.findMany({
      where: {
        userId,
        user: {
          businessUnitId
        },
        ...(status && status !== 'all-status' && { status: status as RequestStatus })
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Transform requests to include calculated hours
    const transformedRequests: OvertimeRequestWithDetails[] = requests.map(request => {
      // Calculate hours based on time difference
      const timeDifference = request.endTime.getTime() - request.startTime.getTime();
      const hours = timeDifference / (1000 * 60 * 60); // Convert milliseconds to hours

      return {
        id: request.id,
        userId: request.userId,
        startTime: request.startTime,
        endTime: request.endTime,
        reason: request.reason,
        status: request.status,
        hours: Math.round(hours * 100) / 100, // Round to 2 decimal places
        createdAt: request.createdAt,
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
      }
    };
  } catch (error) {
    console.error("Error fetching overtime requests:", error);
    throw new Error("Failed to fetch overtime requests");
  }
}

export async function getOvertimeRequestById(
  requestId: string,
  userId?: string
): Promise<OvertimeRequestWithDetails | null> {
  try {
    const request = await prisma.overtimeRequest.findFirst({
      where: {
        id: requestId,
        ...(userId && { userId })
      }
    });

    if (!request) {
      return null;
    }

    // Calculate hours
    const timeDifference = request.endTime.getTime() - request.startTime.getTime();
    const hours = timeDifference / (1000 * 60 * 60);

    return {
      id: request.id,
      userId: request.userId,
      startTime: request.startTime,
      endTime: request.endTime,
      reason: request.reason,
      status: request.status,
      hours: Math.round(hours * 100) / 100,
      createdAt: request.createdAt,
      managerComments: request.managerComments,
      hrComments: request.hrComments
    };
  } catch (error) {
    console.error("Error fetching overtime request:", error);
    throw new Error("Failed to fetch overtime request");
  }
}

export async function cancelOvertimeRequest(
  requestId: string,
  userId: string
): Promise<{ success?: string; error?: string }> {
  try {
    // Check if request exists and belongs to user
    const request = await prisma.overtimeRequest.findFirst({
      where: {
        id: requestId,
        userId
      }
    });

    if (!request) {
      return { error: "Overtime request not found" };
    }

    // Check if request can be cancelled (only pending requests)
    if (!request.status.includes('PENDING')) {
      return { error: "Only pending requests can be cancelled" };
    }

    // Update request status to cancelled and clear approval fields
    await prisma.overtimeRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: 'CANCELLED',
        managerActionBy: null,
        managerActionAt: null,
        managerComments: null,
        hrActionBy: null,
        hrActionAt: null,
        hrComments: null
      }
    });

    return { success: "Overtime request cancelled successfully" };
  } catch (error) {
    console.error("Error cancelling overtime request:", error);
    return { error: "Failed to cancel overtime request" };
  }
}