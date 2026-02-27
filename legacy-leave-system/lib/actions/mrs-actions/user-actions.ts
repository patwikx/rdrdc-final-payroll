"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

// Validation schemas
const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})



export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>

export interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

interface Department {
  id: string
  name: string
  code: string | null
  businessUnit: {
    id: string
    name: string
    code: string
  } | null
}

export interface UserProfile {
  id: string
  name: string
  email: string | null
  employeeId: string
  role: UserRole
  deptId: string | null
  createdAt: Date
  updatedAt: Date
  department: Department | null
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            }
          }
        }
      }
    })

    return user
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return null
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const validatedData = UpdateProfileSchema.parse(input)

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        id: { not: session.user.id }
      }
    })

    if (existingUser) {
      return { success: false, message: "Email is already taken by another user" }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validatedData.name,
        email: validatedData.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
      }
    })

    revalidatePath("/settings/profile")
    
    return {
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to update profile"
    }
  }
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    const validatedData = ChangePasswordSchema.parse(input)

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        password: true,
      }
    })

    if (!user) {
      return { success: false, message: "User not found" }
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return { success: false, message: "Current password is incorrect" }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(validatedData.newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedNewPassword,
      }
    })

    revalidatePath("/settings/profile")
    
    return {
      success: true,
      message: "Password changed successfully"
    }
  } catch (error) {
    console.error("Error changing password:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to change password"
    }
  }
}

export async function getBusinessUnits() {
  try {
    const businessUnits = await prisma.businessUnit.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    return businessUnits
  } catch (error) {
    console.error("Error fetching business units:", error)
    return []
  }
}

export async function getDepartments() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        businessUnitId: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return departments
  } catch (error) {
    console.error("Error fetching departments:", error)
    return []
  }
}

export async function getUsers(businessUnitId?: string) {
  try {
    let whereClause = {}
    
    // If businessUnitId is provided, filter by business unit with exceptions for C-002 and L-005
    if (businessUnitId) {
      whereClause = {
        OR: [
          { businessUnitId: businessUnitId }, // Users from the specified business unit
          { employeeId: { in: ["C-002", "L-005"] } } // Always include these specific employees
        ]
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        deptId: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return users
  } catch (error) {
    console.error("Error fetching users:", error)
    return []
  }
}



export async function getUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            }
          }
        }
      }
    })

    return user
  } catch (error) {
    console.error("Error fetching user:", error)
    return null
  }
}

export async function getApproversByDepartment(departmentId: string, businessUnitId?: string) {
  try {
    const departmentApprovers = await prisma.departmentApprover.findMany({
      where: {
        departmentId: departmentId,
        isActive: true
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
            businessUnitId: true,
          }
        }
      },
      orderBy: [
        { approverType: 'asc' }, // FINAL first, then RECOMMENDING
        { employee: { name: 'asc' } }
      ]
    })

    let filteredApprovers = departmentApprovers

    // If businessUnitId is provided, filter by business unit with exceptions
    if (businessUnitId) {
      filteredApprovers = departmentApprovers.filter(da => 
        da.employee.businessUnitId === businessUnitId || 
        ["C-002", "L-005"].includes(da.employee.employeeId)
      )
    }

    return filteredApprovers.map(da => ({
      id: da.employee.id,
      name: da.employee.name,
      email: da.employee.email,
      employeeId: da.employee.employeeId,
      role: da.employee.role,
      approverType: da.approverType
    }))
  } catch (error) {
    console.error("Error fetching approvers:", error)
    return []
  }
}

export async function getRecommendingApprovers(departmentId: string, businessUnitId?: string) {
  try {
    const departmentApprovers = await prisma.departmentApprover.findMany({
      where: {
        departmentId: departmentId,
        approverType: "RECOMMENDING",
        isActive: true
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
            businessUnitId: true,
          }
        }
      },
      orderBy: {
        employee: { name: 'asc' }
      }
    })

    let filteredApprovers = departmentApprovers

    // If businessUnitId is provided, filter by business unit with exceptions
    if (businessUnitId) {
      filteredApprovers = departmentApprovers.filter(da => 
        da.employee.businessUnitId === businessUnitId || 
        ["C-002", "L-005"].includes(da.employee.employeeId)
      )
    }

    return filteredApprovers.map(da => ({
      id: da.employee.id,
      name: da.employee.name,
      email: da.employee.email,
      employeeId: da.employee.employeeId,
      role: da.employee.role,
    }))
  } catch (error) {
    console.error("Error fetching recommending approvers:", error)
    return []
  }
}

export async function getFinalApprovers(departmentId: string, businessUnitId?: string) {
  try {
    const departmentApprovers = await prisma.departmentApprover.findMany({
      where: {
        departmentId: departmentId,
        approverType: "FINAL",
        isActive: true
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
            businessUnitId: true,
          }
        }
      },
      orderBy: {
        employee: { name: 'asc' }
      }
    })

    let filteredApprovers = departmentApprovers

    // If businessUnitId is provided, filter by business unit with exceptions
    if (businessUnitId) {
      filteredApprovers = departmentApprovers.filter(da => 
        da.employee.businessUnitId === businessUnitId || 
        ["C-002", "L-005"].includes(da.employee.employeeId)
      )
    }

    return filteredApprovers.map(da => ({
      id: da.employee.id,
      name: da.employee.name,
      email: da.employee.email,
      employeeId: da.employee.employeeId,
      role: da.employee.role,
    }))
  } catch (error) {
    console.error("Error fetching final approvers:", error)
    return []
  }
}