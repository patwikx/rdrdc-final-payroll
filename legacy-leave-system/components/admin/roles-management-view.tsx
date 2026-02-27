"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Plus,
  Shield,
  Users,
  Edit,
  Trash2,
  MoreHorizontal,
  Download,
  CheckSquare,
  X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface Role {
  id: string
  name: string
  code: string
  description: string | null
  permissions: any
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count: {
    employees: number
  }
}

interface RolesData {
  roles: Role[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface RolesManagementViewProps {
  rolesData: RolesData
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    search?: string
    page: number
  }
}

export function RolesManagementView({ 
  rolesData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: RolesManagementViewProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    
    router.push(`/${businessUnitId}/admin/system-permissions?${params.toString()}`)
  }

  const handleCreateNew = () => {
    router.push(`/${businessUnitId}/admin/system-permissions/create`)
  }

  const handleEditRole = (roleId: string) => {
    router.push(`/${businessUnitId}/admin/system-permissions/${roleId}/edit`)
  }

  const handleViewRole = (roleId: string) => {
    router.push(`/${businessUnitId}/admin/system-permissions/${roleId}`)
  }

  const handleSelectRole = (roleId: string, checked: boolean) => {
    const newSelected = new Set(selectedRoles)
    if (checked) {
      newSelected.add(roleId)
    } else {
      newSelected.delete(roleId)
    }
    setSelectedRoles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRoles.size === rolesData.roles.length) {
      setSelectedRoles(new Set())
    } else {
      setSelectedRoles(new Set(rolesData.roles.map(role => role.id)))
    }
  }

  const handleBulkExport = () => {
    console.log('Exporting roles:', Array.from(selectedRoles))
  }

  const handleBulkDelete = () => {
    console.log('Deleting roles:', Array.from(selectedRoles))
  }

  const handleDeleteRole = (roleId: string) => {
    console.log('Deleting role:', roleId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">System Permissions Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage user system permissions for {businessUnit.name}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {selectedRoles.size} selected
          </Badge>
          {selectedRoles.size > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedRoles(new Set())}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Role
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border rounded-md">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Total Roles</p>
              <p className="text-2xl font-bold">{rolesData.pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">Active Roles</p>
              <p className="text-2xl font-bold">
                {rolesData.roles.filter(role => role.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm font-medium">Inactive Roles</p>
              <p className="text-2xl font-bold">
                {rolesData.roles.filter(role => !role.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm font-medium">Total Assignments</p>
              <p className="text-2xl font-bold">
                {rolesData.roles.reduce((sum, role) => sum + role._count.employees, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
          {searchTerm !== (currentFilters.search || "") && (
            <Button
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
              onClick={handleSearch}
            >
              Search
            </Button>
          )}
        </div>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {rolesData.roles.length} of {rolesData.pagination.total} roles
        </div>
        {rolesData.roles.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectedRoles.size === rolesData.roles.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </div>

      {/* Roles Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Roles ({rolesData.roles.length})</h2>
        </div>
        
        {rolesData.roles.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No roles found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first role to get started
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 w-[50px]">
                        <Checkbox
                          checked={rolesData.roles.length > 0 && selectedRoles.size === rolesData.roles.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all roles"
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Role Name</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Employees</th>
                      <th className="text-left p-3 font-medium">Created Date</th>
                      <th className="text-left p-3 font-medium">Last Updated</th>
                      <th className="text-left p-3 w-[50px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesData.roles.map((role) => (
                      <tr 
                        key={role.id}
                        className={`border-b cursor-pointer hover:bg-muted/50 ${selectedRoles.has(role.id) ? 'bg-muted/50' : ''}`}
                        onClick={() => handleViewRole(role.id)}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedRoles.has(role.id)}
                            onCheckedChange={(checked) => handleSelectRole(role.id, checked === true)}
                            aria-label={`Select ${role.name}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{role.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="max-w-[300px]">
                            {role.description ? (
                              <span className="text-sm text-muted-foreground">
                                {role.description}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                No description
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={role.isActive ? "default" : "secondary"}>
                            {role.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{role._count.employees}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(role.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(role.updatedAt), 'MMM dd, yyyy')}
                          </span>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                         <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewRole(role.id)}>
                                <Shield className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditRole(role.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Role
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteRole(role.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Role
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {rolesData.roles.map((role) => (
                <div 
                  key={role.id}
                  className={`border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 ${selectedRoles.has(role.id) ? 'bg-muted/50 border-primary' : ''}`}
                  onClick={() => handleViewRole(role.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRoles.has(role.id)}
                        onCheckedChange={(checked) => handleSelectRole(role.id, checked === true)}
                        aria-label={`Select ${role.name}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div className="font-medium">{role.name}</div>
                        </div>
                        {role.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={role.isActive ? "default" : "secondary"}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewRole(role.id)}>
                            <Shield className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditRole(role.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRole(role.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{role._count.employees}</span>
                      <span className="text-muted-foreground">employees</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <div>
                      <div className="text-muted-foreground text-xs">Created</div>
                      <div>{format(new Date(role.createdAt), 'MMM dd, yyyy')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground text-xs">Updated</div>
                      <div>{format(new Date(role.updatedAt), 'MMM dd, yyyy')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {rolesData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {rolesData.pagination.page} of {rolesData.pagination.totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rolesData.pagination.page <= 1}
              onClick={() => {
                const params = new URLSearchParams()
                if (searchTerm) params.set('search', searchTerm)
                params.set('page', String(rolesData.pagination.page - 1))
                router.push(`/${businessUnitId}/admin/system-permissions?${params.toString()}`)
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={rolesData.pagination.page >= rolesData.pagination.totalPages}
              onClick={() => {
                const params = new URLSearchParams()
                if (searchTerm) params.set('search', searchTerm)
                params.set('page', String(rolesData.pagination.page + 1))
                router.push(`/${businessUnitId}/admin/system-permissions?${params.toString()}`)
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}