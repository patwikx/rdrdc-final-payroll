"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ArrowLeft, 
  User, 
  Save, 
  X,
  Shield,
  Users,
  Building
} from "lucide-react"
import { toast } from "sonner"
import { createUser } from "@/lib/actions/user-management-actions"
import { UserRole } from "@prisma/client"

interface CreateUserViewProps {
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  managers: {
    id: string
    name: string
    employeeId: string
    businessUnit?: string
  }[]
  businessUnits: {
    id: string
    name: string
  }[]
  departments: {
    id: string
    name: string
  }[]
  roles: {
    id: string
    name: string
    code: string
    isActive: boolean
  }[]
  isAdmin: boolean
}

export function CreateUserView({ 
  businessUnit,
  businessUnitId, 
  managers,
  businessUnits,
  departments,
  roles,
  isAdmin
}: CreateUserViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    employeeId: "",
    password: "",
    role: "USER" as UserRole,
    roleId: "",
    departmentId: "",
    approverId: "",
    businessUnitId: businessUnitId,
    isActive: true,
    isAcctg: false,
    isPurchaser: false,
    isRDHMRS: false
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    if (!formData.employeeId.trim()) {
      toast.error("Employee ID is required")
      return
    }

    if (!formData.password.trim()) {
      toast.error("Password is required")
      return
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (!formData.departmentId) {
      toast.error("Department is required")
      return
    }

    if (!formData.roleId) {
      toast.error("System Permissions is required")
      return
    }

    if (!formData.approverId) {
      toast.error("Manager/Approver is required")
      return
    }

    setIsLoading(true)

    try {
      const result = await createUser({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        employeeId: formData.employeeId.trim(),
        password: formData.password,
        role: formData.role,
        roleId: formData.roleId,
        departmentId: formData.departmentId,
        approverId: formData.approverId,
        businessUnitId: formData.businessUnitId,
        isActive: formData.isActive,
        isAcctg: formData.isAcctg,
        isPurchaser: formData.isPurchaser,
        isRDHMRS: formData.isRDHMRS
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("User created successfully")
      router.push(`/${businessUnitId}/admin/users`)
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(`/${businessUnitId}/admin/users`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Create New User</h1>
            <p className="text-xs text-muted-foreground">
              {businessUnit.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !formData.name.trim() || !formData.employeeId.trim() || !formData.password.trim() || !formData.departmentId || !formData.roleId || !formData.approverId}
            form="user-form"
          >
            <Save className="h-4 w-4 mr-1" />
            {isLoading ? "Creating..." : "Create User"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2">
          <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter full name"
                className="h-8"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="employeeId" className="text-sm">Employee ID <span className="text-red-500">*</span></Label>
              <Input
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                placeholder="Enter employee ID"
                className="h-8"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="isActive" className="text-sm">Status</Label>
              <div className="flex items-center justify-between h-8 px-3 border rounded-md">
                <span className="text-sm">{formData.isActive ? "Active" : "Inactive"}</span>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
              </div>
            </div>
          </div>
          
          {/* Special Permissions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="isAcctg" className="text-sm">Accounting Access</Label>
              <div className="flex items-center justify-between h-8 px-3 border rounded-md">
                <span className="text-sm">{formData.isAcctg ? "Has Access" : "No Access"}</span>
                <Switch
                  id="isAcctg"
                  checked={formData.isAcctg}
                  onCheckedChange={(checked) => handleInputChange('isAcctg', checked)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="isPurchaser" className="text-sm">Purchaser Access</Label>
              <div className="flex items-center justify-between h-8 px-3 border rounded-md">
                <span className="text-sm">{formData.isPurchaser ? "Has Access" : "No Access"}</span>
                <Switch
                  id="isPurchaser"
                  checked={formData.isPurchaser}
                  onCheckedChange={(checked) => handleInputChange('isPurchaser', checked)}
                />
              </div>
            </div>
                        <div className="space-y-1">
              <Label htmlFor="isRDHMRS" className="text-sm">RDH/MRS Access</Label>
              <div className="flex items-center justify-between h-8 px-3 border rounded-md">
                <span className="text-sm">{formData.isRDHMRS ? "Requires Budget Approval" : "No Budget Approval"}</span>
                <Switch
                  id="isRDHMRS"
                  checked={formData.isRDHMRS}
                  onCheckedChange={(checked) => handleInputChange('isRDHMRS', checked)}
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm">Password <span className="text-red-500">*</span></Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter password (min 6 characters)"
                className="h-8"
                minLength={6}
                required
              />
            </div>
          </div>
        </div>

        {/* Department and Business Unit */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Building className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Organization</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="department" className="text-sm">Department <span className="text-red-500">*</span></Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => handleInputChange('departmentId', value)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isAdmin && (
              <div className="space-y-1">
                <Label htmlFor="businessUnit" className="text-sm">Business Unit <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.businessUnitId}
                  onValueChange={(value) => handleInputChange('businessUnitId', value)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Select business unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Roles and Permissions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Roles & Permissions</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="role" className="text-sm">System Role <span className="text-red-500">*</span></Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="Select system role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MANAGER">Approver</SelectItem>
                  <SelectItem value="HR">PMD</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="systemPermissions" className="text-sm">System Permissions <span className="text-red-500">*</span></Label>
              <Select
                value={formData.roleId}
                onValueChange={(value) => handleInputChange('roleId', value)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="Select system permissions (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {roles.filter(role => role.isActive).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="manager" className="text-sm">Manager/Approver <span className="text-red-500">*</span></Label>
            <Select
              value={formData.approverId}
              onValueChange={(value) => handleInputChange('approverId', value)}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name} ({manager.employeeId})
                    {manager.businessUnit && (
                      <span className="text-muted-foreground ml-2">
                        - {manager.businessUnit}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

            {/* Summary */}
            <div className="p-3 bg-muted/20 rounded-md">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{formData.name || "Not specified"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Employee ID:</span>
                  <p className="font-medium">{formData.employeeId || "Not specified"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">System Role:</span>
                  <p className="font-medium">{formData.role}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p className="font-medium">{formData.isActive ? "Active" : "Inactive"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Accounting:</span>
                  <p className="font-medium">{formData.isAcctg ? "Yes" : "No"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Purchaser:</span>
                  <p className="font-medium">{formData.isPurchaser ? "Yes" : "No"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">RDH/MRS:</span>
                  <p className="font-medium">{formData.isRDHMRS ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Quick Guide */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium">Quick Guide</h2>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Required Fields</h3>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• Full Name</li>
                  <li>• Employee ID (must be unique)</li>
                  <li>• Password (minimum 6 characters)</li>
                  <li>• Department</li>
                  <li>• Business Unit (Admin only)</li>
                  <li>• System Role</li>
                  <li>• System Permissions</li>
                  <li>• Manager/Approver</li>
                </ul>
              </div>

              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">System Roles</h3>
                <ul className="space-y-1 text-green-800 dark:text-green-200">
                  <li><strong>Admin:</strong> Full system access</li>
                  <li><strong>HR:</strong> User & employee management</li>
                  <li><strong>Manager:</strong> Team management & approvals</li>
                  <li><strong>User:</strong> Basic system access</li>
                </ul>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-md border border-purple-200 dark:border-purple-800">
                <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-2">System Permissions</h3>
                <p className="text-purple-800 dark:text-purple-200 mb-2">
                  Optional additional permissions that provide granular access control beyond the basic system role.
                </p>
                <ul className="space-y-1 text-purple-800 dark:text-purple-200">
                  <li>• Asset management permissions</li>
                  <li>• Report generation access</li>
                  <li>• Advanced approval workflows</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}