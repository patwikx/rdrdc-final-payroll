"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserCheck, Settings, X } from "lucide-react"
import { toast } from "sonner"
import { getDepartmentApprovers, deleteDepartmentApprover } from "@/lib/actions/mrs-actions/department-approver-actions"
import { ApproverType } from "@prisma/client"
import { DepartmentApproversDialog } from "@/components/departments/department-approvers-dialog"

interface User {
  id: string
  name: string
  email: string | null
  employeeId: string
  role: string
}

interface DepartmentApprover {
  id: string
  departmentId: string
  employeeId: string
  approverType: ApproverType
  isActive: boolean
  employee: User
}

interface DepartmentApproversCardProps {
  departmentId: string
  departmentName: string
  businessUnitId: string
}

export function DepartmentApproversCard({ 
  departmentId, 
  departmentName,
  businessUnitId
}: DepartmentApproversCardProps) {
  const [approvers, setApprovers] = useState<DepartmentApprover[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const loadApprovers = async () => {
    setIsLoading(true)
    try {
      const approversData = await getDepartmentApprovers(departmentId)
      setApprovers(approversData)
    } catch (error) {
      console.error("Error loading approvers:", error)
      toast.error("Failed to load approvers")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadApprovers()
  }, [departmentId])

  const handleRemoveApprover = async (approverId: string, approverName: string) => {
    try {
      const result = await deleteDepartmentApprover(approverId)
      if (result.success) {
        toast.success(`Removed ${approverName} as approver`)
        loadApprovers()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error removing approver:", error)
      toast.error("Failed to remove approver")
    }
  }

  const handleDialogSuccess = () => {
    setIsDialogOpen(false)
    loadApprovers()
  }

  // Get approvers by type
  const recommendingApprovers = approvers.filter(a => a.approverType === "RECOMMENDING")
  const finalApprovers = approvers.filter(a => a.approverType === "FINAL")

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading approvers...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Department Approvers
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Department Approvers</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Manage approvers for {departmentName} department
                </p>
              </DialogHeader>
              <DepartmentApproversDialog
                departmentId={departmentId}
                departmentName={departmentName}
                businessUnitId={businessUnitId}
                onSuccess={handleDialogSuccess}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommending Approvers */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Recommending Approvers ({recommendingApprovers.length})
            </Badge>
          </div>
          {recommendingApprovers.length > 0 ? (
            <div className="space-y-1">
              {recommendingApprovers.map((approver) => (
                <div key={approver.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{approver.employee.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {approver.employee.employeeId}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveApprover(approver.id, approver.employee.name)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No recommending approvers assigned</p>
          )}
        </div>

        {/* Final Approvers */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              Final Approvers ({finalApprovers.length})
            </Badge>
          </div>
          {finalApprovers.length > 0 ? (
            <div className="space-y-1">
              {finalApprovers.map((approver) => (
                <div key={approver.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{approver.employee.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {approver.employee.employeeId}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveApprover(approver.id, approver.employee.name)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No final approvers assigned</p>
          )}
        </div>

        {approvers.length === 0 && (
          <div className="text-center py-4">
            <UserCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No approvers assigned yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click the settings button to add approvers
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}