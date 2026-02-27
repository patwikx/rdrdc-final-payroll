"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

export interface UserWithDetails {
  id: string;
  name: string;
  email: string | null;
  employeeId: string;
  role: UserRole;
  roleId: string | null;
  isActive: boolean | null;
  terminateDate: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  isAcctg: boolean | null;
  isPurchaser: boolean | null;
  isRDHMRS: boolean | null;
  businessUnit: {
    id: string;
    name: string;
  } | null;
  approver: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  directReportsCount: number;
}

export interface UsersResponse {
  users: UserWithDetails[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  businessUnits: {
    id: string;
    name: string;
  }[];
  departments: {
    id: string;
    name: string;
  }[];
  managers: {
    id: string;
    name: string;
    employeeId: string;
    businessUnit?: string;
  }[];
}

export interface GetUsersParams {
  businessUnitId: string;
  role?: string;
  department?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Check if user has user management permissions
async function checkUserManagementPermissions(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only HR and admins can manage users
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    throw new Error("Insufficient permissions to manage users");
  }
  
  // Check business unit access for HR
  if (session.user.role === "HR") {
    if (!session.user.businessUnit?.id || session.user.businessUnit.id !== businessUnitId) {
      throw new Error("Access denied to this business unit");
    }
  }
  
  return session.user;
}

// Get users with filtering and pagination
export async function getUsers({
  businessUnitId,
  role,
  department,
  search,
  page = 1,
  limit = 10
}: GetUsersParams): Promise<UsersResponse> {
  try {
    await checkUserManagementPermissions(businessUnitId);
    
    // Build where clause
    let whereClause: {
      businessUnitId: string;
      employeeId: { notIn: string[] };
      role?: UserRole;
      departmentId?: string;
      OR?: Array<{
        name?: { contains: string; mode: "insensitive" };
        email?: { contains: string; mode: "insensitive" };
        employeeId?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      businessUnitId,
      employeeId: {
        notIn: ["T-123", "admin"]
      }
    };
    
    if (role && role !== "all-roles") {
      whereClause.role = role as UserRole;
    }
    
    if (department && department !== "all-departments") {
      whereClause.departmentId = department;
    }
    
    // Note: Assuming active status based on existing users for now
    // If there's an isActive field, uncomment the line below
    // if (status && status !== "all-status") {
    //   whereClause.isActive = status === "active";
    // }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: whereClause
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    
    // Fetch users, business units, departments, and managers in parallel
    const [users, businessUnits, departments, managers] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          // Note: We'll calculate direct reports count separately if needed
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      
      // Get all business units for filtering
      prisma.businessUnit.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),
      
      // Get all departments for filtering
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),
      
      // Get all managers across all business units
      getAllManagers(),
    ]);
    
    // Transform users to add direct reports count
    const transformedUsers = await Promise.all(
      users.map(async (user) => {
        const directReportsCount = await prisma.user.count({
          where: { approverId: user.id },
        });
        
        return {
          ...user,
          directReportsCount,
        };
      })
    );

    return {
      users: transformedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      businessUnits,
      departments,
      managers,
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

// Create a new user
export async function createUser(data: {
  name: string;
  email?: string;
  employeeId: string;
  password: string;
  role: UserRole;
  roleId?: string;
  businessUnitId: string;
  departmentId?: string;
  approverId?: string;
  isActive?: boolean;
  isAcctg?: boolean;
  isPurchaser?: boolean;
  isRDHMRS?: boolean;
}): Promise<{ success?: string; error?: string }> {
  try {
    await checkUserManagementPermissions(data.businessUnitId);
    
    // Check if employeeId already exists
    const existingUserByEmployeeId = await prisma.user.findFirst({
      where: { employeeId: data.employeeId },
    });
    
    if (existingUserByEmployeeId) {
      return { error: "Employee ID already exists" };
    }
    
    // Check if email already exists (only if email is provided)
    if (data.email && data.email.trim()) {
      const existingUserByEmail = await prisma.user.findFirst({
        where: { email: data.email },
      });
      
      if (existingUserByEmail) {
        return { error: "Email already exists" };
      }
    }
    
    // Validate password strength
    if (data.password.length < 6) {
      return { error: "Password must be at least 6 characters long" };
    }

    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    // Create the user
    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email && data.email.trim() ? data.email : null,
        employeeId: data.employeeId,
        role: data.role,
        roleId: data.roleId || null,
        businessUnitId: data.businessUnitId,
        approverId: data.approverId || null,
        password: hashedPassword,
        deptId: data.departmentId || null,
        isActive: data.isActive ?? true,
        isAcctg: data.isAcctg ?? false,
        isPurchaser: data.isPurchaser ?? false,
        isRDHMRS: data.isRDHMRS ?? false,
      },
    });
    
    // Revalidate the users page to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${data.businessUnitId}/admin/users`);
    revalidatePath(`/${data.businessUnitId}`);
    
    return { success: "User created successfully" };
  } catch (error) {
    console.error("Error creating user:", error);
    return { error: "Failed to create user" };
  }
}

// Update a user

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    email?: string;
    employeeId?: string;
    role?: UserRole;
    roleId?: string;
    departmentId?: string;
    approverId?: string;
    isActive?: boolean;
    terminateDate?: Date | null;
    isAcctg?: boolean;
    isPurchaser?: boolean;
    isRDHMRS?: boolean;
  }
): Promise<{ success?: string; error?: string }> {
  try {
    // Get the user to check business unit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { businessUnitId: true },
    });
    
    if (!user) {
      return { error: "User not found" };
    }
    
    if (!user.businessUnitId) {
      return { error: "User has no business unit assigned" };
    }
    
    await checkUserManagementPermissions(user.businessUnitId);
    
    // Check for duplicate email or employeeId if they're being updated
    if (data.email || data.employeeId) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                ...(data.email && data.email.trim() ? [{ email: data.email }] : []),
                ...(data.employeeId ? [{ employeeId: data.employeeId }] : []),
              ],
            },
          ],
        },
      });
      
      if (existingUser) {
        if (data.email && data.email.trim() && existingUser.email === data.email) {
          return { error: "Email already exists" };
        }
        if (existingUser.employeeId === data.employeeId) {
          return { error: "Employee ID already exists" };
        }
      }
    }
    
    // Update the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.employeeId && { employeeId: data.employeeId }),
        ...(data.role && { role: data.role }),
        ...(data.roleId !== undefined && { roleId: data.roleId || null }),
        ...(data.approverId !== undefined && { approverId: data.approverId || null }),
        ...(data.departmentId !== undefined && { deptId: data.departmentId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.terminateDate !== undefined && { terminateDate: data.terminateDate }),
        ...(data.isAcctg !== undefined && { isAcctg: data.isAcctg }),
        ...(data.isPurchaser !== undefined && { isPurchaser: data.isPurchaser }),
        ...(data.isRDHMRS !== undefined && { isRDHMRS: data.isRDHMRS }),
      },
    });
    
    // Revalidate the users page to refresh the data
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/${user.businessUnitId}/admin/users`);
    
    return { success: "User updated successfully" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { error: "Failed to update user" };
  }
}

// Note: Deactivate/Activate functions commented out until isActive field is confirmed
// Uncomment and modify these functions if your User model has an isActive field

// // Deactivate a user
// export async function deactivateUser(userId: string): Promise<{ success?: string; error?: string }> {
//   try {
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { businessUnitId: true, isActive: true },
//     });
    
//     if (!user) {
//       return { error: "User not found" };
//     }
    
//     if (!user.isActive) {
//       return { error: "User is already deactivated" };
//     }
    
//     await checkUserManagementPermissions(user.businessUnitId);
    
//     await prisma.user.update({
//       where: { id: userId },
//       data: { isActive: false },
//     });
    
//     return { success: "User deactivated successfully" };
//   } catch (error) {
//     console.error("Error deactivating user:", error);
//     return { error: "Failed to deactivate user" };
//   }
// }

// // Activate a user
// export async function activateUser(userId: string): Promise<{ success?: string; error?: string }> {
//   try {
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { businessUnitId: true, isActive: true },
//     });
    
//     if (!user) {
//       return { error: "User not found" };
//     }
    
//     if (user.isActive) {
//       return { error: "User is already active" };
//     }
    
//     await checkUserManagementPermissions(user.businessUnitId);
    
//     await prisma.user.update({
//       where: { id: userId },
//       data: { isActive: true },
//     });
    
//     return { success: "User activated successfully" };
//   } catch (error) {
//     console.error("Error activating user:", error);
//     return { error: "Failed to activate user" };
//   }
// }

// Get a single user by ID with full details
export async function getUserById(userId: string): Promise<UserWithDetails | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businessUnit: {
          select: {
            id: true,
            name: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Get direct reports count
    const directReportsCount = await prisma.user.count({
      where: { approverId: user.id },
    });

    return {
      ...user,
      directReportsCount,
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

// Reset user password
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success?: string; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { businessUnitId: true },
    });

    if (!user) {
      return { error: "User not found" };
    }

    if (!user.businessUnitId) {
      return { error: "User has no business unit assigned" };
    }

    await checkUserManagementPermissions(user.businessUnitId);

    // Validate password strength
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }

    // Hash the password before storing
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password with hashed version
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: "Password reset successfully" };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { error: "Failed to reset password" };
  }
}

// Update user business unit
export async function updateUserBusinessUnit(
  userId: string,
  newBusinessUnitId: string
): Promise<{ success?: string; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    // Only admins can change business units
    if (session.user.role !== "ADMIN") {
      return { error: "Only admins can change business units" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: "User not found" };
    }

    // Update business unit
    await prisma.user.update({
      where: { id: userId },
      data: { businessUnitId: newBusinessUnitId },
    });

    return { success: "Business unit updated successfully" };
  } catch (error) {
    console.error("Error updating business unit:", error);
    return { error: "Failed to update business unit" };
  }
}

// Get all business units for admin users
export async function getAllBusinessUnits(): Promise<{ id: string; name: string; }[]> {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== "ADMIN") {
      return [];
    }

    const businessUnits = await prisma.businessUnit.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return businessUnits;
  } catch (error) {
    console.error("Error fetching business units:", error);
    return [];
  }
}

// Get all managers/approvers across all business units
export async function getAllManagers(): Promise<{ id: string; name: string; employeeId: string; businessUnit?: string; }[]> {
  try {
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ["MANAGER", "ADMIN"],
        },
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      include: {
        businessUnit: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { businessUnit: { name: "asc" } },
        { name: "asc" },
      ],
    });

    return managers.map(manager => ({
      id: manager.id,
      name: manager.name,
      employeeId: manager.employeeId,
      businessUnit: manager.businessUnit?.name,
    }));
  } catch (error) {
    console.error("Error fetching managers:", error);
    return [];
  }
}

// Get managers for a specific business unit (kept for backward compatibility)
export async function getManagersForBusinessUnit(businessUnitId: string): Promise<{ id: string; name: string; employeeId: string; }[]> {
  try {
    const managers = await prisma.user.findMany({
      where: {
        businessUnitId,
        role: {
          in: ["MANAGER", "ADMIN"],
        },
        employeeId: {
          notIn: ["T-123", "admin"]
        }
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
      },
      orderBy: { name: "asc" },
    });

    return managers;
  } catch (error) {
    console.error("Error fetching managers:", error);
    return [];
  }
}

// Get all departments
export async function getAllDepartments(): Promise<{ id: string; name: string; }[]> {
  try {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}