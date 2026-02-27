"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Create a session record in the database
 */
export async function createSessionRecord(userId: string, sessionToken: string) {
  try {
    // Set expiration to 5 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Use upsert to handle duplicate sessionToken (shouldn't happen but just in case)
    await prisma.session.upsert({
      where: {
        sessionToken,
      },
      update: {
        expires: expiresAt,
      },
      create: {
        sessionToken,
        userId,
        expires: expiresAt,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating session record:", error);
    return { success: false };
  }
}

/**
 * Validate if a session is still active
 */
export async function validateSession(userId: string): Promise<boolean> {
  try {
    const session = await prisma.session.findFirst({
      where: {
        userId,
        expires: {
          gt: new Date(), // Session not expired
        },
      },
    });

    return !!session;
  } catch (error) {
    console.error("Error validating session:", error);
    return false;
  }
}

/**
 * Update session expiration (refresh on activity)
 */
export async function refreshSession(userId: string) {
  try {
    const newExpiration = new Date();
    newExpiration.setMinutes(newExpiration.getMinutes() + 5);

    await prisma.session.updateMany({
      where: {
        userId,
        expires: {
          gt: new Date(), // Only update active sessions
        },
      },
      data: {
        expires: newExpiration,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error refreshing session:", error);
    return { success: false };
  }
}

/**
 * Delete user sessions (force logout)
 */
export async function deleteUserSessions(userId: string) {
  try {
    await prisma.session.deleteMany({
      where: { userId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting sessions:", error);
    return { success: false };
  }
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    return { success: true, deletedCount: result.count };
  } catch (error) {
    console.error("Error cleaning up sessions:", error);
    return { success: false, deletedCount: 0 };
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string) {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expires: {
          gt: new Date(),
        },
      },
      orderBy: {
        expires: 'desc',
      },
    });

    return sessions;
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    return [];
  }
}

/**
 * Get all active sessions across the system
 */
export async function getAllActiveSessions(businessUnitId?: string) {
  try {
    const where = businessUnitId
      ? {
          expires: { gt: new Date() },
          user: { businessUnitId },
        }
      : {
          expires: { gt: new Date() },
        };

    const sessions = await prisma.session.findMany({
      where,
      include: {
        user: {
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
          },
        },
      },
      orderBy: {
        expires: 'desc',
      },
    });

    return sessions;
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    return [];
  }
}
