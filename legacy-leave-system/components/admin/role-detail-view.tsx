"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { 
  ArrowLeft,
  Edit,
  Save,
  X,
  Shield,
  Users,
  Mail,
  Calendar,
  Building2,
  CheckCircle,
  XCircle,
  Package,
  Clock,
  FileText
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"
import { updateRole } from "@/lib/actions/role-actions"

interface User {
  id: string
  name: string
  email: string | null
  employeeId: string
  isActive: boolean | null
  createdAt: Date
  department: {
    id: string
    name: string
  } | null
}

interface Role {
  id: string
  name: string
  code: string
  description: string | null
  permissions: any
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface BusinessUnit {
  id: string
  name: string
  code: string
}

interface RoleDetailViewProps {
  role: Role
  users: User[]
  businessUnit: BusinessUnit
  businessUnitId: string
}

export function RoleDetailView({ role, users, businessUnit, businessUnitId }: RoleDetailViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: role.name,
    code: role.code,
    description: role.description || "",
    isActive: role.isActive,
    permissions: Array.isArray(role.permissions) ? role.permissions : []
  })

  // Define available permissions with categories (same as create-role-view)
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
      icon: Package,
      permissions: [
        { key: "mrs.view_own", label: "View Own Requests", description: "Can view own material requests" },
        { key: "mrs.create", label: "Create Requests", description: "Can submit material requests" },
        { key: "mrs.view_all", label: "View All Requests", description: "Can view all material requests" },
        { key: "mrs.approve", label: "Approve Requests", description: "Can approve or reject material requests" },
        { key: "mrs.coordinate", label: "MRS Coordination", description: "Can manage posted requests and acknowledgments" }
      ]
    },
    "Approvals": {
      icon: CheckCircle,
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
      icon: Shield,
      permissions: [
        { key: "admin.system_settings", label: "System Settings", description: "Can modify system-wide settings" },
        { key: "admin.business_units", label: "Manage Business Units", description: "Can create and manage business units" },
        { key: "admin.gl_accounts", label: "Manage GL Accounts", description: "Can manage general ledger accounts" },
        { key: "admin.roles", label: "Manage Roles", description: "Can create and manage user roles" },
        { key: "admin.departments", label: "Manage Departments", description: "Can create and manage departments" }
      ]
    }
  }

  const handleSave = async () => {
    startTransition(async () => {
      try {
        const result = await updateRole(role.id, {
          name: editData.name,
          code: editData.code,
          description: editData.description,
          isActive: editData.isActive,
          permissions: editData.permissions
        }, businessUnitId)

        if (result.success) {
          toast.success("Role updated successfully")
          setIsEditing(false)
          router.refresh()
        } else {
          toast.error(result.error || "Failed to update role")
        }
      } catch (error) {
        console.error("Error updating role:", error)
        toast.error("Failed to update role")
      }
    })
  }

  const handleCancel = () => {
    setEditData({
      name: role.name,
      code: role.code,
      description: role.description || "",
      isActive: role.isActive,
      permissions: Array.isArray(role.permissions) ? role.permissions : []
    })
    setIsEditing(false)
  }

  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    setEditData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionKey]
        : prev.permissions.filter(p => p !== permissionKey)
    }))
  }

  const handleSelectAllCategory = (categoryPermissions: any[], checked: boolean) => {
    setEditData(prev => {
      let newPermissions = [...prev.permissions]
      categoryPermissions.forEach(permission => {
        if (checked) {
          if (!newPermissions.includes(permission.key)) {
            newPermissions.push(permission.key)
          }
        } else {
          newPermissions = newPermissions.filter(p => p !== permission.key)
        }
      })
      return {
        ...prev,
        permissions: newPermissions
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6" />
              {role.name}
            </h1>
            <p className="text-muted-foreground">
              Role details and assigned users
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isPending}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                <Save className="h-4 w-4 mr-2" />
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Role
            </Button>
          )}
        </div>
      </div>

      {/* Role Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Role Information</h3>
          </div>
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name</Label>
                  <Input
                    id="name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Enter role name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">Role Code</Label>
                  <Input
                    id="code"
                    value={editData.code}
                    onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                    placeholder="Enter role code"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    placeholder="Enter role description"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Active Status</Label>
                  <Switch
                    id="isActive"
                    checked={editData.isActive}
                    onCheckedChange={(checked) => setEditData({ ...editData, isActive: checked })}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Role Name</Label>
                    <p className="text-lg font-semibold">{role.name}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Role Code</Label>
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{role.code}</p>
                  </div>
                  
                  {role.description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                      <p className="text-sm">{role.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {role.isActive ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium">Statistics</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {users.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {users.filter(user => user.isActive === true).length}
                </div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{format(new Date(role.createdAt), "MMM dd, yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{format(new Date(role.updatedAt), "MMM dd, yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Unit:</span>
                <span>{businessUnit.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Section - Full Width in Edit Mode */}
      {isEditing && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Permissions</Label>
            <Badge variant="outline" className="text-xs">
              {editData.permissions.length} selected
            </Badge>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => {
              const Icon = category.icon
              const categoryPermissions = category.permissions
              const selectedCount = categoryPermissions.filter(p => editData.permissions.includes(p.key)).length
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 pl-4">
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
                          checked={editData.permissions.includes(permission.key)}
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
      )}

      {/* Access Permissions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Access Permissions</h3>
        </div>
        <div>
          {!role.permissions || (Array.isArray(role.permissions) && role.permissions.length === 0) ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No permissions assigned to this role</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(role.permissions) && role.permissions.length > 0 ? (
                Object.entries(PERMISSION_CATEGORIES).map(([categoryName, category]) => {
                  const Icon = category.icon
                  const categoryPermissions = category.permissions.filter(p => 
                    role.permissions.includes(p.key)
                  )
                  
                  if (categoryPermissions.length === 0) return null

                  return (
                    <div key={categoryName} className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{categoryName}</span>
                        <Badge variant="outline" className="text-xs h-5">
                          {categoryPermissions.length}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-4">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.key} className="flex items-start gap-2 p-2 rounded border bg-green-50 dark:bg-green-950/30">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium block">
                                {permission.label}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <h4 className="font-medium mb-2">Permission Configuration</h4>
                    <pre className="text-xs text-muted-foreground overflow-auto">
                      {JSON.stringify(role.permissions, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assigned Users */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Assigned Users ({users.length})</h3>
        </div>
        <div>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users assigned to this role</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {user.employeeId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email || "No email"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {user.department?.name || "No department"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isActive === true ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : user.isActive === false ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unknown
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(user.createdAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}