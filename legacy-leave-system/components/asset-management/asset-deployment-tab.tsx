"use client"


import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Truck, 
  User, 
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight
} from "lucide-react"
import { format } from "date-fns"
import { AssetDetailsData } from "@/lib/actions/asset-details-actions"
import { DeploymentStatus } from "@prisma/client"

interface AssetDeploymentTabProps {
  asset: AssetDetailsData
  businessUnitId: string
}

export function AssetDeploymentTab({ asset, businessUnitId }: AssetDeploymentTabProps) {
  const getDeploymentStatusBadge = (status: DeploymentStatus) => {
    switch (status) {
      case 'PENDING_ACCOUNTING_APPROVAL':
        return <Badge variant="outline">Pending Approval</Badge>
      case 'APPROVED':
        return <Badge variant="default">Approved</Badge>
      case 'DEPLOYED':
        return <Badge variant="secondary">Deployed</Badge>
      case 'RETURNED':
        return <Badge variant="outline">Returned</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: DeploymentStatus) => {
    switch (status) {
      case 'PENDING_ACCOUNTING_APPROVAL':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case 'DEPLOYED':
        return <Truck className="h-4 w-4 text-blue-500" />
      case 'RETURNED':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Current Deployment Status */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Truck className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Current Deployment Status</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Current assignment and deployment information
        </p>
        
        <div>
          {asset.currentDeployment ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(asset.currentDeployment.status)}
                  <span className="font-medium">Currently Deployed</span>
                </div>
                {getDeploymentStatusBadge(asset.currentDeployment.status)}
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{asset.currentDeployment.employee.name}</span>
                    <Badge variant="outline">{asset.currentDeployment.employee.employeeId}</Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transmittal Number</label>
                  <div className="font-mono text-sm mt-1">{asset.currentDeployment.transmittalNumber}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Deployment Date</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {asset.currentDeployment.deployedDate 
                        ? format(new Date(asset.currentDeployment.deployedDate), 'MMM dd, yyyy')
                        : 'Not specified'
                      }
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expected Return</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {asset.currentDeployment.expectedReturnDate 
                        ? format(new Date(asset.currentDeployment.expectedReturnDate), 'MMM dd, yyyy')
                        : 'Not specified'
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              {asset.currentDeployment.deploymentNotes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Deployment Notes</label>
                  <div className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {asset.currentDeployment.deploymentNotes}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Truck className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Asset is currently available for deployment</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Deploy Asset
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Deployment History */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Calendar className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Deployment History</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete history of all deployments and returns
        </p>
        
        <div>
          {asset.deploymentHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2" />
              <p>No deployment history found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] w-full">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transmittal #</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Deployed</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asset.deploymentHistory.map((deployment) => {
                      const deployedDate = deployment.deployedDate ? new Date(deployment.deployedDate) : null
                      const returnedDate = deployment.returnedDate ? new Date(deployment.returnedDate) : null
                      
                      let duration = 'Ongoing'
                      if (deployedDate && returnedDate) {
                        const diffTime = Math.abs(returnedDate.getTime() - deployedDate.getTime())
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        duration = `${diffDays} day${diffDays !== 1 ? 's' : ''}`
                      }
                      
                      return (
                        <TableRow key={deployment.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{deployment.transmittalNumber}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{deployment.employee.name}</div>
                                <div className="text-xs text-muted-foreground">{deployment.employee.employeeId}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {deployedDate ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{format(deployedDate, 'MMM dd, yyyy')}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not specified</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {returnedDate ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{format(returnedDate, 'MMM dd, yyyy')}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not returned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getDeploymentStatusBadge(deployment.status)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{duration}</span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Deployment Statistics */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold pb-2 border-b">Deployment Statistics</h3>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Total Deployments</h4>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{asset.deploymentHistory.length}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime deployments
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Current Status</h4>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {asset.currentDeployment ? 'Deployed' : 'Available'}
            </div>
            <p className="text-xs text-muted-foreground">
              {asset.currentDeployment ? 'Currently assigned' : 'Ready for deployment'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Last Assignment</h4>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {asset.lastAssignedDate 
                ? format(new Date(asset.lastAssignedDate), 'MMM dd')
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Last deployment date
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}