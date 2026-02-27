import { ApproverType } from "@prisma/client"

export interface DepartmentApprover {
  id: string
  departmentId: string
  userId: string
  approverType: ApproverType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Relations
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  }
  department?: {
    id: string
    name: string
    code: string
    businessUnitId: string
    businessUnit: {
      id: string
      name: string
      code: string
    }
  }
}

export interface Department {
  id: string
  code: string
  name: string
  description: string | null
  businessUnitId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Relations
  businessUnit: {
    id: string
    name: string
    code: string
  }
  approvers: DepartmentApprover[]
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

export interface AssignApproverFormData {
  departmentId: string
  userId: string
  approverType: ApproverType
}

export const APPROVER_TYPE_LABELS: Record<ApproverType, string> = {
  RECOMMENDING: "Recommending Approver",
  FINAL: "Final Approver",
}

export const APPROVER_TYPE_COLORS: Record<ApproverType, string> = {
  RECOMMENDING: "bg-blue-100 text-blue-800",
  FINAL: "bg-green-100 text-green-800",
}