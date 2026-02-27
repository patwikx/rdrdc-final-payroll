"use server";

import { prisma } from "@/lib/prisma";

export interface LeaveBalance {
  id: string;
  leaveType: {
    id: string;
    name: string;
  };
  totalEntitlement: number;
  usedDays: number;
  remainingDays: number;
  year: number;
}

export interface LeaveBalanceWithHistory {
  id: string;
  leaveType: {
    id: string;
    name: string;
  };
  totalEntitlement: number;
  usedDays: number;
  remainingDays: number;
  year: number;
  recentRequests: {
    id: string;
    startDate: Date;
    endDate: Date;
    days: number;
    status: string;
    session: string;
  }[];
}

export async function getLeaveBalances(
  userId: string, 
  businessUnitId: string
): Promise<LeaveBalanceWithHistory[]> {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get user's leave balances for current year
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: {
        userId,
        year: currentYear,
        user: {
          businessUnitId
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
    });

    // Get recent leave requests for each leave type
    const balancesWithHistory = await Promise.all(
      leaveBalances.map(async (balance) => {
        const recentRequests = await prisma.leaveRequest.findMany({
          where: {
            userId,
            leaveTypeId: balance.leaveTypeId,
            startDate: {
              gte: new Date(currentYear, 0, 1), // Start of current year
              lte: new Date(currentYear, 11, 31) // End of current year
            }
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            session: true
          },
          orderBy: {
            startDate: 'desc'
          },
          take: 5 // Last 5 requests
        });

        // Calculate remaining days
        const remainingDays = balance.allocatedDays - balance.usedDays;

        return {
          id: balance.id,
          leaveType: balance.leaveType,
          totalEntitlement: balance.allocatedDays,
          usedDays: balance.usedDays,
          remainingDays,
          year: balance.year,
          recentRequests: recentRequests.map(req => {
            // Calculate days based on date range
            const timeDifference = req.endDate.getTime() - req.startDate.getTime();
            const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
            const sessionMultiplier = req.session === "FULL_DAY" ? 1 : 0.5;
            const calculatedDays = daysDifference * sessionMultiplier;

            return {
              id: req.id,
              startDate: req.startDate,
              endDate: req.endDate,
              days: calculatedDays,
              status: req.status,
              session: req.session
            };
          })
        };
      })
    );

    return balancesWithHistory;
  } catch (error) {
    console.error("Error fetching leave balances:", error);
    throw new Error("Failed to fetch leave balances");
  }
}

export async function getLeaveBalanceHistory(
  userId: string,
  leaveTypeId: string,
  year?: number
): Promise<{
  balance: LeaveBalance | null;
  requests: {
    id: string;
    startDate: Date;
    endDate: Date;
    days: number;
    status: string;
    session: string;
    reason: string;
  }[];
}> {
  try {
    const targetYear = year || new Date().getFullYear();
    
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        leaveTypeId,
        year: targetYear
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

    const requests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        leaveTypeId,
        startDate: {
          gte: new Date(targetYear, 0, 1),
          lte: new Date(targetYear, 11, 31)
        }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        session: true,
        reason: true
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Transform balance to match interface
    const transformedBalance = balance ? {
      id: balance.id,
      leaveType: balance.leaveType,
      totalEntitlement: balance.allocatedDays,
      usedDays: balance.usedDays,
      remainingDays: balance.allocatedDays - balance.usedDays,
      year: balance.year
    } : null;

    return {
      balance: transformedBalance,
      requests: requests.map(req => {
        // Calculate days based on date range
        const timeDifference = req.endDate.getTime() - req.startDate.getTime();
        const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
        const sessionMultiplier = req.session === "FULL_DAY" ? 1 : 0.5;
        const calculatedDays = daysDifference * sessionMultiplier;

        return {
          id: req.id,
          startDate: req.startDate,
          endDate: req.endDate,
          days: calculatedDays,
          status: req.status,
          session: req.session,
          reason: req.reason
        };
      })
    };
  } catch (error) {
    console.error("Error fetching leave balance history:", error);
    throw new Error("Failed to fetch leave balance history");
  }
}