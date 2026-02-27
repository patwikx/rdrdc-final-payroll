export interface BusinessUnit {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BusinessUnitWithCounts extends BusinessUnit {
  _count: {
    departments: number
    requests: number
  }
}

export interface BusinessUnitWithDepartments extends BusinessUnit {
  departments: Department[]
  _count: {
    departments: number
    requests: number
  }
}

export interface Department {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export interface CreateBusinessUnitRequest {
  code: string
  name: string
  description?: string
}

export interface UpdateBusinessUnitRequest {
  code?: string
  name?: string
  description?: string
  isActive?: boolean
}