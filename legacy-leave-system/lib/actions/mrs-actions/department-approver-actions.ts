"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { z } from "zod"

// Validation schemas
const CreateDepartmentApproverSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  employeeId: z.string().min(1, "Employee is required"),
  approverType: z.enum(["RECOMMENDING", "FINAL"]),
})

const CreateMultipleDepartmentApproversSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  employeeId: z.string().min(1, "Employee is required"),
  approverTypes: z.array(z.enum(["RECOMMENDING", "FINAL"])).min(1, "At least one approver type is required"),
})

const UpdateDepartmentApproverSchema = z.object({
  id: z.string(),
  departmentId: z.string().min(1, "Department is required"),
  employeeId: z.string().min(1, "Employee is required"),
  approverType: z.enum(["RECOMMENDING", "FINAL"]),
  isActive: z.boolean(),
})

export type CreateDepartmentApproverInput = z.infer<typeof CreateDepartmentApproverSchema>
export type CreateMultipleDepartmentApproversInput = z.infer<typeof CreateMultipleDepartmentApproversSchema>
export type UpdateDepartmentApproverInput = z.infer<typeof UpdateDepartmentApproverSchema>

export interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

export async function getDepartmentApprovers(departmentId?: string) {
  try {
    const approvers = await prisma.departmentApprover.findMany({
      where: departmentId ? { departmentId } : {},
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          }
        },
        department: {
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
          }
        }
      },
      orderBy: [
        { department: { name: 'asc' } },
        { approverType: 'asc' },
        { employee: { name: 'asc' } }
      ]
    })

    return approvers
  } catch (error) {
    console.error("Error fetching department approvers:", error)
    return []
  }
}

export async function createMultipleDepartmentApprovers(input: CreateMultipleDepartmentApproversInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (only ADMIN and MANAGER)
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to create department approvers" }
    }

    const validatedData = CreateMultipleDepartmentApproversSchema.parse(input)

    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: validatedData.departmentId }
    })

    if (!department) {
      return { success: false, message: "Department not found" }
    }

    // Verify employee exists
    const employee = await prisma.user.findUnique({
      where: { id: validatedData.employeeId }
    })

    if (!employee) {
      return { success: false, message: "Employee not found" }
    }

    // Check which approver types already exist
    const existingApprovers = await prisma.departmentApprover.findMany({
      where: {
        departmentId: validatedData.departmentId,
        employeeId: validatedData.employeeId,
        approverType: { in: validatedData.approverTypes }
      }
    })

    // Filter out existing types
    const existingTypes = existingApprovers.map(a => a.approverType)
    const newTypes = validatedData.approverTypes.filter(type => !existingTypes.includes(type))

    if (newTypes.length === 0) {
      return { 
        success: false, 
        message: "This employee is already assigned as the selected approver type(s) for this department" 
      }
    }

    // Create new approvers for each type
    const newApprovers = await Promise.all(
      newTypes.map(type =>
        prisma.departmentApprover.create({
          data: {
            departmentId: validatedData.departmentId,
            employeeId: validatedData.employeeId,
            approverType: type,
            isActive: true,
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
                role: true,
              }
            },
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                businessUnitId: true,
              }
            }
          }
        })
      )
    )

    revalidatePath("/admin/department-approvers")
    
    const message = newTypes.length === 1 
      ? "Department approver created successfully"
      : `${newTypes.length} department approvers created successfully`
    
    return {
      success: true,
      message,
      data: newApprovers
    }
  } catch (error) {
    console.error("Error creating department approvers:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to create department approvers"
    }
  }
}

export async function createDepartmentApprover(input: CreateDepartmentApproverInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (only ADMIN and MANAGER)
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to create department approvers" }
    }

    const validatedData = CreateDepartmentApproverSchema.parse(input)

    // Check if the combination already exists
    const existingApprover = await prisma.departmentApprover.findFirst({
      where: {
        departmentId: validatedData.departmentId,
        employeeId: validatedData.employeeId,
        approverType: validatedData.approverType,
      }
    })

    if (existingApprover) {
      return { 
        success: false, 
        message: "This employee is already assigned as this type of approver for this department" 
      }
    }

    // Verify department exists
    const department = await prisma.department.findUnique({
      where: { id: validatedData.departmentId }
    })

    if (!department) {
      return { success: false, message: "Department not found" }
    }

    // Verify employee exists
    const employee = await prisma.user.findUnique({
      where: { id: validatedData.employeeId }
    })

    if (!employee) {
      return { success: false, message: "Employee not found" }
    }

    // Create department approver
    const newApprover = await prisma.departmentApprover.create({
      data: {
        departmentId: validatedData.departmentId,
        employeeId: validatedData.employeeId,
        approverType: validatedData.approverType,
        isActive: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnitId: true,
          }
        }
      }
    })

    revalidatePath("/admin/department-approvers")
    
    return {
      success: true,
      message: "Department approver created successfully",
      data: newApprover
    }
  } catch (error) {
    console.error("Error creating department approver:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to create department approver"
    }
  }
}

export async function updateDepartmentApprover(input: UpdateDepartmentApproverInput): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (only ADMIN and MANAGER)
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to update department approvers" }
    }

    const validatedData = UpdateDepartmentApproverSchema.parse(input)

    // Check if approver exists
    const existingApprover = await prisma.departmentApprover.findUnique({
      where: { id: validatedData.id }
    })

    if (!existingApprover) {
      return { success: false, message: "Department approver not found" }
    }

    // Check if the new combination already exists (excluding current record)
    const duplicateApprover = await prisma.departmentApprover.findFirst({
      where: {
        departmentId: validatedData.departmentId,
        employeeId: validatedData.employeeId,
        approverType: validatedData.approverType,
        id: { not: validatedData.id }
      }
    })

    if (duplicateApprover) {
      return { 
        success: false, 
        message: "This employee is already assigned as this type of approver for this department" 
      }
    }

    // Update department approver
    const updatedApprover = await prisma.departmentApprover.update({
      where: { id: validatedData.id },
      data: {
        departmentId: validatedData.departmentId,
        employeeId: validatedData.employeeId,
        approverType: validatedData.approverType,
        isActive: validatedData.isActive,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnitId: true,
          }
        }
      }
    })

    revalidatePath("/admin/department-approvers")
    
    return {
      success: true,
      message: "Department approver updated successfully",
      data: updatedApprover
    }
  } catch (error) {
    console.error("Error updating department approver:", error)
    
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        message: `Validation error: ${firstError.message}`
      }
    }

    return {
      success: false,
      message: "Failed to update department approver"
    }
  }
}

export async function deleteDepartmentApprover(approverId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (only ADMIN and MANAGER)
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to delete department approvers" }
    }

    // Check if approver exists
    const existingApprover = await prisma.departmentApprover.findUnique({
      where: { id: approverId }
    })

    if (!existingApprover) {
      return { success: false, message: "Department approver not found" }
    }

    // Delete department approver
    await prisma.departmentApprover.delete({
      where: { id: approverId }
    })

    revalidatePath("/admin/department-approvers")
    
    return {
      success: true,
      message: "Department approver deleted successfully"
    }
  } catch (error) {
    console.error("Error deleting department approver:", error)
    
    return {
      success: false,
      message: "Failed to delete department approver"
    }
  }
}

export async function toggleDepartmentApproverStatus(approverId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, message: "Unauthorized" }
    }

    // Check if user has permission (only ADMIN and MANAGER)
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return { success: false, message: "You don't have permission to modify department approvers" }
    }

    // Get current approver
    const existingApprover = await prisma.departmentApprover.findUnique({
      where: { id: approverId }
    })

    if (!existingApprover) {
      return { success: false, message: "Department approver not found" }
    }

    // Toggle status
    const updatedApprover = await prisma.departmentApprover.update({
      where: { id: approverId },
      data: {
        isActive: !existingApprover.isActive,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            businessUnitId: true,
          }
        }
      }
    })

    revalidatePath("/admin/department-approvers")
    
    return {
      success: true,
      message: `Department approver ${updatedApprover.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedApprover
    }
  } catch (error) {
    console.error("Error toggling department approver status:", error)
    
    return {
      success: false,
      message: "Failed to update department approver status"
    }
  }
}

export async function getDepartmentApproverById(approverId: string) {
  try {
    const approver = await prisma.departmentApprover.findUnique({
      where: { id: approverId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
          }
        },
        department: {
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
          }
        }
      }
    })

    return approver
  } catch (error) {
    console.error("Error fetching department approver:", error)
    return null
  }
}