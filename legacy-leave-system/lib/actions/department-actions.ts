"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";

// Check if user has department management permissions
async function checkDepartmentManagementPermissions() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  // Only HR and admins can manage departments
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    throw new Error("Insufficient permissions to manage departments");
  }
  
  return session.user;
}

// Get all departments with employee counts
export async function getDepartments() {
  try {
    await checkDepartmentManagementPermissions();
    
    const departments = await prisma.department.findMany({
      include: {
        members: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
          },
          orderBy: { name: "asc" },
        },
        managers: {
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

// Get department by ID
export async function getDepartmentById(departmentId: string) {
  try {
    await checkDepartmentManagementPermissions();
    
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
          },
          orderBy: { name: "asc" },
        },
        managers: {
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return department;
  } catch (error) {
    console.error("Error fetching department by ID:", error);
    return null;
  }
}

// Create a new department
export async function createDepartment(data: {
  name: string;
  businessUnitId: string;
}): Promise<{ success?: string; error?: string }> {
  try {
    await checkDepartmentManagementPermissions();
    
    // Check if department with same name already exists in this business unit
    const existingDepartment = await prisma.department.findFirst({
      where: { 
        name: data.name,
        businessUnitId: data.businessUnitId,
      },
    });
    
    if (existingDepartment) {
      return { error: "Department name already exists in this business unit" };
    }
    
    // Create the department
    await prisma.department.create({
      data: {
        name: data.name,
        businessUnitId: data.businessUnitId,
      },
    });
    
    // Revalidate the departments page
    revalidatePath("/[businessUnitId]/departments", "page");
    
    return { success: "Department created successfully" };
  } catch (error) {
    console.error("Error creating department:", error);
    return { error: "Failed to create department" };
  }
}

// Update a department
export async function updateDepartment(
  departmentId: string,
  data: {
    name?: string;
  }
): Promise<{ success?: string; error?: string }> {
  try {
    await checkDepartmentManagementPermissions();
    
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return { error: "Department not found" };
    }

    // Check for duplicate name if it's being updated
    if (data.name) {
      const existingDepartment = await prisma.department.findFirst({
        where: {
          AND: [
            { id: { not: departmentId } },
            { name: data.name },
          ],
        },
      });
      
      if (existingDepartment) {
        return { error: "Department name already exists" };
      }
    }

    await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(data.name && { name: data.name }),
      },
    });

    revalidatePath("/[businessUnitId]/departments", "page");
    revalidatePath(`/[businessUnitId]/departments/${departmentId}`, "page");
    return { success: "Department updated successfully" };
  } catch (error) {
    console.error("Error updating department:", error);
    return { error: "Failed to update department" };
  }
}

// Delete a department (only if no members assigned)
export async function deleteDepartment(departmentId: string): Promise<{ success?: string; error?: string }> {
  try {
    await checkDepartmentManagementPermissions();
    
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { 
        members: true,
        managers: true,
      },
    });

    if (!department) {
      return { error: "Department not found" };
    }

    if (department.members.length > 0) {
      return { error: "Cannot delete department with assigned members" };
    }

    // Delete department managers first, then the department
    await prisma.departmentManager.deleteMany({
      where: { departmentId },
    });

    await prisma.department.delete({
      where: { id: departmentId },
    });

    revalidatePath("/[businessUnitId]/departments", "page");
    return { success: `Department ${department.name} deleted successfully` };
  } catch (error) {
    console.error("Error deleting department:", error);
    return { error: "Failed to delete department" };
  }
}

// Assign manager to department
export async function assignManagerToDepartment(
  departmentId: string,
  managerId: string
): Promise<{ success?: string; error?: string }> {
  try {
    await checkDepartmentManagementPermissions();
    
    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return { error: "Department not found" };
    }

    // Verify manager exists and has appropriate role
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
    });

    if (!manager) {
      return { error: "Manager not found" };
    }

    const allowedRoles: UserRole[] = [UserRole.MANAGER, UserRole.HR, UserRole.ADMIN];
    if (!allowedRoles.includes(manager.role)) {
      return { error: "User must have Manager, HR, or Admin role to be assigned as department manager" };
    }

    // Check if already assigned
    const existingAssignment = await prisma.departmentManager.findFirst({
      where: {
        departmentId,
        managerId,
      },
    });

    if (existingAssignment) {
      return { error: "Manager is already assigned to this department" };
    }

    // Assign manager to department
    await prisma.departmentManager.create({
      data: {
        departmentId,
        managerId,
      },
    });

    revalidatePath("/[businessUnitId]/departments", "page");
    revalidatePath(`/[businessUnitId]/departments/${departmentId}`, "page");
    return { success: `${manager.name} assigned as department manager successfully` };
  } catch (error) {
    console.error("Error assigning manager to department:", error);
    return { error: "Failed to assign manager to department" };
  }
}

// Remove manager from department
export async function removeManagerFromDepartment(
  departmentId: string,
  managerId: string
): Promise<{ success?: string; error?: string }> {
  try {
    await checkDepartmentManagementPermissions();
    
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
    });

    if (!manager) {
      return { error: "Manager not found" };
    }

    await prisma.departmentManager.deleteMany({
      where: {
        departmentId,
        managerId,
      },
    });

    revalidatePath("/[businessUnitId]/departments", "page");
    revalidatePath(`/[businessUnitId]/departments/${departmentId}`, "page");
    return { success: `${manager.name} removed from department management successfully` };
  } catch (error) {
    console.error("Error removing manager from department:", error);
    return { error: "Failed to remove manager from department" };
  }
}

// Get available managers (users with MANAGER, HR, or ADMIN roles)
export async function getAvailableManagers(businessUnitId?: string): Promise<{
  id: string;
  name: string;
  employeeId: string;
  email: string | null;
  role: string;
  businessUnit: {
    name: string;
  } | null;
}[]> {
  try {
    await checkDepartmentManagementPermissions();
    
    const whereClause: {
      role: { in: UserRole[] };
      businessUnitId?: string;
    } = {
      role: {
        in: [UserRole.MANAGER, UserRole.HR, UserRole.ADMIN],
      },
    };

    // Filter by business unit if provided
    if (businessUnitId) {
      whereClause.businessUnitId = businessUnitId;
    }
    
    const managers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        businessUnit: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Map to ensure correct type structure
    return managers.map(manager => ({
      id: manager.id,
      name: manager.name,
      employeeId: manager.employeeId,
      email: manager.email,
      role: manager.role as string,
      businessUnit: manager.businessUnit,
    }));
  } catch (error) {
    console.error("Error fetching available managers:", error);
    return [];
  }
}