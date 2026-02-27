"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { DepartmentApproverForm } from "./department-approver-form"
import { getDepartmentApprovers, deleteDepartmentApprover, toggleDepartmentApproverStatus } from "@/lib/actions/mrs-actions/department-approver-actions"
import { ApproverType } from "@prisma/client"
import { DepartmentApprover } from "@/types/department-approver-types"

interface DepartmentApproversClientProps {
  businessUnitId: string
}

export function DepartmentApproversClient({ businessUnitId }: DepartmentApproversClientProps) {
  const [approvers, setApprovers] = useState<DepartmentApprover[]>([])
  const [filteredApprovers, setFilteredApprovers] = useState<DepartmentApprover[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingApprover, setEditingApprover] = useState<DepartmentApprover | null>(null)

  const loadApprovers = async () => {
    setIsLoading(true)
    try {
      const data = await getDepartmentApprovers()
      // Filter by business unit
      const filteredData = data.filter(approver => 
        approver.department.businessUnit?.id === businessUnitId
      )
      setApprovers(filteredData)
      setFilteredApprovers(filteredData)
    } catch (error) {
      console.error("Error loading approvers:", error)
      toast.error("Failed to load department approvers")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadApprovers()
  }, [businessUnitId])

  useEffect(() => {
    const filtered = approvers.filter(approver =>
      approver.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approver.employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approver.department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approver.approverType.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredApprovers(filtered)
  }, [searchTerm, approvers])

  const handleDelete = async (approverId: string) => {
    try {
      const result = await deleteDepartmentApprover(approverId)
      if (result.success) {
        toast.success(result.message)
        loadApprovers()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error deleting approver:", error)
      toast.error("Failed to delete department approver")
    }
  }

  const handleToggleStatus = async (approverId: string) => {
    try {
      const result = await toggleDepartmentApproverStatus(approverId)
      if (result.success) {
        toast.success(result.message)
        loadApprovers()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error toggling approver status:", error)
      toast.error("Failed to update approver status")
    }
  }

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false)
    loadApprovers()
  }

  const handleEditSuccess = () => {
    setEditingApprover(null)
    loadApprovers()
  }

  const getApproverTypeBadge = (type: ApproverType) => {
    return (
      <Badge variant={type === "FINAL" ? "default" : "secondary"}>
        {type === "FINAL" ? "Final" : "Recommending"}
      </Badge>
    )
  }

  // Group approvers by employee and department to show multiple roles
  const groupedApprovers = filteredApprovers.reduce((acc, approver) => {
    const key = `${approver.employeeId}-${approver.departmentId}`
    if (!acc[key]) {
      acc[key] = {
        ...approver,
        approverTypes: [approver.approverType]
      }
    } else {
      acc[key].approverTypes.push(approver.approverType)
    }
    return acc
  }, {} as Record<string, DepartmentApprover & { approverTypes: ApproverType[] }>)

  const displayApprovers = Object.values(groupedApprovers)

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading department approvers...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search approvers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Approver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Department Approver</DialogTitle>
            </DialogHeader>
            <DepartmentApproverForm
              businessUnitId={businessUnitId}
              onSuccess={handleCreateSuccess}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Approvers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Approvers ({displayApprovers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {displayApprovers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Approver Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayApprovers.map((approver) => (
                    <TableRow key={`${approver.employeeId}-${approver.departmentId}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{approver.employee.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {approver.employee.employeeId} • {approver.employee.role}
                          </div>
                          {approver.employee.email && (
                            <div className="text-sm text-muted-foreground">
                              {approver.employee.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{approver.department.name}</div>
                          {approver.department.code && (
                            <div className="text-sm text-muted-foreground">
                              {approver.department.code}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {approver.approverTypes.map((type) => (
                            <div key={type}>
                              {getApproverTypeBadge(type)}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(approver.isActive)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(approver.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(approver.id)}
                            className="gap-2"
                          >
                            {approver.isActive ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingApprover(approver)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Department Approver</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this department approver? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(approver.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-6 w-6" />
                </div>
                <p className="font-medium">No department approvers found</p>
                <p className="text-sm">
                  {searchTerm ? "Try adjusting your search criteria" : "Click 'Add Approver' to get started"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingApprover && (
        <Dialog open={!!editingApprover} onOpenChange={() => setEditingApprover(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Department Approver</DialogTitle>
            </DialogHeader>
            <DepartmentApproverForm
              businessUnitId={businessUnitId}
              approver={editingApprover}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingApprover(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}