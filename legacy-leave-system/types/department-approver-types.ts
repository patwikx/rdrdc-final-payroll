import { ApproverType, UserRole } from "@prisma/client"

export interface DepartmentApproverEmployee {
  id: string
  name: string
  email: string | null
  employeeId: string
  role: UserRole
}

export interface DepartmentApproverDepartment {
  id: string
  name: string
  code: string | null
  businessUnitId: string | null
  businessUnit: {
    id: string
    name: string
    code: string
  } | null
}

export interface DepartmentApprover {
  id: string
  departmentId: string
  employeeId: string
  approverType: ApproverType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  employee: DepartmentApproverEmployee
  department: DepartmentApproverDepartment
}

export interface CreateDepartmentApproverInput {
  departmentId: string
  employeeId: string
  approverType: ApproverType
}

export interface UpdateDepartmentApproverInput {
  id: string
  departmentId: string
  employeeId: string
  approverType: ApproverType
  isActive: boolean
}