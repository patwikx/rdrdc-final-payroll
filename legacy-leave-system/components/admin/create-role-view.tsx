"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Shield, 
  Save, 
  X,
  Users,
  Settings,
  Package,
  FileText,
  Calendar,
  Clock,
  CheckSquare,
  Truck
} from "lucide-react"
import { toast } from "sonner"
import { createRole } from "@/lib/actions/role-actions"

interface CreateRoleViewProps {
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
}

// Define available permissions with categories
const PERMISSION_CATEGORIES = {
  "User Management": {
    icon: Users,
    permissions: [
      { key: "users.view", label: "View Users", description: "Can view user profiles and information" },
      { key: "users.create", label: "Create Users", description: "Can create new user accounts" },
      { key: "users.edit", label: "Edit Users", description: "Can modify user information and settings" },
      { key: "users.delete", label: "Delete Users", description: "Can delete user accounts" },
      { key: "users.manage_roles", label: "Manage User Roles", description: "Can assign and modify user roles" }
    ]
  },
  "Asset Management": {
    icon: Package,
    permissions: [
      { key: "assets.view", label: "View Assets", description: "Can view asset information and details" },
      { key: "assets.create", label: "Create Assets", description: "Can add new assets to the system" },
      { key: "assets.edit", label: "Edit Assets", description: "Can modify asset information" },
      { key: "assets.delete", label: "Delete Assets", description: "Can remove assets from the system" },
      { key: "assets.deploy", label: "Deploy Assets", description: "Can deploy assets to employees" },
      { key: "assets.return", label: "Process Returns", description: "Can process asset returns" },
      { key: "assets.transfer", label: "Transfer Assets", description: "Can transfer assets between locations" },
      { key: "assets.retire", label: "Retire Assets", description: "Can retire assets from service" },
      { key: "assets.dispose", label: "Dispose Assets", description: "Can dispose of retired assets" },
      { key: "assets.depreciation", label: "Manage Depreciation", description: "Can calculate and manage asset depreciation" },
      { key: "assets.inventory", label: "Inventory Verification", description: "Can perform inventory verification cycles" }
    ]
  },
  "Leave Management": {
    icon: Calendar,
    permissions: [
      { key: "leave.view_own", label: "View Own Leave", description: "Can view own leave requests and balances" },
      { key: "leave.create", label: "Create Leave Requests", description: "Can submit leave requests" },
      { key: "leave.view_all", label: "View All Leave", description: "Can view all employee leave requests" },
      { key: "leave.approve", label: "Approve Leave", description: "Can approve or reject leave requests" },
      { key: "leave.manage_balances", label: "Manage Leave Balances", description: "Can modify employee leave balances" },
      { key: "leave.manage_types", label: "Manage Leave Types", description: "Can create and modify leave types" }
    ]
  },
  "Overtime Management": {
    icon: Clock,
    permissions: [
      { key: "overtime.view_own", label: "View Own Overtime", description: "Can view own overtime requests" },
      { key: "overtime.create", label: "Create Overtime Requests", description: "Can submit overtime requests" },
      { key: "overtime.view_all", label: "View All Overtime", description: "Can view all employee overtime requests" },
      { key: "overtime.approve", label: "Approve Overtime", description: "Can approve or reject overtime requests" }
    ]
  },
  "Material Requests": {
    icon: Truck,
    permissions: [
      { key: "mrs.view_own", label: "View Own Requests", description: "Can view own material requests" },
      { key: "mrs.create", label: "Create Requests", description: "Can submit material requests" },
      { key: "mrs.view_all", label: "View All Requests", description: "Can view all material requests" },
      { key: "mrs.approve", label: "Approve Requests", description: "Can approve or reject material requests" },
      { key: "mrs.coordinate", label: "MRS Coordination", description: "Can manage posted requests and acknowledgments" }
    ]
  },
  "Approvals": {
    icon: CheckSquare,
    permissions: [
      { key: "approvals.leave", label: "Leave Approvals", description: "Can approve leave requests" },
      { key: "approvals.overtime", label: "Overtime Approvals", description: "Can approve overtime requests" },
      { key: "approvals.material", label: "Material Request Approvals", description: "Can approve material requests" },
      { key: "approvals.asset", label: "Asset Approvals", description: "Can approve asset-related requests" }
    ]
  },
  "Reports": {
    icon: FileText,
    permissions: [
      { key: "reports.view", label: "View Reports", description: "Can view system reports" },
      { key: "reports.export", label: "Export Reports", description: "Can export reports to various formats" },
      { key: "reports.create", label: "Create Reports", description: "Can create custom reports" },
      { key: "reports.audit", label: "Audit Logs", description: "Can view system audit logs" }
    ]
  },
  "Administration": {
    icon: Settings,
    permissions: [
      { key: "admin.system_settings", label: "System Settings", description: "Can modify system-wide settings" },
      { key: "admin.business_units", label: "Manage Business Units", description: "Can create and manage business units" },
      { key: "admin.gl_accounts", label: "Manage GL Accounts", description: "Can manage general ledger accounts" },
      { key: "admin.roles", label: "Manage Roles", description: "Can create and manage user roles" },
      { key: "admin.departments", label: "Manage Departments", description: "Can create and manage departments" }
    ]
  }
}

export function CreateRoleView({ businessUnit, businessUnitId }: CreateRoleViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    isActive: true,
    permissions: new Set<string>()
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    const newPermissions = new Set(formData.permissions)
    if (checked) {
      newPermissions.add(permissionKey)
    } else {
      newPermissions.delete(permissionKey)
    }
    setFormData(prev => ({
      ...prev,
      permissions: newPermissions
    }))
  }

  const handleSelectAllCategory = (categoryPermissions: any[], checked: boolean) => {
    const newPermissions = new Set(formData.permissions)
    categoryPermissions.forEach(permission => {
      if (checked) {
        newPermissions.add(permission.key)
      } else {
        newPermissions.delete(permission.key)
      }
    })
    setFormData(prev => ({
      ...prev,
      permissions: newPermissions
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error("Role name is required")
      return
    }

    if (!formData.code.trim()) {
      toast.error("Role code is required")
      return
    }

    setIsLoading(true)

    try {
      const result = await createRole({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
        permissions: Array.from(formData.permissions)
      }, businessUnitId)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("Role created successfully")
      router.push(`/${businessUnitId}/admin/system-permissions`)
    } catch (error) {
      console.error('Error creating role:', error)
      toast.error(error instanceof Error ? error.message : "Failed to create role")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(`/${businessUnitId}/admin/system-permissions`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">Create New Role</h1>
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
            disabled={isLoading || !formData.name.trim() || !formData.code.trim()}
            form="role-form"
          >
            <Save className="h-4 w-4 mr-1" />
            {isLoading ? "Creating..." : "Create Role"}
          </Button>
        </div>
      </div>

      <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter role name"
                className="h-8"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code" className="text-sm">Role Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                placeholder="MANAGER"
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
          
          <div className="space-y-1">
            <Label htmlFor="description" className="text-sm">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter role description"
              className="min-h-[60px] resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Permissions</h2>
            <Badge variant="outline" className="text-xs">
              {formData.permissions.size} selected
            </Badge>
          </div>
          
          <div className="space-y-4">
            {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => {
              const Icon = category.icon
              const categoryPermissions = category.permissions
              const selectedCount = categoryPermissions.filter(p => formData.permissions.has(p.key)).length
              const allSelected = selectedCount === categoryPermissions.length

              return (
                <div key={categoryName} className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{categoryName}</span>
                      <Badge variant="outline" className="text-xs h-5">
                        {selectedCount}/{categoryPermissions.length}
                      </Badge>
                    </div>
                    <Switch
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAllCategory(categoryPermissions, checked)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-4">
                    {categoryPermissions.map((permission) => (
                      <div key={permission.key} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={permission.key}
                            className="text-xs font-medium cursor-pointer block truncate"
                            title={permission.label}
                          >
                            {permission.label}
                          </Label>
                        </div>
                        <Switch
                          id={permission.key}
                          checked={formData.permissions.has(permission.key)}
                          onCheckedChange={(checked) => 
                            handlePermissionToggle(permission.key, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 bg-muted/20 rounded-md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{formData.name || "Not specified"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Code:</span>
              <p className="font-medium">{formData.code || "Not specified"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium">{formData.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Permissions:</span>
              <p className="font-medium">{formData.permissions.size}</p>
            </div>
          </div>
        </div>


      </form>
    </div>
  )
}