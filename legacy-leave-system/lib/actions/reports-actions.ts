"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface LeaveReportData {
  id: string;
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
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  session: string;
  managerActionBy: string | null;
  managerActionAt: Date | null;
  managerComments: string | null;
  hrActionBy: string | null;
  hrActionAt: Date | null;
  hrComments: string | null;
  createdAt: Date;
  days: number;
}

export interface OvertimeReportData {
  id: string;
  user: {
    id: string;
    name: string;
    employeeId: string;
    department: {
      id: string;
      name: string;
    } | null;
  };
  startTime: Date;
  endTime: Date;
  reason: string;
  status: string;
  managerActionBy: string | null;
  managerActionAt: Date | null;
  managerComments: string | null;
  hrActionBy: string | null;
  hrActionAt: Date | null;
  hrComments: string | null;
  createdAt: Date;
  hours: number;
}

export interface EmployeeReportData {
  id: string;
  name: string;
  employeeId: string;
  department: {
    id: string;
    name: string;
  } | null;
  leaveBalances: {
    leaveType: {
      id: string;
      name: string;
    };
    allocatedDays: number;
    usedDays: number;
    remainingDays: number;
    year: number;
  }[];
}

export interface ReportsFilters {
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  leaveTypeId?: string;
  userId?: string;
  year?: number;
  page?: number;
  limit?: number;
}

// Get business unit name for reports (works for both ADMIN and HR)
export async function getBusinessUnitNameForReports(businessUnitId: string): Promise<string | null> {
  try {
    await checkReportsPermissions(businessUnitId);
    
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { name: true }
    });

    return businessUnit?.name || null;
  } catch (error) {
    console.error("Error fetching business unit name for reports:", error);
    return null;
  }
}

// Check if user has admin or HR permissions
async function checkReportsPermissions(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only admins and HR can access reports
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    throw new Error("Insufficient permissions to access reports");
  }
  
  return session.user;
}



export async function getLeaveReports(
  businessUnitId: string,
  filters: ReportsFilters = {}
): Promise<LeaveReportData[]> {
  try {
    await checkReportsPermissions(businessUnitId);
    
    // Default to a very wide date range to catch any approved requests
    const now = new Date();
    const startDate = filters.startDate || new Date(2020, 0, 1); // Start from 2020
    const endDate = filters.endDate || now;
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    
    const whereClause = {
      user: { 
        businessUnitId,
        ...(filters.departmentId && { deptId: filters.departmentId })
      },
      status: "APPROVED" as const, // Only approved requests
      managerActionBy: { not: null }, // Must be approved by manager
      hrActionBy: { not: null }, // Must be approved by HR
      startDate: {
        gte: startDate,
        lte: endDate
      },
      ...(filters.leaveTypeId && { leaveTypeId: filters.leaveTypeId }),
      ...(filters.userId && { userId: filters.userId })
    };

    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: whereClause
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    const leaveRequests = await prisma.leaveRequest.findMany({
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
                name: true
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
      },
      orderBy: [
        { startDate: 'desc' },
        { user: { name: 'asc' } }
      ],
      skip,
      take: limit
    });

    // Get approver names
    const approverIds = new Set<string>();
    leaveRequests.forEach(request => {
      if (request.managerActionBy) approverIds.add(request.managerActionBy);
      if (request.hrActionBy) approverIds.add(request.hrActionBy);
    });

    const approvers = await prisma.user.findMany({
      where: { id: { in: Array.from(approverIds) } },
      select: { id: true, name: true }
    });

    const approverMap = new Map(approvers.map(user => [user.id, user.name]));
    
    // Calculate days for each request
    const reports = leaveRequests.map(request => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      
      // Adjust for session type
      let days = daysDiff;
      if (request.session === 'MORNING' || request.session === 'AFTERNOON') {
        days = daysDiff * 0.5;
      }
      
      return {
        id: request.id,
        user: request.user,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
        status: request.status,
        session: request.session,
        managerActionBy: request.managerActionBy ? approverMap.get(request.managerActionBy) || request.managerActionBy : null,
        managerActionAt: request.managerActionAt,
        managerComments: request.managerComments,
        hrActionBy: request.hrActionBy ? approverMap.get(request.hrActionBy) || request.hrActionBy : null,
        hrActionAt: request.hrActionAt,
        hrComments: request.hrComments,
        createdAt: request.createdAt,
        days
      };
    });

    return reports;
  } catch (error) {
    console.error("Error fetching leave reports:", error);
    throw new Error("Failed to fetch leave reports");
  }
}



export async function getOvertimeReports(
  businessUnitId: string,
  filters: ReportsFilters = {}
): Promise<OvertimeReportData[]> {
  try {
    await checkReportsPermissions(businessUnitId);
    
    // Default to a very wide date range to catch any approved requests
    const now = new Date();
    const startDate = filters.startDate || new Date(2020, 0, 1); // Start from 2020
    // Set end date to future to catch all requests (including future dates like 2025)
    const endDate = filters.endDate || new Date(2030, 11, 31); // End at 2030 to catch future dates
    // Remove pagination for reports - we want to see ALL approved requests
    
    const whereClause = {
      user: { 
        businessUnitId,
        ...(filters.departmentId && { deptId: filters.departmentId })
      },
      status: "APPROVED" as const, // Only approved requests - if status is APPROVED, it should be in reports
      startTime: {
        gte: startDate,
        lte: endDate
      },
      ...(filters.userId && { userId: filters.userId })
    };

    // No pagination for reports - get all approved requests
    
    const overtimeRequests = await prisma.overtimeRequest.findMany({
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
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { startTime: 'desc' },
        { user: { name: 'asc' } }
      ]
    });

    // Get approver names
    const approverIds = new Set<string>();
    overtimeRequests.forEach(request => {
      if (request.managerActionBy) approverIds.add(request.managerActionBy);
      if (request.hrActionBy) approverIds.add(request.hrActionBy);
    });

    const approvers = await prisma.user.findMany({
      where: { id: { in: Array.from(approverIds) } },
      select: { id: true, name: true }
    });

    const approverMap = new Map(approvers.map(user => [user.id, user.name]));
    
    // Calculate hours for each request
    const reports = overtimeRequests.map(request => {
      const start = new Date(request.startTime);
      const end = new Date(request.endTime);
      const timeDiff = end.getTime() - start.getTime();
      const hours = Math.round((timeDiff / (1000 * 3600)) * 100) / 100; // Round to 2 decimal places
      
      return {
        id: request.id,
        user: request.user,
        startTime: request.startTime,
        endTime: request.endTime,
        reason: request.reason,
        status: request.status,
        managerActionBy: request.managerActionBy ? approverMap.get(request.managerActionBy) || request.managerActionBy : null,
        managerActionAt: request.managerActionAt,
        managerComments: request.managerComments,
        hrActionBy: request.hrActionBy ? approverMap.get(request.hrActionBy) || request.hrActionBy : null,
        hrActionAt: request.hrActionAt,
        hrComments: request.hrComments,
        createdAt: request.createdAt,
        hours
      };
    });

    return reports;
  } catch (error) {
    console.error("Error fetching overtime reports:", error);
    throw new Error("Failed to fetch overtime reports");
  }
}

export async function getEmployeeReports(
  businessUnitId: string,
  filters: ReportsFilters = {}
): Promise<EmployeeReportData[]> {
  try {
    await checkReportsPermissions(businessUnitId);
    
    const currentYear = filters.year || new Date().getFullYear();
    
    // Define allowed leave types for employee reports
    const allowedLeaveTypes = ['SICK', 'VACATION', 'MANDATORY', 'CTO'];
    
    const whereClause = {
      businessUnitId,
      ...(filters.departmentId && { deptId: filters.departmentId }),
      ...(filters.userId && { id: filters.userId })
    };
    
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        leaveBalances: {
          where: {
            year: currentYear,
            leaveType: {
              name: {
                in: allowedLeaveTypes.map(type => type)
              }
            }
          },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Filter users to only include those with matching leave types and calculate remaining days
    return users
      .filter(user => user.leaveBalances.some(balance => 
        allowedLeaveTypes.some(type => 
          balance.leaveType.name.toUpperCase().includes(type.toUpperCase())
        )
      ))
      .map(user => ({
        id: user.id,
        name: user.name,
        employeeId: user.employeeId,
        department: user.department,
        leaveBalances: user.leaveBalances
          .filter(balance => 
            allowedLeaveTypes.some(type => 
              balance.leaveType.name.toUpperCase().includes(type.toUpperCase())
            )
          )
          .map(balance => ({
            leaveType: balance.leaveType,
            allocatedDays: balance.allocatedDays,
            usedDays: balance.usedDays,
            remainingDays: balance.allocatedDays - balance.usedDays,
            year: balance.year
          }))
      }));
  } catch (error) {
    console.error("Error fetching employee reports:", error);
    throw new Error("Failed to fetch employee reports");
  }
}

// Helper function to get filter options
export async function getReportFilterOptions(businessUnitId: string) {
  try {
    await checkReportsPermissions(businessUnitId);
    
    const [departments, leaveTypes, users] = await Promise.all([
      prisma.department.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      }),
      
      prisma.leaveType.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      }),
      
      prisma.user.findMany({
        where: { businessUnitId },
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
    
    return {
      departments,
      leaveTypes,
      users
    };
  } catch (error) {
    console.error("Error fetching filter options:", error);
    throw new Error("Failed to fetch filter options");
  }
}