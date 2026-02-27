"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export interface CreateRoleData {
  name: string
  code: string
  description?: string
  isActive: boolean
  permissions: string[]
}

export async function createRole(data: CreateRoleData, businessUnitId: string) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user has admin or HR permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Check if role code already exists
    const existingRole = await prisma.role.findUnique({
      where: { code: data.code }
    })

    if (existingRole) {
      throw new Error("Role code already exists")
    }

    // Create the role
    const role = await prisma.role.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        isActive: data.isActive,
        permissions: data.permissions
      }
    })

    revalidatePath(`/${businessUnitId}/roles`)
    
    return { success: true, role }
  } catch (error) {
    console.error("Error creating role:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create role" 
    }
  }
}

export async function updateRole(roleId: string, data: CreateRoleData, businessUnitId: string) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user has admin or HR permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    })

    if (!existingRole) {
      throw new Error("Role not found")
    }

    // Check if role code already exists (excluding current role)
    if (data.code !== existingRole.code) {
      const codeExists = await prisma.role.findUnique({
        where: { code: data.code }
      })

      if (codeExists) {
        throw new Error("Role code already exists")
      }
    }

    // Update the role
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        isActive: data.isActive,
        permissions: data.permissions
      }
    })

    revalidatePath(`/${businessUnitId}/roles`)
    revalidatePath(`/${businessUnitId}/roles/${roleId}`)
    
    return { success: true, role }
  } catch (error) {
    console.error("Error updating role:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update role" 
    }
  }
}

export async function deleteRole(roleId: string, businessUnitId: string) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user has admin or HR permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            employees: true
          }
        }
      }
    })

    if (!existingRole) {
      throw new Error("Role not found")
    }

    // Check if role has assigned employees
    if (existingRole._count.employees > 0) {
      throw new Error("Cannot delete role with assigned employees")
    }

    // Delete the role
    await prisma.role.delete({
      where: { id: roleId }
    })

    revalidatePath(`/${businessUnitId}/roles`)
    
    return { success: true }
  } catch (error) {
    console.error("Error deleting role:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete role" 
    }
  }
}

export async function getRoleById(roleId: string) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user has admin or HR permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            employees: true
          }
        }
      }
    })

    if (!role) {
      throw new Error("Role not found")
    }

    return { success: true, role }
  } catch (error) {
    console.error("Error fetching role:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch role" 
    }
  }
}

export async function getAllRoles() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      throw new Error("Unauthorized")
    }

    // Check if user has admin or HR permissions
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      throw new Error("Insufficient permissions")
    }

    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    return roles
  } catch (error) {
    console.error("Error fetching roles:", error)
    return []
  }
}