"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

// Schema for creating business units
const CreateBusinessUnitSchema = z.object({
  name: z.string().min(1, "Business unit name is required"),
  code: z.string().min(1, "Business unit code is required"),
});

// Schema for assigning users to business units
const AssignUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  businessUnitId: z.string().min(1, "Business unit ID is required"),
});

// Check if user is admin
async function checkAdminAccess() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  
  if (session.user.role !== "ADMIN") {
    throw new Error("Access denied. Admin role required.");
  }
  
  return session.user;
}

// Create a new business unit
export async function createBusinessUnit(formData: FormData) {
  try {
    await checkAdminAccess();
    
    const validatedFields = CreateBusinessUnitSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
    });

    if (!validatedFields.success) {
      return { error: "Invalid fields!" };
    }

    const { name, code } = validatedFields.data;

    // Check if business unit with same name or code already exists
    const existingUnit = await prisma.businessUnit.findFirst({
      where: {
        OR: [
          { name },
          { code }
        ]
      }
    });

    if (existingUnit) {
      return { error: "Business unit with this name or code already exists!" };
    }

    await prisma.businessUnit.create({
      data: {
        name,
        code,
      },
    });

    revalidatePath("/admin/business-units");
    return { success: "Business unit created successfully!" };
  } catch (error) {
    console.error("Create business unit error:", error);
    return { error: "Failed to create business unit" };
  }
}

// Get all business units
export async function getBusinessUnits() {
  try {
    await checkAdminAccess();
    
    const businessUnits = await prisma.businessUnit.findMany({
      orderBy: { name: "asc" },
      include: {
        employees: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
          }
        }
      }
    });

    return businessUnits;
  } catch (error) {
    console.error("Get business units error:", error);
    return [];
  }
}

// Get users without business unit assignment
export async function getUnassignedUsers() {
  try {
    await checkAdminAccess();
    
    const users = await prisma.user.findMany({
      where: {
        businessUnitId: null,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        classification: true,
      },
      orderBy: { name: "asc" },
    });

    return users;
  } catch (error) {
    console.error("Get unassigned users error:", error);
    return [];
  }
}

// Assign user to business unit
export async function assignUserToBusinessUnit(formData: FormData) {
  try {
    await checkAdminAccess();
    
    const validatedFields = AssignUserSchema.safeParse({
      userId: formData.get("userId"),
      businessUnitId: formData.get("businessUnitId"),
    });

    if (!validatedFields.success) {
      return { error: "Invalid fields!" };
    }

    const { userId, businessUnitId } = validatedFields.data;

    // Verify business unit exists
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId }
    });

    if (!businessUnit) {
      return { error: "Business unit not found!" };
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return { error: "User not found!" };
    }

    // Assign user to business unit
    await prisma.user.update({
      where: { id: userId },
      data: { businessUnitId },
    });

    revalidatePath("/admin/business-units");
    revalidatePath("/[businessUnitId]/admin/business-units", "page");
    return { success: `User ${user.name} assigned to ${businessUnit.name} successfully!` };
  } catch (error) {
    console.error("Assign user error:", error);
    return { error: "Failed to assign user to business unit" };
  }
}

// Remove user from business unit
export async function removeUserFromBusinessUnit(userId: string) {
  try {
    await checkAdminAccess();
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { businessUnit: true }
    });

    if (!user) {
      return { error: "User not found!" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { businessUnitId: null },
    });

    revalidatePath("/admin/business-units");
    revalidatePath("/[businessUnitId]/admin/business-units", "page");
    return { success: `User ${user.name} removed from business unit successfully!` };
  } catch (error) {
    console.error("Remove user error:", error);
    return { error: "Failed to remove user from business unit" };
  }
}

// Get business unit by ID
export async function getBusinessUnitById(businessUnitId: string) {
  try {
    await checkAdminAccess();
    
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      include: {
        employees: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
          },
          orderBy: { name: "asc" },
        }
      }
    });

    return businessUnit;
  } catch (error) {
    console.error("Get business unit by ID error:", error);
    return null;
  }
}

// Update business unit
export async function updateBusinessUnit(
  businessUnitId: string,
  data: {
    name?: string;
    code?: string;
  }
): Promise<{ success?: string; error?: string }> {
  try {
    await checkAdminAccess();
    
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId }
    });

    if (!businessUnit) {
      return { error: "Business unit not found!" };
    }

    // Check for duplicate name or code if they're being updated
    if (data.name || data.code) {
      const existingUnit = await prisma.businessUnit.findFirst({
        where: {
          AND: [
            { id: { not: businessUnitId } },
            {
              OR: [
                ...(data.name ? [{ name: data.name }] : []),
                ...(data.code ? [{ code: data.code }] : []),
              ],
            },
          ],
        },
      });
      
      if (existingUnit) {
        if (data.name && existingUnit.name === data.name) {
          return { error: "Business unit name already exists!" };
        }
        if (data.code && existingUnit.code === data.code) {
          return { error: "Business unit code already exists!" };
        }
      }
    }

    await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
      },
    });

    revalidatePath("/admin/business-units");
    revalidatePath(`/admin/business-units/${businessUnitId}`);
    revalidatePath("/[businessUnitId]/admin/business-units", "page");
    revalidatePath(`/[businessUnitId]/admin/business-units/${businessUnitId}`, "page");
    return { success: "Business unit updated successfully!" };
  } catch (error) {
    console.error("Update business unit error:", error);
    return { error: "Failed to update business unit" };
  }
}

// Delete business unit (only if no users assigned)
export async function deleteBusinessUnit(businessUnitId: string) {
  try {
    await checkAdminAccess();
    
    const businessUnit = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      include: { employees: true }
    });

    if (!businessUnit) {
      return { error: "Business unit not found!" };
    }

    if (businessUnit.employees.length > 0) {
      return { error: "Cannot delete business unit with assigned employees!" };
    }

    await prisma.businessUnit.delete({
      where: { id: businessUnitId },
    });

    revalidatePath("/admin/business-units");
    revalidatePath("/[businessUnitId]/admin/business-units", "page");
    return { success: `Business unit ${businessUnit.name} deleted successfully!` };
  } catch (error) {
    console.error("Delete business unit error:", error);
    return { error: "Failed to delete business unit" };
  }
}