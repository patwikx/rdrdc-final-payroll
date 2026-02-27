"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Settings,
  Plus,
  Play,
  Eye,
  AlertCircle
} from "lucide-react"
import { triggerDepreciationSchedules } from "@/lib/actions/depreciation-schedule-actions"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"


interface DepreciationSchedule {
  id: string
  name: string
  description?: string
  scheduleType: string
  executionDay: number
  isActive: boolean
  includeCategories: string[]
  excludeCategories: string[]
  createdAt: Date
  creator: { name: string }
  executions: Array<{
    id: string
    executionDate: Date
    status: string
    totalAssetsProcessed: number
    successfulCalculations: number
    totalDepreciationAmount: number
  }>
  _count: { executions: number }
}

interface DepreciationSchedulesViewProps {
  schedulesData: {
    schedules: DepreciationSchedule[]
    categories: Array<{ id: string; name: string; count: number }>
  }
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
}

export function DepreciationSchedulesView({
  schedulesData,
  businessUnit,
  businessUnitId
}: DepreciationSchedulesViewProps) {
  const router = useRouter()
  const [isTriggering, setIsTriggering] = useState(false)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'FAILED':
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'RUNNING':
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Running</Badge>
      case 'PENDING':
        return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
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

  const handleCreateSchedule = () => {
    router.push(`/${businessUnitId}/asset-management/depreciation/schedules/create`)
  }

  const handleTriggerSchedules = async () => {
    setIsTriggering(true)
    try {
      const result = await triggerDepreciationSchedules()
      
      if (result.success) {
        toast.success("Depreciation schedules triggered successfully!")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to trigger schedules")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Depreciation Schedules</h1>
            <p className="text-muted-foreground">
              Manage automated depreciation schedules for {businessUnit.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handleTriggerSchedules}
            disabled={isTriggering}
          >
            {isTriggering ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
          <Button onClick={handleCreateSchedule}>
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Schedules</p>
            <p className="text-2xl font-bold">{schedulesData.schedules.length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Play className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Active Schedules</p>
            <p className="text-2xl font-bold">{schedulesData.schedules.filter(s => s.isActive).length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Executions</p>
            <p className="text-2xl font-bold">
              {schedulesData.schedules.reduce((sum, s) => sum + s._count.executions, 0)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Recent Failures</p>
            <p className="text-2xl font-bold">
              {schedulesData.schedules.reduce((sum, s) => 
                sum + s.executions.filter(e => e.status === 'FAILED').length, 0
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Current Configuration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Current Configuration</span>
        </div>
        <div className="p-4 bg-muted/50 border rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Automated End-of-Month Depreciation</p>
              <p className="mt-1">
                The system automatically processes depreciation calculations at the end of each month. 
                This ensures consistent and timely depreciation processing without requiring manual intervention.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Schedule: Executes automatically on the last day of each month at 11:59 PM
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Configured Schedules</h2>
          <div className="text-sm text-muted-foreground">
            {schedulesData.schedules.length} schedules configured
          </div>
        </div>
        
        {schedulesData.schedules.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No depreciation schedules configured</p>
            <p className="text-sm text-muted-foreground mt-2">
              The system currently uses the default end-of-month automated processing
            </p>
            <Button className="mt-4" onClick={handleCreateSchedule}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Schedule
            </Button>
          </div>
        ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Schedule Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Execution Day</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Execution</TableHead>
                      <TableHead>Total Runs</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulesData.schedules.map((schedule) => {
                      const lastExecution = schedule.executions[0]
                      
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{schedule.name}</div>
                              {schedule.description && (
                                <div className="text-sm text-muted-foreground">
                                  {schedule.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getScheduleTypeLabel(schedule.scheduleType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">Day {schedule.executionDay}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={schedule.isActive ? "default" : "secondary"}>
                              {schedule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lastExecution ? (
                              <div className="space-y-1">
                                <div className="text-sm">
                                  {format(new Date(lastExecution.executionDate), 'MMM dd, yyyy')}
                                </div>
                                {getStatusBadge(lastExecution.status)}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{schedule._count.executions}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{schedule.creator.name}</span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/schedules/${schedule.id}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {schedulesData.schedules.map((schedule) => {
                  const lastExecution = schedule.executions[0]
                  
                  return (
                    <div key={schedule.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{schedule.name}</div>
                          {schedule.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {schedule.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {getScheduleTypeLabel(schedule.scheduleType)}
                            </Badge>
                            <Badge variant={schedule.isActive ? "default" : "secondary"} className="text-xs">
                              {schedule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Execution Day</div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>Day {schedule.executionDay}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Total Runs</div>
                          <div className="font-medium">{schedule._count.executions}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Created By</div>
                          <div>{schedule.creator.name}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Last Execution</div>
                          {lastExecution ? (
                            <div className="space-y-1">
                              <div className="text-xs">
                                {format(new Date(lastExecution.executionDate), 'MMM dd, yyyy')}
                              </div>
                              {getStatusBadge(lastExecution.status)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Never</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/schedules/${schedule.id}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
      </div>
    </div>
  )
}