"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  tableName: string;
  recordId: string;
  action: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: params.tableName,
        recordId: params.recordId,
        action: params.action,
        oldValues: params.oldValues ?? undefined,
        newValues: params.newValues ?? undefined,
        userId: params.userId,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

/**
 * Log user login
 */
export async function logUserLogin(userId: string) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await createAuditLog({
      tableName: "users",
      recordId: userId,
      action: "LOGIN",
      userId: userId,
      ipAddress: ipAddress,
      userAgent: userAgent,
      newValues: {
        timestamp: new Date().toISOString(),
        event: "User logged in",
      },
    });
  } catch (error) {
    console.error("Error logging user login:", error);
  }
}

/**
 * Log user logout
 */
export async function logUserLogout(userId: string) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await createAuditLog({
      tableName: "users",
      recordId: userId,
      action: "LOGOUT",
      userId: userId,
      ipAddress: ipAddress,
      userAgent: userAgent,
      newValues: {
        timestamp: new Date().toISOString(),
        event: "User logged out",
      },
    });
  } catch (error) {
    console.error("Error logging user logout:", error);
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(params: {
  businessUnitId?: string;
  tableName?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  try {
    const {
      businessUnitId,
      tableName,
      action,
      userId,
      startDate,
      endDate,
      page = 1,
      pageSize = 50,
    } = params;

    interface WhereClause {
      tableName?: string;
      action?: string;
      userId?: string;
      timestamp?: {
        gte?: Date;
        lte?: Date;
      };
      employee?: {
        businessUnitId?: string;
      };
    }

    const where: WhereClause = {};

    if (tableName) {
      where.tableName = tableName;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // If businessUnitId is provided, filter by users in that business unit
    if (businessUnitId) {
      where.employee = {
        businessUnitId: businessUnitId,
      };
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              email: true,
              role: true,
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                },
              },
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext: page * pageSize < totalCount,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return {
      logs: [],
      pagination: {
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(userId: string, page = 1, pageSize = 50) {
  return getAuditLogs({ userId, page, pageSize });
}

/**
 * Get recent login/logout activity
 */
export async function getLoginActivity(params: {
  businessUnitId?: string;
  userId?: string;
  days?: number;
  page?: number;
  pageSize?: number;
}) {
  const { days = 30, ...rest } = params;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getAuditLogs({
    ...rest,
    action: undefined, // We'll filter for LOGIN and LOGOUT
    startDate,
  });
}
