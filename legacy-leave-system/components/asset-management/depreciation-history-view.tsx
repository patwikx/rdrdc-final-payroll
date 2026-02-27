"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Eye,
  Filter,
  BarChart3,
  Users,
  DollarSign
} from "lucide-react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

interface DepreciationExecution {
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
  schedule?: {
    id: string
    name: string
    scheduleType: string
  }
  executor?: {
    id: string
    name: string
  }
  _count: {
    assetDetails: number
  }
}

interface DepreciationHistoryViewProps {
  historyData: {
    executions: DepreciationExecution[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
    summary: {
      totalExecutions: number
      totalAssetsProcessed: number
      totalSuccessfulCalculations: number
      totalDepreciationAmount: number
    }
  }
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    page: number
    status?: string
    dateFrom?: string
    dateTo?: string
  }
}

export function DepreciationHistoryView({
  historyData,
  businessUnit,
  businessUnitId,
  currentFilters
}: DepreciationHistoryViewProps) {
  const router = useRouter()
  const [filters, setFilters] = useState({
    status: currentFilters.status || 'all',
    dateFrom: currentFilters.dateFrom ? new Date(currentFilters.dateFrom) : undefined,
    dateTo: currentFilters.dateTo ? new Date(currentFilters.dateTo) : undefined
  })

  const handleFilterChange = () => {
    const params = new URLSearchParams()
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString().split('T')[0])
    if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString().split('T')[0])
    params.set('page', '1')
    
    router.push(`/${businessUnitId}/asset-management/depreciation/history?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams()
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString().split('T')[0])
    if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString().split('T')[0])
    params.set('page', page.toString())
    
    router.push(`/${businessUnitId}/asset-management/depreciation/history?${params.toString()}`)
  }

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

  const getExecutionTypeLabel = (execution: DepreciationExecution) => {
    if (execution.schedule) {
      return `Scheduled (${execution.schedule.name})`
    } else if (execution.executor) {
      return `Manual (${execution.executor.name})`
    } else {
      return 'Automated'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Depreciation History</h1>
          <p className="text-muted-foreground">
            View all depreciation calculation executions for {businessUnit.name}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Executions</p>
            <p className="text-2xl font-bold">{historyData.summary.totalExecutions}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Assets Processed</p>
            <p className="text-2xl font-bold">{historyData.summary.totalAssetsProcessed.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Successful Calculations</p>
            <p className="text-2xl font-bold">{historyData.summary.totalSuccessfulCalculations.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <DollarSign className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Depreciation</p>
            <p className="text-2xl font-bold">₱{historyData.summary.totalDepreciationAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Date From</label>
          <DatePicker
            date={filters.dateFrom}
            onDateChange={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
            placeholder="Select start date"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Date To</label>
          <DatePicker
            date={filters.dateTo}
            onDateChange={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
            placeholder="Select end date"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">&nbsp;</label>
          <Button onClick={handleFilterChange} className="w-full">
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Execution History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Execution History</h2>
          <div className="text-sm text-muted-foreground">
            {historyData.executions.length} of {historyData.pagination.totalCount} executions
          </div>
        </div>
        
        {historyData.executions.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No depreciation executions found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Executions will appear here after running depreciation calculations
            </p>
          </div>
        ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Execution Date</TableHead>
                      <TableHead>Type</TableHead>
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
                    {historyData.executions.map((execution) => (
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
                          <div className="text-sm">
                            {getExecutionTypeLabel(execution)}
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
                          <span className="font-mono">₱{execution.totalDepreciationAmount.toLocaleString()}</span>
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {historyData.executions.map((execution) => (
                  <div key={execution.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">
                          {format(new Date(execution.executionDate), 'MMM dd, yyyy HH:mm')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getExecutionTypeLabel(execution)}
                        </div>
                      </div>
                      {getStatusBadge(execution.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Assets Processed</div>
                        <div className="font-medium">{execution.totalAssetsProcessed}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Total Amount</div>
                        <div className="font-mono">₱{execution.totalDepreciationAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Successful</div>
                        <div className="text-green-600 font-medium">{execution.successfulCalculations}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Failed</div>
                        <div className="text-red-600 font-medium">{execution.failedCalculations}</div>
                      </div>
                    </div>

                    {execution.errorMessage && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {execution.errorMessage}
                      </div>
                    )}

                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/history/${execution.id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((historyData.pagination.page - 1) * historyData.pagination.limit) + 1} to{' '}
                    {Math.min(historyData.pagination.page * historyData.pagination.limit, historyData.pagination.totalCount)} of{' '}
                    {historyData.pagination.totalCount} executions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(historyData.pagination.page - 1)}
                      disabled={!historyData.pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(historyData.pagination.page + 1)}
                      disabled={!historyData.pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  )
}