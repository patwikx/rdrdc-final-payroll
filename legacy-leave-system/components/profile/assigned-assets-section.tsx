"use client"

import { useState, useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Package, FileText } from "lucide-react"
import { format } from "date-fns"
import { getUserAssetDeployments, getAllUserAssetDeployments } from "@/lib/actions/asset-actions"
import { DeploymentStatus } from "@prisma/client"
import { AssetDeployment, DEPLOYMENT_STATUS_LABELS, DEPLOYMENT_STATUS_COLORS } from "@/types/asset-types"
import { toast } from "sonner"

interface AssignedAssetsSectionProps {
  userId: string
}

// Helper function to get deployment status color
function getDeploymentStatusColor(status: DeploymentStatus): "default" | "secondary" | "destructive" | "outline" {
  return DEPLOYMENT_STATUS_COLORS[status] || "outline"
}

// Helper function to format deployment status
function formatDeploymentStatus(status: DeploymentStatus): string {
  return DEPLOYMENT_STATUS_LABELS[status] || status
}

export function AssignedAssetsSection({ userId }: AssignedAssetsSectionProps) {
  const [deployments, setDeployments] = useState<AssetDeployment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const loadDeployments = async () => {
      setIsLoading(true)
      try {
        const data = showAll 
          ? await getAllUserAssetDeployments(userId)
          : await getUserAssetDeployments(userId)
        setDeployments(data)
      } catch (error) {
        console.error("Error loading asset deployments:", error)
        toast.error("Failed to load assigned assets")
      } finally {
        setIsLoading(false)
      }
    }

    loadDeployments()
  }, [userId, showAll])

  const activeDeployments = deployments.filter(d => 
    d.status === "DEPLOYED" || d.status === "APPROVED"
  )

  if (isLoading) {
    return (
      <div className="md:col-span-3 space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assigned Assets
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading assigned assets...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="md:col-span-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assigned Assets
          </h3>
          {activeDeployments.length > 0 && (
            <Badge variant="secondary">
              {activeDeployments.length} Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Active Only" : "Show All History"}
          </Button>
        </div>
      </div>
      
      <div>
        {deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Assets Assigned</h3>
            <p className="text-sm text-muted-foreground">
              {showAll 
                ? "You have no asset deployment history."
                : "You currently have no assets assigned to you."
              }
            </p>
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
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deployed Date</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Transmittal No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{deployment.asset.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {deployment.asset.itemCode}
                          </div>
                          {deployment.asset.brand && (
                            <div className="text-xs text-muted-foreground">
                              {deployment.asset.brand}
                              {deployment.asset.modelNumber && ` - ${deployment.asset.modelNumber}`}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {deployment.asset.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {deployment.asset.serialNumber || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getDeploymentStatusColor(deployment.status)}>
                          {formatDeploymentStatus(deployment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {deployment.deployedDate 
                          ? format(new Date(deployment.deployedDate), "MMM dd, yyyy")
                          : "Not deployed"
                        }
                      </TableCell>
                      <TableCell>
                        {deployment.expectedReturnDate 
                          ? format(new Date(deployment.expectedReturnDate), "MMM dd, yyyy")
                          : "No return date"
                        }
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {deployment.transmittalNumber}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {deployments.map((deployment) => (
                <div key={deployment.id} className="border-l-4 border-l-primary bg-muted/30 rounded-r-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{deployment.asset.description}</h4>
                        <p className="text-sm text-muted-foreground">
                          {deployment.asset.itemCode}
                        </p>
                        {deployment.asset.brand && (
                          <p className="text-xs text-muted-foreground">
                            {deployment.asset.brand}
                            {deployment.asset.modelNumber && ` - ${deployment.asset.modelNumber}`}
                          </p>
                        )}
                      </div>
                      <Badge variant={getDeploymentStatusColor(deployment.status)}>
                        {formatDeploymentStatus(deployment.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Category:</span>
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            {deployment.asset.category.name}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Serial Number:</span>
                        <p className="font-mono text-xs mt-1">
                          {deployment.asset.serialNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Deployed:</span>
                        <p className="mt-1">
                          {deployment.deployedDate 
                            ? format(new Date(deployment.deployedDate), "MMM dd, yyyy")
                            : "Not deployed"
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected Return:</span>
                        <p className="mt-1">
                          {deployment.expectedReturnDate 
                            ? format(new Date(deployment.expectedReturnDate), "MMM dd, yyyy")
                            : "No return date"
                          }
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Transmittal: {deployment.transmittalNumber}
                        </span>
                        {deployment.deploymentNotes && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Notes
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}