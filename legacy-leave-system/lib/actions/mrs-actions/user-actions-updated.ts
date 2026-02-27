"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

// Validation schemas (updated to match your schema)
const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional(),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(UserRole),
  businessUnitId: z.string().min(1, "Business unit is required"),
  deptId: z.string().optional(),
  approverId: z.string().optional(),
  classification: z.string().optional(),
  position: z.string().optional(),
})

const UpdateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.string().email("Invalid email address").optional(),
  role: z.nativeEnum(UserRole),
  businessUnitId: z.string().min(1, "Business unit is required"),
  deptId: z.string().optional(),
  approverId: z.string().optional(),
  classification: z.string().optional(),
  position: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

export interface UserProfile {
  id: string
  name: string
  employeeId: string
  email: string | null
  role: UserRole
  businessUnitId: string | null
  deptId: string | null
  approverId: string | null
  classification: string | null
  position: string | null
  isActive: boolean | null
  createdAt: Date
  updatedAt: Date
  businessUnit: {
    id: string
    name: string
    code: string
  } | null
  department: {
    id: string
    name: string
  } | null
  approver: {
    id: string
    name: string
    employeeId: string
  } | null
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        businessUnitId: true,
        deptId: true,
        approverId: true,
        classification: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            employeeId: true,
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

    // Check if email is already taken by another user (if email is provided)
    if (validatedData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: session.user.id }
        }
      })

      if (existingUser) {
        return { success: false, message: "Email is already taken by another user" }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validatedData.name,
        email: validatedData.email || null,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
      }
    })

    revalidatePath("/profile")
    
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

    revalidatePath("/profile")
    
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

export async function getDepartments(businessUnitId?: string) {
  try {
    const whereClause: { businessUnitId?: string } = {}
    if (businessUnitId) {
      whereClause.businessUnitId = businessUnitId
    }

    const departments = await prisma.department.findMany({
      where: whereClause,
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
    const whereClause: { businessUnitId?: string } = {}
    if (businessUnitId) {
      whereClause.businessUnitId = businessUnitId
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        businessUnitId: true,
        deptId: true,
        classification: true,
        position: true,
        isActive: true,
        createdAt: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [
        { name: 'asc' }
      ]
    })

    return users
  } catch (error) {
    console.error("Error fetching users:", error)
    return []
  }
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission to create users (only ADMIN and HR)
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to create users" }
    }

    const validatedData = CreateUserSchema.parse(input)

    // Check if employeeId already exists
    const existingUserByEmployeeId = await prisma.user.findUnique({
      where: { employeeId: validatedData.employeeId }
    })

    if (existingUserByEmployeeId) {
      return { success: false, message: "Employee ID is already taken" }
    }

    // Check if email already exists (if provided)
    if (validatedData.email) {
      const existingUserByEmail = await prisma.user.findFirst({
        where: { email: validatedData.email }
      })

      if (existingUserByEmail) {
        return { success: false, message: "Email is already taken" }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name: validatedData.name,
        employeeId: validatedData.employeeId,
        email: validatedData.email || null,
        password: hashedPassword,
        role: validatedData.role,
        businessUnitId: validatedData.businessUnitId,
        deptId: validatedData.deptId || null,
        approverId: validatedData.approverId || null,
        position: validatedData.position || null,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        createdAt: true,
      }
    })

    revalidatePath("/admin/users")
    
    return {
      success: true,
      message: "User created successfully",
      data: newUser
    }
  } catch (error) {
    console.error("Error creating user:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to create user"
    }
  }
}

export async function updateUser(input: UpdateUserInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission to update users (only ADMIN and HR)
    if (!["ADMIN", "HR"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to update users" }
    }

    const validatedData = UpdateUserSchema.parse(input)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: validatedData.id }
    })

    if (!existingUser) {
      return { success: false, message: "User not found" }
    }

    // Check if employeeId is already taken by another user
    const employeeIdTaken = await prisma.user.findFirst({
      where: {
        employeeId: validatedData.employeeId,
        id: { not: validatedData.id }
      }
    })

    if (employeeIdTaken) {
      return { success: false, message: "Employee ID is already taken by another user" }
    }

    // Check if email is already taken by another user (if provided)
    if (validatedData.email) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: validatedData.id }
        }
      })

      if (emailTaken) {
        return { success: false, message: "Email is already taken by another user" }
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        employeeId: validatedData.employeeId,
        email: validatedData.email || null,
        role: validatedData.role,
        businessUnitId: validatedData.businessUnitId,
        deptId: validatedData.deptId || null,
        approverId: validatedData.approverId || null,
        position: validatedData.position || null,
        isActive: validatedData.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        updatedAt: true,
      }
    })

    revalidatePath("/admin/users")
    
    return {
      success: true,
      message: "User updated successfully",
      data: updatedUser
    }
  } catch (error) {
    console.error("Error updating user:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to update user"
    }
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission to delete users (only ADMIN)
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "You don't have permission to delete users" }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return { success: false, message: "User not found" }
    }

    // Prevent users from deleting themselves
    if (userId === session.user.id) {
      return { success: false, message: "You cannot delete your own account" }
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    })

    revalidatePath("/admin/users")
    
    return {
      success: true,
      message: "User deleted successfully"
    }
  } catch (error) {
    console.error("Error deleting user:", error)
    
    return {
      success: false,
      message: "Failed to delete user"
    }
  }
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        role: true,
        businessUnitId: true,
        deptId: true,
        approverId: true,
        classification: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            employeeId: true,
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

export async function getApproversByDepartment(departmentId: string) {
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
            employeeId: true,
            email: true,
            role: true,
          }
        }
      },
      orderBy: [
        { approverType: 'asc' }, // RECOMMENDING first, then FINAL
        { employee: { name: 'asc' } }
      ]
    })

    return departmentApprovers.map(da => ({
      ...da.employee,
      approverType: da.approverType
    }))
  } catch (error) {
    console.error("Error fetching approvers:", error)
    return []
  }
}

export async function getRecommendingApprovers(departmentId: string) {
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
            employeeId: true,
            email: true,
            role: true,
          }
        }
      },
      orderBy: [
        { employee: { name: 'asc' } }
      ]
    })

    return departmentApprovers.map(da => da.employee)
  } catch (error) {
    console.error("Error fetching recommending approvers:", error)
    return []
  }
}

export async function getFinalApprovers(departmentId: string) {
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
            employeeId: true,
            email: true,
            role: true,
          }
        }
      },
      orderBy: [
        { employee: { name: 'asc' } }
      ]
    })

    return departmentApprovers.map(da => da.employee)
  } catch (error) {
    console.error("Error fetching final approvers:", error)
    return []
  }
}