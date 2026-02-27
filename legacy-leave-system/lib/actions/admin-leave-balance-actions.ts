"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface UserLeaveBalance {
  id: string;
  userId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  user: {
    id: string;
    name: string;
    employeeId: string;
    department: {
      id: string;
      name: string;
    } | null;
  };
  leaveType: {
    id: string;
    name: string;
  };
}

export interface AdminLeaveBalancesResponse {
  balances: UserLeaveBalance[];
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
  users: {
    id: string;
    name: string;
    employeeId: string;
  }[];
}

export interface GetAdminLeaveBalancesParams {
  businessUnitId: string;
  year?: number;
  leaveTypeId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

// Check if user has admin permissions
async function checkAdminPermissions(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only admins and HR can manage leave balances
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    throw new Error("Insufficient permissions to manage leave balances");
  }
  
  return session.user;
}

// Define allowed leave types for admin view
const ADMIN_VISIBLE_LEAVE_TYPES = ['VACATION', 'SICK', 'MANDATORY', 'CTO'];

function isAdminVisibleLeaveType(leaveTypeName: string): boolean {
  return ADMIN_VISIBLE_LEAVE_TYPES.some(type => 
    leaveTypeName.toUpperCase().includes(type.toUpperCase())
  );
}

export async function getAdminLeaveBalances({
  businessUnitId,
  year = new Date().getFullYear(),
  leaveTypeId,
  userId,
  page = 1,
  limit = 20
}: GetAdminLeaveBalancesParams): Promise<AdminLeaveBalancesResponse> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    // First get all leave types to filter by allowed ones
    const allLeaveTypes = await prisma.leaveType.findMany({
      select: { id: true, name: true }
    });
    
    const allowedLeaveTypeIds = allLeaveTypes
      .filter(lt => isAdminVisibleLeaveType(lt.name))
      .map(lt => lt.id);
    
    const whereClause: Record<string, unknown> = {
      year,
      user: { 
        businessUnitId,
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      leaveTypeId: { in: allowedLeaveTypeIds },
      ...(leaveTypeId && { leaveTypeId }),
      ...(userId && { userId }),
    };
    
    // Get total count for pagination
    const totalCount = await prisma.leaveBalance.count({
      where: whereClause
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    // Fetch balances, leave types, and users in parallel
    const [balances, leaveTypes, users] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
          { user: { name: 'asc' } },
          { leaveType: { name: 'asc' } }
        ],
        skip,
        take: limit,
      }),
      
      // Get available leave types (filtered to admin visible only)
      prisma.leaveType.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      }).then(types => types.filter(lt => isAdminVisibleLeaveType(lt.name))),
      
      // Get users in the business unit
      prisma.user.findMany({
        where: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        select: {
          id: true,
          name: true,
          employeeId: true
        },
        orderBy: {
          name: 'asc'
        }
      })
    ]);
    
    // Transform balances to include calculated remaining days
    const transformedBalances: UserLeaveBalance[] = balances.map(balance => ({
      id: balance.id,
      userId: balance.userId,
      leaveTypeId: balance.leaveTypeId,
      year: balance.year,
      allocatedDays: balance.allocatedDays,
      usedDays: balance.usedDays,
      remainingDays: balance.allocatedDays - balance.usedDays,
      user: balance.user,
      leaveType: balance.leaveType,
    }));
    
    return {
      balances: transformedBalances,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      leaveTypes,
      users,
    };
  } catch (error) {
    console.error("Error fetching admin leave balances:", error);
    throw new Error("Failed to fetch leave balances");
  }
}

export async function updateLeaveBalance(
  balanceId: string,
  businessUnitId: string,
  allocatedDays: number
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    if (allocatedDays < 0) {
      return { error: "Allocated days cannot be negative" };
    }
    
    // Get the current balance to check if it exists and belongs to the business unit
    const existingBalance = await prisma.leaveBalance.findFirst({
      where: {
        id: balanceId,
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        }
      },
      include: {
        user: { select: { name: true } },
        leaveType: { select: { name: true } }
      }
    });
    
    if (!existingBalance) {
      return { error: "Leave balance not found" };
    }
    
    // Update the balance
    await prisma.leaveBalance.update({
      where: { id: balanceId },
      data: { allocatedDays }
    });
    
    // Revalidate the admin leave balances page
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { 
      success: `Updated ${existingBalance.leaveType.name} balance for ${existingBalance.user.name}` 
    };
  } catch (error) {
    console.error("Error updating leave balance:", error);
    return { error: "Failed to update leave balance" };
  }
}

export async function bulkUpdateLeaveBalances(
  updates: { balanceId: string; allocatedDays: number }[],
  businessUnitId: string
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    // Validate all updates
    for (const update of updates) {
      if (update.allocatedDays < 0) {
        return { error: "Allocated days cannot be negative" };
      }
    }
    
    // Verify all balances exist and belong to the business unit
    const balanceIds = updates.map(u => u.balanceId);
    const existingBalances = await prisma.leaveBalance.findMany({
      where: {
        id: { in: balanceIds },
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        }
      }
    });
    
    if (existingBalances.length !== updates.length) {
      return { error: "Some leave balances were not found" };
    }
    
    // Perform bulk update using transaction
    await prisma.$transaction(
      updates.map(update =>
        prisma.leaveBalance.update({
          where: { id: update.balanceId },
          data: { allocatedDays: update.allocatedDays }
        })
      )
    );
    
    // Revalidate the admin leave balances page
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { success: `Updated ${updates.length} leave balances successfully` };
  } catch (error) {
    console.error("Error bulk updating leave balances:", error);
    return { error: "Failed to update leave balances" };
  }
}

export async function createLeaveBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
  allocatedDays: number,
  businessUnitId: string
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    if (allocatedDays < 0) {
      return { error: "Allocated days cannot be negative" };
    }
    
    // Verify user belongs to the business unit
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessUnitId,
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      select: { name: true }
    });
    
    if (!user) {
      return { error: "User not found in this business unit" };
    }
    
    // Verify leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { name: true }
    });
    
    if (!leaveType) {
      return { error: "Leave type not found" };
    }
    
    // Check if balance already exists for this user, leave type, and year
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId,
          leaveTypeId,
          year
        }
      }
    });
    
    if (existingBalance) {
      return { error: `Leave balance for ${leaveType.name} in ${year} already exists for this user` };
    }
    
    // Create the balance
    await prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId,
        year,
        allocatedDays,
        usedDays: 0
      }
    });
    
    // Revalidate the admin leave balances page
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    return { 
      success: `Created ${leaveType.name} balance for ${user.name} (${year})` 
    };
  } catch (error) {
    console.error("Error creating leave balance:", error);
    return { error: "Failed to create leave balance" };
  }
}

// Types for replenishment
export interface CarryOverInfo {
  userId: string;
  userName: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  remainingDays: number;
  carryOverDays: number;
  excessDays: number;
  hasExcess: boolean;
  withinLimit: boolean;
}

export interface ReplenishmentPreview {
  year: number;
  targetYear: number;
  totalUsers: number;
  carryOverInfo: CarryOverInfo[];
  leaveTypesToReplenish: {
    id: string;
    name: string;
    defaultAllocatedDays: number;
  }[];
}

// Define which leave types can carry over
const CARRY_OVER_LEAVE_TYPES = ['VACATION', 'SICK LEAVE', 'SICK', 'ANNUAL LEAVE'];
const CARRY_OVER_LIMIT = 20;

function isCarryOverEligible(leaveTypeName: string): boolean {
  return CARRY_OVER_LEAVE_TYPES.some(type => 
    leaveTypeName.toUpperCase().includes(type.toUpperCase())
  );
}

export async function getReplenishmentPreview(
  businessUnitId: string,
  fromYear: number,
  toYear: number
): Promise<ReplenishmentPreview> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    // Get all leave types (filtered to admin visible only)
    const allLeaveTypes = await prisma.leaveType.findMany({
      select: {
        id: true,
        name: true,
        defaultAllocatedDays: true
      },
      orderBy: { name: 'asc' }
    });
    
    const leaveTypes = allLeaveTypes.filter(lt => isAdminVisibleLeaveType(lt.name));
    
    // Get all users in the business unit
    const users = await prisma.user.findMany({
      where: { 
        businessUnitId,
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      select: {
        id: true,
        name: true,
        employeeId: true
      }
    });
    
    // Get current year balances for carry-over eligible leave types
    const carryOverEligibleTypes = leaveTypes.filter(lt => isCarryOverEligible(lt.name));
    
    const currentBalances = await prisma.leaveBalance.findMany({
      where: {
        year: fromYear,
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        leaveTypeId: { in: carryOverEligibleTypes.map(lt => lt.id) }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true
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
    
    // Calculate carry-over information
    const carryOverInfo: CarryOverInfo[] = currentBalances
      .map(balance => {
        const remainingDays = balance.allocatedDays - balance.usedDays;
        const carryOverDays = remainingDays; // Carry over all remaining days
        const excessDays = Math.max(0, remainingDays - CARRY_OVER_LIMIT);
        const withinLimit = remainingDays <= CARRY_OVER_LIMIT;
        
        return {
          userId: balance.userId,
          userName: balance.user.name,
          employeeId: balance.user.employeeId,
          leaveTypeId: balance.leaveTypeId,
          leaveTypeName: balance.leaveType.name,
          remainingDays,
          carryOverDays,
          excessDays,
          hasExcess: excessDays > 0,
          withinLimit
        };
      })
      .filter(info => info.remainingDays > 0); // Only show users with remaining days
    
    return {
      year: fromYear,
      targetYear: toYear,
      totalUsers: users.length,
      carryOverInfo,
      leaveTypesToReplenish: leaveTypes
    };
  } catch (error) {
    console.error("Error getting replenishment preview:", error);
    throw new Error("Failed to get replenishment preview");
  }
}

export async function replenishLeaveBalances(
  businessUnitId: string,
  fromYear: number,
  toYear: number,
  acknowledgeExcess: boolean = false
): Promise<{ success?: string; error?: string; warnings?: string[] }> {
  try {
    await checkAdminPermissions(businessUnitId);
    
    // Get replenishment preview to validate
    const preview = await getReplenishmentPreview(businessUnitId, fromYear, toYear);
    
    // Check for excess days and require acknowledgment
    const usersWithExcess = preview.carryOverInfo.filter(info => info.hasExcess);
    if (usersWithExcess.length > 0 && !acknowledgeExcess) {
      return {
        error: `${usersWithExcess.length} users have leave balances above the 20-day guideline. All days will be carried over - please acknowledge.`,
        warnings: usersWithExcess.map(info => 
          `${info.userName} (${info.employeeId}): ${info.leaveTypeName} - ${info.remainingDays} days (${info.excessDays} above guideline)`
        )
      };
    }
    
    // Get all users in the business unit
    const users = await prisma.user.findMany({
      where: { 
        businessUnitId,
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      select: { id: true, name: true }
    });
    
    // Get all leave types with their default allocations (filtered to admin visible only)
    const allLeaveTypes = await prisma.leaveType.findMany({
      select: {
        id: true,
        name: true,
        defaultAllocatedDays: true
      }
    });
    
    const leaveTypes = allLeaveTypes.filter(lt => isAdminVisibleLeaveType(lt.name));
    
    // Check if target year balances already exist
    const existingTargetBalances = await prisma.leaveBalance.findFirst({
      where: {
        year: toYear,
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        }
      }
    });
    
    if (existingTargetBalances) {
      return { error: `Leave balances for ${toYear} already exist. Cannot replenish.` };
    }
    
    // Perform replenishment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdBalances: string[] = [];
      
      for (const user of users) {
        for (const leaveType of leaveTypes) {
          let allocatedDays = leaveType.defaultAllocatedDays;
          
          // Add carry-over days for eligible leave types
          if (isCarryOverEligible(leaveType.name)) {
            const carryOverInfo = preview.carryOverInfo.find(
              info => info.userId === user.id && info.leaveTypeId === leaveType.id
            );
            
            if (carryOverInfo) {
              // Carry over all remaining days (including excess above 20)
              allocatedDays += carryOverInfo.carryOverDays;
            }
          }
          
          // Create the new balance
          await tx.leaveBalance.create({
            data: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: toYear,
              allocatedDays,
              usedDays: 0
            }
          });
          
          createdBalances.push(`${user.name}: ${leaveType.name} (${allocatedDays} days)`);
        }
      }
      
      return createdBalances;
    });
    
    // Revalidate the admin leave balances page
    revalidatePath(`/${businessUnitId}/admin/leave-balances`);
    
    const totalBalancesCreated = users.length * leaveTypes.length;
    const usersWithCarryOver = preview.carryOverInfo.length;
    
    return {
      success: `Successfully replenished leave balances for ${toYear}. Created ${totalBalancesCreated} balances for ${users.length} users. ${usersWithCarryOver} users had carry-over days applied.`
    };
  } catch (error) {
    console.error("Error replenishing leave balances:", error);
    return { error: "Failed to replenish leave balances" };
  }
}