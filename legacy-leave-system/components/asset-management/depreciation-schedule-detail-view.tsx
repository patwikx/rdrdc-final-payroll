"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  Edit,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Settings,
  Users,
  DollarSign,
  Package,
  Filter
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { 
  toggleScheduleStatus, 
  deleteDepreciationSchedule,
  updateDepreciationSchedule,
  getScheduleCategories,
  UpdateScheduleInput
} from "@/lib/actions/depreciation-schedule-actions"

interface ScheduleDetails {
  id: string
  name: string
  description?: string
  scheduleType: string
  executionDay: number
  isActive: boolean
  includeCategories: string[]
  excludeCategories: string[]
  createdAt: Date
  updatedAt: Date
  creator: {
    id: string
    name: string
    email?: string
  }
  executions: Array<{
    id: string
    executionDate: Date
    scheduledDate: Date
    status: string
    totalAssetsProcessed: number
    successfulCalculations: number
    failedCalculations: number
    totalDepreciationAmount: number
    executionDurationMs?: number
    errorMessage?: string
    executor?: {
      id: string
      name: string
      email?: string
    }
    assetCount: number
  }>
  _count: {
    executions: number
  }
  categories: Record<string, string>
  affectedAssetsCount: number
  totalAssetValue: number
}

interface DepreciationScheduleDetailViewProps {
  scheduleDetails: ScheduleDetails
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  categories: Array<{ id: string; name: string; count: number }>
}

export function DepreciationScheduleDetailView({
  scheduleDetails,
  businessUnit,
  businessUnitId,
  categories
}: DepreciationScheduleDetailViewProps) {
  const router = useRouter()
  const [isToggling, setIsToggling] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<UpdateScheduleInput>({
    defaultValues: {
      id: scheduleDetails.id,
      name: scheduleDetails.name,
      description: scheduleDetails.description || "",
      scheduleType: scheduleDetails.scheduleType as "MONTHLY" | "QUARTERLY" | "ANNUALLY",
      executionDay: scheduleDetails.executionDay,
      includeCategories: scheduleDetails.includeCategories,
      excludeCategories: scheduleDetails.excludeCategories,
      isActive: scheduleDetails.isActive
    }
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'FAILED':
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'RUNNING':
        return <Badge variant="secondary" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>
      case 'PENDING':
        return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'CANCELLED':
        return <Badge variant="secondary" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const getScheduleTypeLabel = (type: string) => {
    switch (type) {
      case 'MONTHLY':
        return 'Monthly'
      case 'QUARTERLY':
        return 'Quarterly'
      case 'ANNUALLY':
        return 'Annually'
      default:
        return type
    }
  }

  const handleToggleStatus = async () => {
    setIsToggling(true)
    try {
      const result = await toggleScheduleStatus(
        businessUnitId,
        scheduleDetails.id,
        !scheduleDetails.isActive
      )
      
      if (result.success) {
        toast.success(`Schedule ${scheduleDetails.isActive ? 'deactivated' : 'activated'} successfully`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update schedule status")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the schedule "${scheduleDetails.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteDepreciationSchedule(businessUnitId, scheduleDetails.id)
      
      if (result.success) {
        toast.success("Schedule deleted successfully")
        router.push(`/${businessUnitId}/asset-management/depreciation/schedules`)
      } else {
        toast.error(result.error || "Failed to delete schedule")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async (data: UpdateScheduleInput) => {
    setIsSaving(true)
    try {
      const result = await updateDepreciationSchedule(businessUnitId, data)
      
      if (result.success) {
        toast.success("Schedule updated successfully")
        setIsEditing(false)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update schedule")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    form.reset()
    setIsEditing(false)
  }

  const handleCategoryToggle = (categoryId: string, type: 'include' | 'exclude') => {
    const currentInclude = form.getValues('includeCategories')
    const currentExclude = form.getValues('excludeCategories')
    
    if (type === 'include') {
      const newInclude = currentInclude.includes(categoryId)
        ? currentInclude.filter(id => id !== categoryId)
        : [...currentInclude, categoryId]
      
      const newExclude = currentExclude.filter(id => id !== categoryId)
      
      form.setValue('includeCategories', newInclude)
      form.setValue('excludeCategories', newExclude)
    } else {
      const newExclude = currentExclude.includes(categoryId)
        ? currentExclude.filter(id => id !== categoryId)
        : [...currentExclude, categoryId]
      
      const newInclude = currentInclude.filter(id => id !== categoryId)
      
      form.setValue('excludeCategories', newExclude)
      form.setValue('includeCategories', newInclude)
    }
  }

  const getExecutionDayOptions = () => {
    const scheduleType = form.watch('scheduleType')
    switch (scheduleType) {
      case 'MONTHLY':
        return Array.from({ length: 31 }, (_, i) => i + 1)
      case 'QUARTERLY':
        return [15, 30, 31]
      case 'ANNUALLY':
        return [31]
      default:
        return [30]
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getNextExecutionDate = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    let nextExecution: Date
    
    switch (scheduleDetails.scheduleType) {
      case 'MONTHLY':
        if (today.getDate() <= scheduleDetails.executionDay) {
          nextExecution = new Date(currentYear, currentMonth, scheduleDetails.executionDay)
        } else {
          nextExecution = new Date(currentYear, currentMonth + 1, scheduleDetails.executionDay)
        }
        break
      case 'QUARTERLY':
        // Find next quarter end month (Mar, Jun, Sep, Dec)
        const quarterMonths = [2, 5, 8, 11] // Mar, Jun, Sep, Dec (0-indexed)
        const nextQuarterMonth = quarterMonths.find(month => 
          month > currentMonth || (month === currentMonth && today.getDate() <= scheduleDetails.executionDay)
        ) ?? quarterMonths[0]
        
        if (nextQuarterMonth > currentMonth) {
          nextExecution = new Date(currentYear, nextQuarterMonth, scheduleDetails.executionDay)
        } else {
          nextExecution = new Date(currentYear + 1, nextQuarterMonth, scheduleDetails.executionDay)
        }
        break
      case 'ANNUALLY':
        if (currentMonth < 11 || (currentMonth === 11 && today.getDate() <= scheduleDetails.executionDay)) {
          nextExecution = new Date(currentYear, 11, scheduleDetails.executionDay) // December
        } else {
          nextExecution = new Date(currentYear + 1, 11, scheduleDetails.executionDay)
        }
        break
      default:
        nextExecution = new Date()
    }
    
    return nextExecution
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{scheduleDetails.name}</h1>
            <p className="text-muted-foreground">
              {getScheduleTypeLabel(scheduleDetails.scheduleType)} depreciation schedule for {businessUnit.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={scheduleDetails.isActive ? "default" : "secondary"}>
            {scheduleDetails.isActive ? "Active" : "Inactive"}
          </Badge>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {isEditing ? 'Cancel Edit' : 'Edit Schedule'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleToggleStatus}
                disabled={isToggling}
              >
                {scheduleDetails.isActive ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Schedule
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Executions</p>
            <p className="text-2xl font-bold">{scheduleDetails._count.executions}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Affected Assets</p>
            <p className="text-2xl font-bold">{scheduleDetails.affectedAssetsCount}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Asset Value</p>
            <p className="text-2xl font-bold">{formatCurrency(scheduleDetails.totalAssetValue)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Next Execution</p>
            <p className="text-lg font-bold">
              {scheduleDetails.isActive ? format(getNextExecutionDate(), 'MMM dd, yyyy') : 'Inactive'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="executions">Execution History ({scheduleDetails.executions.length})</TabsTrigger>
          <TabsTrigger value="filters">Category Filters</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {isEditing ? (
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Edit Schedule</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Schedule Name *</Label>
                    <Input
                      id="name"
                      {...form.register('name', { required: 'Name is required' })}
                      placeholder="e.g., Monthly Depreciation - All Assets"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      placeholder="Optional description..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduleType">Schedule Type *</Label>
                      <Select
                        value={form.watch('scheduleType')}
                        onValueChange={(value: "MONTHLY" | "QUARTERLY" | "ANNUALLY") => {
                          form.setValue('scheduleType', value)
                          form.setValue('executionDay', value === 'ANNUALLY' ? 31 : 30)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                          <SelectItem value="ANNUALLY">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="executionDay">Execution Day *</Label>
                      <Select
                        value={form.watch('executionDay').toString()}
                        onValueChange={(value) => form.setValue('executionDay', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getExecutionDayOptions().map(day => (
                            <SelectItem key={day} value={day.toString()}>
                              Day {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={form.watch('isActive')}
                      onCheckedChange={(checked) => form.setValue('isActive', checked)}
                    />
                    <Label htmlFor="isActive">Active (schedule will run automatically)</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Category Filters</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground">Include Categories</h5>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {categories.map(category => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`include-${category.id}`}
                              checked={form.watch('includeCategories').includes(category.id)}
                              onCheckedChange={() => handleCategoryToggle(category.id, 'include')}
                            />
                            <Label htmlFor={`include-${category.id}`} className="text-sm">
                              {category.name} ({category.count} assets)
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground">Exclude Categories</h5>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {categories.map(category => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`exclude-${category.id}`}
                              checked={form.watch('excludeCategories').includes(category.id)}
                              onCheckedChange={() => handleCategoryToggle(category.id, 'exclude')}
                            />
                            <Label htmlFor={`exclude-${category.id}`} className="text-sm">
                              {category.name} ({category.count} assets)
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Schedule Configuration</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule Type</p>
                    <Badge variant="outline">{getScheduleTypeLabel(scheduleDetails.scheduleType)}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Execution Day</p>
                    <p className="font-medium">Day {scheduleDetails.executionDay}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{scheduleDetails.description || 'No description provided'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={scheduleDetails.isActive ? "default" : "secondary"}>
                      {scheduleDetails.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-sm">{format(new Date(scheduleDetails.createdAt), 'PPP')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Creator Information</h3>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{scheduleDetails.creator.name}</p>
                  {scheduleDetails.creator.email && (
                    <p className="text-sm text-muted-foreground">{scheduleDetails.creator.email}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-sm">{format(new Date(scheduleDetails.updatedAt), 'PPP')}</p>
                </div>

                {scheduleDetails.isActive && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Next Execution</p>
                        <p className="text-sm text-muted-foreground">
                          {format(getNextExecutionDate(), 'EEEE, MMMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Execution History</h2>
              <div className="text-sm text-muted-foreground">
                {scheduleDetails.executions.length} of {scheduleDetails._count.executions} recent executions
              </div>
            </div>
            
            {scheduleDetails.executions.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No executions yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This schedule hasn't been executed yet
                </p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Execution Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assets Processed</TableHead>
                      <TableHead>Successful</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleDetails.executions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {format(new Date(execution.executionDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(execution.executionDate), 'HH:mm:ss')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(execution.status)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{execution.totalAssetsProcessed}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{execution.successfulCalculations}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600 font-medium">{execution.failedCalculations}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{formatCurrency(execution.totalDepreciationAmount)}</span>
                        </TableCell>
                        <TableCell>
                          {execution.executionDurationMs ? (
                            <span className="text-sm">{execution.executionDurationMs}ms</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/history/${execution.id}`)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="filters" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Include Categories</h3>
              </div>
              
              {scheduleDetails.includeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specific categories included - all categories will be processed</p>
              ) : (
                <div className="space-y-2">
                  {scheduleDetails.includeCategories.map(categoryId => (
                    <Badge key={categoryId} variant="default">
                      {scheduleDetails.categories[categoryId] || categoryId}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Exclude Categories</h3>
              </div>
              
              {scheduleDetails.excludeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories excluded</p>
              ) : (
                <div className="space-y-2">
                  {scheduleDetails.excludeCategories.map(categoryId => (
                    <Badge key={categoryId} variant="destructive">
                      {scheduleDetails.categories[categoryId] || categoryId}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium">Assets Affected by This Schedule</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on the current category filters, this schedule will process{' '}
              <span className="font-medium">{scheduleDetails.affectedAssetsCount} assets</span> with a total book value of{' '}
              <span className="font-medium">{formatCurrency(scheduleDetails.totalAssetValue)}</span>.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}