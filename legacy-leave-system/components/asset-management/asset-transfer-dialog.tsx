"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, ArrowRightLeft, User, Building, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  transferAssets, 
  getBusinessUnits, 
  getEmployeesByBusinessUnit, 
  getDepartmentsByBusinessUnit,
  TransferAssetsData 
} from "@/lib/actions/asset-transfer-actions"
import { DeployedAssetData } from "@/lib/actions/asset-return-actions"

interface AssetTransferDialogProps {
  assets: DeployedAssetData[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetTransferDialog({
  assets,
  businessUnitId,
  open,
  onOpenChange,
  onSuccess
}: AssetTransferDialogProps) {
  const [transferType, setTransferType] = useState<'EMPLOYEE' | 'BUSINESS_UNIT'>('EMPLOYEE')
  const [transferDate, setTransferDate] = useState<Date>(new Date())
  const [transferReason, setTransferReason] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  
  // Employee transfer fields
  const [toEmployeeId, setToEmployeeId] = useState("")
  
  // Business unit transfer fields
  const [toBusinessUnitId, setToBusinessUnitId] = useState("")
  const [toDepartmentId, setToDepartmentId] = useState("")
  
  // Data
  const [businessUnits, setBusinessUnits] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)

  // Load initial data
  useEffect(() => {
    if (open) {
      loadBusinessUnits()
      loadEmployees()
    }
  }, [open, businessUnitId])

  // Load departments when business unit changes
  useEffect(() => {
    if (toBusinessUnitId) {
      loadDepartments(toBusinessUnitId)
    }
  }, [toBusinessUnitId])

  const loadBusinessUnits = async () => {
    try {
      const units = await getBusinessUnits()
      setBusinessUnits(units)
    } catch (error) {
      console.error("Error loading business units:", error)
      toast.error("Failed to load business units")
    }
  }

  const loadEmployees = async () => {
    setIsLoadingEmployees(true)
    try {
      const employeeList = await getEmployeesByBusinessUnit(businessUnitId)
      // Filter out employees who already have the assets
      const currentEmployeeIds = new Set(assets.map(asset => asset.currentDeployment.employee.id))
      const availableEmployees = employeeList.filter(emp => !currentEmployeeIds.has(emp.id))
      setEmployees(availableEmployees)
    } catch (error) {
      console.error("Error loading employees:", error)
      toast.error("Failed to load employees")
    } finally {
      setIsLoadingEmployees(false)
    }
  }

  const loadDepartments = async (businessUnitId: string) => {
    setIsLoadingDepartments(true)
    try {
      const deptList = await getDepartmentsByBusinessUnit(businessUnitId)
      setDepartments(deptList)
    } catch (error) {
      console.error("Error loading departments:", error)
      toast.error("Failed to load departments")
    } finally {
      setIsLoadingDepartments(false)
    }
  }

  const handleSubmit = async () => {
    if (!transferReason.trim()) {
      toast.error("Transfer reason is required")
      return
    }

    if (transferType === 'EMPLOYEE' && !toEmployeeId) {
      toast.error("Please select a target employee")
      return
    }

    if (transferType === 'BUSINESS_UNIT' && !toBusinessUnitId) {
      toast.error("Please select a target business unit")
      return
    }

    setIsLoading(true)
    try {
      const transferData: TransferAssetsData = {
        assetIds: assets.map(asset => asset.id),
        transferType,
        fromBusinessUnitId: businessUnitId,
        toEmployeeId: transferType === 'EMPLOYEE' ? toEmployeeId : undefined,
        toBusinessUnitId: transferType === 'BUSINESS_UNIT' ? toBusinessUnitId : undefined,
        toDepartmentId: transferType === 'BUSINESS_UNIT' ? toDepartmentId : undefined,
        transferDate,
        transferReason,
        transferNotes
      }

      const result = await transferAssets(transferData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error transferring assets:", error)
      toast.error("Failed to transfer assets")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setTransferType('EMPLOYEE')
    setTransferDate(new Date())
    setTransferReason("")
    setTransferNotes("")
    setToEmployeeId("")
    setToBusinessUnitId("")
    setToDepartmentId("")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Assets
          </DialogTitle>
          <DialogDescription>
            Transfer {assets.length} selected asset{assets.length > 1 ? 's' : ''} to another employee or business unit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Assets Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Assets ({assets.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{asset.itemCode}</span>
                  <span className="text-muted-foreground truncate ml-2">{asset.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transfer Type */}
          <div className="space-y-2">
            <Label htmlFor="transfer-type">Transfer Type</Label>
            <Select value={transferType} onValueChange={(value: 'EMPLOYEE' | 'BUSINESS_UNIT') => setTransferType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Employee to Employee
                  </div>
                </SelectItem>
                <SelectItem value="BUSINESS_UNIT">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Business Unit Transfer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee Transfer Fields */}
          {transferType === 'EMPLOYEE' && (
            <div className="space-y-2">
              <Label htmlFor="to-employee">Transfer To Employee</Label>
              <Select value={toEmployeeId} onValueChange={setToEmployeeId} disabled={isLoadingEmployees}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingEmployees ? "Loading employees..." : "Select employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      <div className="flex flex-col">
                        <span>{employee.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ID: {employee.employeeId}
                          {employee.department && ` • ${employee.department.name}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Business Unit Transfer Fields */}
          {transferType === 'BUSINESS_UNIT' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="to-business-unit">Transfer To Business Unit</Label>
                <Select value={toBusinessUnitId} onValueChange={setToBusinessUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits
                      .filter(bu => bu.id !== businessUnitId) // Don't show current BU
                      .map((businessUnit) => (
                        <SelectItem key={businessUnit.id} value={businessUnit.id}>
                          <div className="flex flex-col">
                            <span>{businessUnit.name}</span>
                            <span className="text-xs text-muted-foreground">Code: {businessUnit.code}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {toBusinessUnitId && (
                <div className="space-y-2">
                  <Label htmlFor="to-department">Department (Optional)</Label>
                  <Select value={toDepartmentId} onValueChange={setToDepartmentId} disabled={isLoadingDepartments}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingDepartments ? "Loading departments..." : "Select department (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          <div className="flex flex-col">
                            <span>{department.name}</span>
                            {department.code && (
                              <span className="text-xs text-muted-foreground">Code: {department.code}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Transfer Date */}
          <div className="space-y-2">
            <Label>Transfer Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !transferDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {transferDate ? format(transferDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={transferDate}
                  onSelect={(date) => date && setTransferDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Transfer Reason */}
          <div className="space-y-2">
            <Label htmlFor="transfer-reason">Transfer Reason *</Label>
            <Input
              id="transfer-reason"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g., Employee relocation, Department restructuring, etc."
            />
          </div>

          {/* Transfer Notes */}
          <div className="space-y-2">
            <Label htmlFor="transfer-notes">Additional Notes (Optional)</Label>
            <Textarea
              id="transfer-notes"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="Any additional information about this transfer..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer Assets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}