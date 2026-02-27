// In "@/lib/auth-actions/auth-users.ts"

import { prisma } from "../prisma";
import type { Prisma, UserRole } from "@prisma/client";

// Define proper where conditions types
type UserWhereCondition = Prisma.UserWhereInput;

/**
 * Fetches a user by their unique employee ID.
 * This is equivalent to fetching by username in the original system.
 */
export const getUserByUsername = async (employeeId: string) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { employeeId },
      include: {
        businessUnit: true,
        department: true,
      }
    });
    return user;
  } catch {
    return null;
  }
};

/**
 * Fetches a user by their email address.
 * Useful for email-based authentication.
 */
export const getUserByEmail = async (email: string) => {
  try {
    const user = await prisma.user.findFirst({ 
      where: { email } 
    });
    return user;
  } catch {
    return null;
  }
};

/**
 * Fetches a user by their ID and includes all related data.
 * This includes business unit and department information.
 */
export const getUserById = async (id: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        businessUnit: true,
        department: true,
      },
    });
    return user;
  } catch {
    return null;
  }
};

/**
 * Fetches basic user information by ID.
 * Returns only essential fields without relations.
 */
export const getUserBasicInfo = async (id: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        email: true,
        name: true,
        role: true,
        classification: true,
      },
    });
    return user;
  } catch {
    return null;
  }
};

/**
 * Fetches a user's email by their ID.
 */
export const getUserEmailById = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  } catch {
    return null;
  }
};

/**
 * Fetches a user's name by their ID.
 */
export const getUserNameById = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  } catch {
    return null;
  }
};

/**
 * Fetches a user's employee ID by their database ID.
 * This replaces the old username functionality.
 */
export const getEmployeeIdById = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    return user?.employeeId ?? null;
  } catch {
    return null;
  }
};

/**
 * Gets all users in a specific business unit.
 * Useful for filtering and business unit-specific operations.
 */
export const getUsersByBusinessUnit = async (businessUnitId: string) => {
  try {
    const users = await prisma.user.findMany({
      where: { 
        businessUnitId,
      },
      include: {
        department: true,
      },
      orderBy: {
        name: 'asc'
      },
    });
    return users;
  } catch {
    return [];
  }
};

/**
 * Gets all users in a specific department.
 */
export const getUsersByDepartment = async (departmentId: string) => {
  try {
    const users = await prisma.user.findMany({
      where: { 
        deptId: departmentId,
      },
      include: {
        businessUnit: true,
      },
      orderBy: {
        name: 'asc'
      },
    });
    return users;
  } catch {
    return [];
  }
};

/**
 * Gets all users with a specific role.
 * Useful for finding all managers, HR staff, etc.
 */
export const getUsersByRole = async (role: UserRole) => {
  try {
    const users = await prisma.user.findMany({
      where: { 
        role,
      },
      include: {
        businessUnit: true,
        department: true,
      },
      orderBy: {
        name: 'asc'
      },
    });
    return users;
  } catch {
    return [];
  }
};

/**
 * Checks if a user has a specific role.
 * Simple role-based authorization check.
 */
export const userHasRole = async (
  userId: string, 
  role: UserRole
): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
      },
    });
    return user?.role === role;
  } catch {
    return false;
  }
};

/**
 * Checks if a user belongs to a specific business unit.
 * Useful for business unit-based authorization.
 */
export const userBelongsToBusinessUnit = async (
  userId: string, 
  businessUnitId: string
): Promise<boolean> => {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        id: userId,
        businessUnitId,
      },
    });
    return !!user;
  } catch {
    return false;
  }
};

/**
 * Checks if a user belongs to a specific department.
 */
export const userBelongsToDepartment = async (
  userId: string, 
  departmentId: string
): Promise<boolean> => {
  try {
    const user = await prisma.user.findFirst({
      where: { 
        id: userId,
        deptId: departmentId,
      },
    });
    return !!user;
  } catch {
    return false;
  }
};

/**
 * Gets users who are managers (can approve requests).
 * Filters by MANAGER, HR, or ADMIN roles.
 */
export const getManagerUsers = async (businessUnitId?: string) => {
  try {
    const whereCondition: UserWhereCondition = {
      role: {
        in: ['MANAGER', 'HR', 'ADMIN'],
      }
    };

    if (businessUnitId) {
      whereCondition.businessUnitId = businessUnitId;
    }

    const managers = await prisma.user.findMany({
      where: whereCondition,
      include: {
        businessUnit: true,
        department: true,
      },
      orderBy: {
        name: 'asc'
      },
    });
    return managers;
  } catch {
    return [];
  }
};

/**
 * Checks if a user can approve leave/overtime requests.
 * Based on role (MANAGER, HR, or ADMIN).
 */
export const canApproveRequests = async (userId: string): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
      },
    });

    if (!user) return false;

    const approverRoles: UserRole[] = ['MANAGER', 'HR', 'ADMIN'];
    return approverRoles.includes(user.role);
  } catch {
    return false;
  }
};

/**
 * Gets users for dropdown/selection purposes.
 * Returns basic info suitable for UI components.
 */
export const getUsersForSelection = async (businessUnitId?: string) => {
  try {
    const whereCondition: UserWhereCondition = {};

    if (businessUnitId) {
      whereCondition.businessUnitId = businessUnitId;
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        employeeId: true,
        name: true,
        role: true,
        department: {
          select: {
            name: true,
          }
        },
      },
      orderBy: {
        name: 'asc'
      },
    });

    // Transform data for easier use in UI
    return users.map(user => ({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      department: user.department?.name ?? null,
    }));
  } catch {
    return [];
  }
};

/**
 * Gets a user's direct approver/manager.
 */
export const getUserApprover = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        approver: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            role: true,
          }
        },
      },
    });
    return user?.approver ?? null;
  } catch {
    return null;
  }
};

/**
 * Gets all direct reports for a manager.
 */
export const getDirectReports = async (managerId: string) => {
  try {
    const reports = await prisma.user.findMany({
      where: {
        approverId: managerId,
      },
      include: {
        businessUnit: true,
        department: true,
      },
      orderBy: {
        name: 'asc'
      },
    });
    return reports;
  } catch {
    return [];
  }
};