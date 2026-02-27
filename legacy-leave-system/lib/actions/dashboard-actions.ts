"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

// Types for dashboard data (user-specific)
export interface DashboardStats {
  totalEmployees: number; // For regular users: 1, for managers: team size, for admins: all employees
  totalLeaveRequests: number; // User's own leave requests
  pendingLeaveRequests: number; // User's pending leave requests
  totalOvertimeRequests: number; // User's own overtime requests
  pendingOvertimeRequests: number; // User's pending overtime requests
  totalDepartments: number; // For regular users: 1, for admins: all departments
}

export interface RecentLeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  status: RequestStatus;
  session: string;
  reason: string;
  user: {
    id: string;
    name: string;
    employeeId: string;
  };
  leaveType: {
    id: string;
    name: string;
  };
}

export interface RecentOvertimeRequest {
  id: string;
  startTime: Date;
  endTime: Date;
  status: RequestStatus;
  reason: string;
  user: {
    id: string;
    name: string;
    employeeId: string;
  };
}

export interface LeaveBalance {
  id: string;
  allocatedDays: number;
  usedDays: number;
  leaveType: {
    id: string;
    name: string;
  };
}

// Check if user has access to business unit
async function checkBusinessUnitAccess(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Special handling for the "unauthorized" case - this suggests a navigation issue
  if (businessUnitId === "unauthorized") {
    console.error("Navigation error detected: businessUnitId is 'unauthorized'", {
      userBusinessUnitId: session.user.businessUnit?.id,
      userRole: session.user.role,
      userName: session.user.name
    });
    throw new Error(`Navigation error: Invalid business unit ID 'unauthorized'. User should be accessing /${session.user.businessUnit?.id} instead.`);
  }
  
  // Admins, HR, Accounting, and Purchasing users can access any business unit
  if (
    session.user.role === "ADMIN" || 
    session.user.role === "HR" || 
    session.user.isAcctg || 
    session.user.isPurchaser
  ) {
    return session.user;
  }
  
  // Regular users and managers can only access their own business unit
  if (!session.user.businessUnit?.id) {
    throw new Error("User not assigned to any business unit");
  }
  
  if (session.user.businessUnit.id !== businessUnitId) {
    throw new Error(`Access denied: User business unit ${session.user.businessUnit.id} does not match requested ${businessUnitId}`);
  }
  
  return session.user;
}

// Get dashboard statistics (user-specific for personal dashboard)
export async function getDashboardStats(businessUnitId: string): Promise<DashboardStats> {
  try {
    const user = await checkBusinessUnitAccess(businessUnitId);
    
    const [
      totalEmployees,
      totalLeaveRequests,
      pendingLeaveRequests,
      totalOvertimeRequests,
      pendingOvertimeRequests,
      totalDepartments,
    ] = await Promise.all([
      // For regular users: show 1 (themselves), for managers/admins: show team size
      user.role === "ADMIN" || user.role === "HR" 
        ? prisma.user.count({ where: { businessUnitId } })
        : user.role === "MANAGER"
        ? prisma.user.count({ where: { approverId: user.id } }).then(count => count + 1) // +1 for themselves
        : Promise.resolve(1), // Regular users see just themselves
      
      // User's own leave requests
      prisma.leaveRequest.count({
        where: { userId: user.id },
      }),
      
      // User's pending leave requests
      prisma.leaveRequest.count({
        where: {
          userId: user.id,
          status: {
            in: ["PENDING_MANAGER", "PENDING_HR"],
          },
        },
      }),
      
      // User's own overtime requests
      prisma.overtimeRequest.count({
        where: { userId: user.id },
      }),
      
      // User's pending overtime requests
      prisma.overtimeRequest.count({
        where: {
          userId: user.id,
          status: {
            in: ["PENDING_MANAGER", "PENDING_HR"],
          },
        },
      }),
      
      // User's department (1) or total departments for admins
      user.role === "ADMIN" || user.role === "HR"
        ? prisma.department.count({
            where: {
              members: {
                some: { businessUnitId },
              },
            },
          })
        : Promise.resolve(1), // Regular users see their own department
    ]);

    return {
      totalEmployees,
      totalLeaveRequests,
      pendingLeaveRequests,
      totalOvertimeRequests,
      pendingOvertimeRequests,
      totalDepartments,
    };
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return {
      totalEmployees: 0,
      totalLeaveRequests: 0,
      pendingLeaveRequests: 0,
      totalOvertimeRequests: 0,
      pendingOvertimeRequests: 0,
      totalDepartments: 0,
    };
  }
}

// Get recent leave requests (user's own requests only for personal dashboard)
export async function getRecentLeaveRequests(businessUnitId: string): Promise<RecentLeaveRequest[]> {
  try {
    const user = await checkBusinessUnitAccess(businessUnitId);
    
    // For personal dashboard, always show only the logged-in user's own requests
    const requests = await prisma.leaveRequest.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
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
      take: 5,
    });

    return requests;
  } catch (error) {
    console.error("Get recent leave requests error:", error);
    return [];
  }
}

// Get recent overtime requests (user's own requests only for personal dashboard)
export async function getRecentOvertimeRequests(businessUnitId: string): Promise<RecentOvertimeRequest[]> {
  try {
    const user = await checkBusinessUnitAccess(businessUnitId);
    
    // For personal dashboard, always show only the logged-in user's own requests
    const requests = await prisma.overtimeRequest.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return requests;
  } catch (error) {
    console.error("Get recent overtime requests error:", error);
    return [];
  }
}

// Get user's leave balances
export async function getUserLeaveBalances(businessUnitId: string): Promise<LeaveBalance[]> {
  try {
    const user = await checkBusinessUnitAccess(businessUnitId);
    
    const currentYear = new Date().getFullYear();
    
    const balances = await prisma.leaveBalance.findMany({
      where: {
        userId: user.id,
        year: currentYear,
      },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        leaveType: { name: "asc" },
      },
    });

    return balances;
  } catch (error) {
    console.error("Get user leave balances error:", error);
    return [];
  }
}

// Get pending approvals assigned to the logged-in user
export async function getPendingApprovals(businessUnitId: string) {
  try {
    const user = await checkBusinessUnitAccess(businessUnitId);
    
    // Only managers, HR, and admins can see pending approvals
    if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "MANAGER") {
      return { leaveRequests: [], overtimeRequests: [] };
    }
    
    let leaveWhereClause = {};
    let overtimeWhereClause = {};
    
    if (user.role === "ADMIN") {
      // Admins can see all pending requests in the business unit
      leaveWhereClause = {
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: {
          in: ["PENDING_MANAGER", "PENDING_HR"],
        },
      };
      overtimeWhereClause = {
        user: { 
          businessUnitId,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: {
          in: ["PENDING_MANAGER", "PENDING_HR"],
        },
      };
    } else if (user.role === "HR") {
      // HR sees only requests that are pending HR approval AND have been approved by manager first
      leaveWhereClause = {
        user: {
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_HR", // HR only sees PENDING_HR requests
        managerActionBy: { not: null }, // Must be approved by manager first
      };
      overtimeWhereClause = {
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
      leaveWhereClause = {
        user: { 
          approverId: user.id,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_MANAGER", // Managers only see PENDING_MANAGER requests
      };
      overtimeWhereClause = {
        user: { 
          approverId: user.id,
          employeeId: {
            notIn: ["T-123", "admin"]
          }
        },
        status: "PENDING_MANAGER", // Managers only see PENDING_MANAGER requests
      };
    }
    
    const [pendingLeaveRequests, pendingOvertimeRequests] = await Promise.all([
      // Pending leave requests assigned to this user
      prisma.leaveRequest.findMany({
        where: leaveWhereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
          leaveType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
      
      // Pending overtime requests assigned to this user
      prisma.overtimeRequest.findMany({
        where: overtimeWhereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
    ]);

    return {
      leaveRequests: pendingLeaveRequests,
      overtimeRequests: pendingOvertimeRequests,
    };
  } catch (error) {
    console.error("Get pending approvals error:", error);
    return { leaveRequests: [], overtimeRequests: [] };
  }
}