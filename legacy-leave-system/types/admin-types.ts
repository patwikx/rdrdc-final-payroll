export interface BusinessUnit {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Relations
  departments: SimpleDepartment[]
}

export interface SimpleDepartment {
  id: string
  code: string
  name: string
  description: string | null
  businessUnitId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  _count?: {
    users: number
    requests: number
    approvers: number
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
  _count?: {
    users: number
    requests: number
    approvers: number
  }
}

export interface CreateBusinessUnitFormData {
  code: string
  name: string
  description?: string
}

export interface UpdateBusinessUnitFormData {
  id: string
  code: string
  name: string
  description?: string
  isActive: boolean
}

export interface CreateDepartmentFormData {
  code: string
  name: string
  description?: string
  businessUnitId: string
}

export interface UpdateDepartmentFormData {
  id: string
  code: string
  name: string
  description?: string
  businessUnitId: string
  isActive: boolean
}