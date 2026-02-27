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
  ArrowLeft,
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  User,
  Settings,
  BarChart3,
  DollarSign,
  Package,
  TrendingDown
} from "lucide-react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

interface ExecutionDetails {
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
  executionSummary?: any
  schedule?: {
    id: string
    name: string
    scheduleType: string
    description?: string
  }
  executor?: {
    id: string
    name: string
    email?: string
  }
  assetDetails: Array<{
    id: string
    status: string
    depreciationAmount: number
    bookValueBefore: number
    bookValueAfter: number
    errorMessage?: string
    asset: {
      id: string
      itemCode: string
      description: string
      category: {
        name: string
      }
    }
    depreciationRecord?: {
      id: string
      depreciationAmount: number
      bookValueStart: number
      bookValueEnd: number
    }
  }>
}

interface DepreciationExecutionDetailViewProps {
  executionDetails: ExecutionDetails
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
}

export function DepreciationExecutionDetailView({
  executionDetails,
  businessUnit,
  businessUnitId
}: DepreciationExecutionDetailViewProps) {
  const router = useRouter()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="text-sm"><CheckCircle className="h-4 w-4 mr-2" />Completed</Badge>
      case 'FAILED':
        return <Badge variant="destructive" className="text-sm"><XCircle className="h-4 w-4 mr-2" />Failed</Badge>
      case 'RUNNING':
        return <Badge variant="secondary" className="text-sm"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running</Badge>
      case 'PENDING':
        return <Badge variant="outline" className="text-sm"><Clock className="h-4 w-4 mr-2" />Pending</Badge>
      case 'CANCELLED':
        return <Badge variant="secondary" className="text-sm"><XCircle className="h-4 w-4 mr-2" />Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-sm">{status}</Badge>
    }
  }

  const getAssetStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="default" className="text-xs">Success</Badge>
      case 'FAILED':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>
      case 'SKIPPED':
        return <Badge variant="secondary" className="text-xs">Skipped</Badge>
      case 'FULLY_DEPRECIATED':
        return <Badge variant="outline" className="text-xs">Fully Depreciated</Badge>
      case 'NO_SETUP':
        return <Badge variant="outline" className="text-xs">No Setup</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const successfulAssets = executionDetails.assetDetails.filter(asset => asset.status === 'SUCCESS')
  const failedAssets = executionDetails.assetDetails.filter(asset => asset.status === 'FAILED')
  const skippedAssets = executionDetails.assetDetails.filter(asset => asset.status === 'SKIPPED')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Execution Details</h1>
            <p className="text-muted-foreground">
              Depreciation execution from {format(new Date(executionDetails.executionDate), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusBadge(executionDetails.status)}
        </div>
      </div>

      {/* Execution Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Execution Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Execution Date</div>
                <div className="font-medium">
                  {format(new Date(executionDetails.executionDate), 'MMM dd, yyyy HH:mm:ss')}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Scheduled Date</div>
                <div className="font-medium">
                  {format(new Date(executionDetails.scheduledDate), 'MMM dd, yyyy HH:mm:ss')}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">
                  {executionDetails.executionDurationMs ? 
                    `${executionDetails.executionDurationMs}ms` : 
                    'N/A'
                  }
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium">
                  {executionDetails.schedule ? 'Scheduled' : 
                   executionDetails.executor ? 'Manual' : 'Automated'}
                </div>
              </div>
            </div>

            {executionDetails.schedule && (
              <div className="pt-4 border-t">
                <div className="text-muted-foreground text-sm">Schedule</div>
                <div className="font-medium">{executionDetails.schedule.name}</div>
                <div className="text-sm text-muted-foreground">
                  {executionDetails.schedule.scheduleType} • {executionDetails.schedule.description}
                </div>
              </div>
            )}

            {executionDetails.executor && (
              <div className="pt-4 border-t">
                <div className="text-muted-foreground text-sm">Executed By</div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{executionDetails.executor.name}</div>
                    {executionDetails.executor.email && (
                      <div className="text-sm text-muted-foreground">{executionDetails.executor.email}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {executionDetails.errorMessage && (
              <div className="pt-4 border-t">
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-800">Error Message</div>
                      <div className="text-sm text-red-700 mt-1">{executionDetails.errorMessage}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Execution Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-800">{executionDetails.totalAssetsProcessed}</div>
                <div className="text-sm text-blue-600">Total Assets</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-800">{executionDetails.successfulCalculations}</div>
                <div className="text-sm text-green-600">Successful</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-800">{executionDetails.failedCalculations}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-orange-800">
                  ₱{executionDetails.totalDepreciationAmount.toLocaleString()}
                </div>
                <div className="text-sm text-orange-600">Total Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Asset Details ({executionDetails.assetDetails.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executionDetails.assetDetails.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No asset details found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Book Value Before</TableHead>
                      <TableHead>Depreciation Amount</TableHead>
                      <TableHead>Book Value After</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionDetails.assetDetails.map((assetDetail) => (
                      <TableRow key={assetDetail.id}>
                        <TableCell>
                          <div>
                            <div className="font-mono text-sm font-medium">{assetDetail.asset.itemCode}</div>
                            <div className="text-sm text-muted-foreground">{assetDetail.asset.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {assetDetail.asset.category.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAssetStatusBadge(assetDetail.status)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">₱{assetDetail.bookValueBefore.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-red-600">
                            {assetDetail.depreciationAmount > 0 ? 
                              `₱${assetDetail.depreciationAmount.toLocaleString()}` : 
                              '-'
                            }
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">₱{assetDetail.bookValueAfter.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          {assetDetail.errorMessage ? (
                            <div className="text-xs text-red-600 max-w-[200px] truncate" title={assetDetail.errorMessage}>
                              {assetDetail.errorMessage}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {executionDetails.assetDetails.map((assetDetail) => (
                  <div key={assetDetail.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-sm font-medium">{assetDetail.asset.itemCode}</div>
                        <div className="text-sm text-muted-foreground">{assetDetail.asset.description}</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {assetDetail.asset.category.name}
                        </Badge>
                      </div>
                      {getAssetStatusBadge(assetDetail.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Book Value Before</div>
                        <div className="font-mono">₱{assetDetail.bookValueBefore.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Book Value After</div>
                        <div className="font-mono">₱{assetDetail.bookValueAfter.toLocaleString()}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground text-xs">Depreciation Amount</div>
                        <div className="font-mono text-red-600 font-medium">
                          {assetDetail.depreciationAmount > 0 ? 
                            `₱${assetDetail.depreciationAmount.toLocaleString()}` : 
                            'No depreciation'
                          }
                        </div>
                      </div>
                    </div>

                    {assetDetail.errorMessage && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {assetDetail.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}