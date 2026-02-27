"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface LeaveTypeWithStats {
  id: string;
  name: string;
  defaultAllocatedDays: number;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    leaveBalances: number;
    leaveRequests: number;
  };
}

export interface LeaveTypesResponse {
  leaveTypes: LeaveTypeWithStats[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface GetLeaveTypesParams {
  businessUnitId: string;
  page?: number;
  limit?: number;
  search?: string;
}

// Check if user has admin permissions
async function checkAdminPermissions(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only admins can manage leave types
  if (session.user.role !== "ADMIN") {
    throw new Error("Insufficient permissions to manage leave types");
  }
  
  return session.user;
}

export async function getLeaveTypes({
  businessUnitId,
  page = 1,
  limit = 20,
  search
}: GetLeaveTypesParams): Promise<LeaveTypesResponse> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    const whereClause = search ? {
      name: {
        contains: search,
        mode: 'insensitive' as const
      }
    } : {};
    
    // Get total count for pagination
    const totalCount = await prisma.leaveType.count({
      where: whereClause
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    // Fetch leave types with stats
    const leaveTypes = await prisma.leaveType.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            leaveBalances: true,
            leaveRequests: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      skip,
      take: limit,
    });
    
    return {
      leaveTypes,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching leave types:", error);
    throw new Error("Failed to fetch leave types");
  }
}

export async function createLeaveType(
  businessUnitId: string,
  name: string,
  defaultAllocatedDays: number
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    if (!name.trim()) {
      return { error: "Leave type name is required" };
    }
    
    if (defaultAllocatedDays < 0) {
      return { error: "Default allocated days cannot be negative" };
    }
    
    // Check if leave type already exists
    const existingLeaveType = await prisma.leaveType.findUnique({
      where: { name: name.trim() }
    });
    
    if (existingLeaveType) {
      return { error: "Leave type with this name already exists" };
    }
    
    // Get all users in the business unit
    const users = await prisma.user.findMany({
      where: { businessUnitId },
      select: { id: true, name: true }
    });
    
    const currentYear = new Date().getFullYear();
    
    // Create leave type and balances in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the leave type
      const newLeaveType = await tx.leaveType.create({
        data: {
          name: name.trim(),
          defaultAllocatedDays
        }
      });
      
      // Create leave balances for all users in the business unit
      const leaveBalances = users.map(user => ({
        userId: user.id,
        leaveTypeId: newLeaveType.id,
        year: currentYear,
        allocatedDays: defaultAllocatedDays,
        usedDays: 0
      }));
      
      if (leaveBalances.length > 0) {
        await tx.leaveBalance.createMany({
          data: leaveBalances,
          skipDuplicates: true // In case some users already have this leave type
        });
      }
      
      return {
        leaveType: newLeaveType,
        balancesCreated: leaveBalances.length
      };
    });
    
    // Revalidate relevant pages
    revalidatePath(`/${businessUnitId}/admin/leave-types`);
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { 
      success: `Created leave type "${result.leaveType.name}" and added balances for ${result.balancesCreated} users` 
    };
  } catch (error) {
    console.error("Error creating leave type:", error);
    return { error: "Failed to create leave type" };
  }
}

export async function updateLeaveType(
  businessUnitId: string,
  leaveTypeId: string,
  name: string,
  defaultAllocatedDays: number
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    if (!name.trim()) {
      return { error: "Leave type name is required" };
    }
    
    if (defaultAllocatedDays < 0) {
      return { error: "Default allocated days cannot be negative" };
    }
    
    // Check if leave type exists
    const existingLeaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId }
    });
    
    if (!existingLeaveType) {
      return { error: "Leave type not found" };
    }
    
    // Check if name is already taken by another leave type
    const duplicateLeaveType = await prisma.leaveType.findFirst({
      where: {
        name: name.trim(),
        id: { not: leaveTypeId }
      }
    });
    
    if (duplicateLeaveType) {
      return { error: "Leave type with this name already exists" };
    }
    
    // Update the leave type
    await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: {
        name: name.trim(),
        defaultAllocatedDays
      }
    });
    
    // Revalidate relevant pages
    revalidatePath(`/${businessUnitId}/admin/leave-types`);
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { success: `Updated leave type "${name.trim()}"` };
  } catch (error) {
    console.error("Error updating leave type:", error);
    return { error: "Failed to update leave type" };
  }
}

export async function deleteLeaveType(
  businessUnitId: string,
  leaveTypeId: string
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    // Check if leave type exists
    const existingLeaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      include: {
        _count: {
          select: {
            leaveBalances: true,
            leaveRequests: true
          }
        }
      }
    });
    
    if (!existingLeaveType) {
      return { error: "Leave type not found" };
    }
    
    // Check if leave type has any requests
    if (existingLeaveType._count.leaveRequests > 0) {
      return { 
        error: `Cannot delete leave type "${existingLeaveType.name}" because it has ${existingLeaveType._count.leaveRequests} associated leave requests` 
      };
    }
    
    // Delete leave type (this will cascade delete leave balances)
    await prisma.leaveType.delete({
      where: { id: leaveTypeId }
    });
    
    // Revalidate relevant pages
    revalidatePath(`/${businessUnitId}/admin/leave-types`);
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { 
      success: `Deleted leave type "${existingLeaveType.name}" and ${existingLeaveType._count.leaveBalances} associated balances` 
    };
  } catch (error) {
    console.error("Error deleting leave type:", error);
    return { error: "Failed to delete leave type" };
  }
}