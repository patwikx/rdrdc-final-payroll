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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ClipboardList, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Clock,
  Play,
  CheckSquare,
  Users,
  MapPin,
  Package,
  Eye
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { 
  getVerificationDetails,
  startVerification,
  completeVerification
} from "@/lib/actions/inventory-verification-actions"

interface VerificationDetailsDialogProps {
  verificationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function VerificationDetailsDialog({
  verificationId,
  open,
  onOpenChange,
  onUpdate
}: VerificationDetailsDialogProps) {
  const [verification, setVerification] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  useEffect(() => {
    if (open && verificationId) {
      loadVerificationDetails()
    }
  }, [open, verificationId])

  const loadVerificationDetails = async () => {
    setIsLoading(true)
    try {
      const details = await getVerificationDetails(verificationId)
      setVerification(details)
    } catch (error) {
      console.error("Error loading verification details:", error)
      toast.error("Failed to load verification details")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartVerification = async () => {
    setIsActionLoading(true)
    try {
      const result = await startVerification(verificationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        loadVerificationDetails()
        onUpdate()
      }
    } catch (error) {
      console.error("Error starting verification:", error)
      toast.error("Failed to start verification")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCompleteVerification = async () => {
    setIsActionLoading(true)
    try {
      const result = await completeVerification(verificationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        loadVerificationDetails()
        onUpdate()
      }
    } catch (error) {
      console.error("Error completing verification:", error)
      toast.error("Failed to complete verification")
    } finally {
      setIsActionLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'bg-blue-500'
      case 'IN_PROGRESS': return 'bg-yellow-500'
      case 'COMPLETED': return 'bg-green-500'
      case 'CANCELLED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'Planned'
      case 'IN_PROGRESS': return 'In Progress'
      case 'COMPLETED': return 'Completed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
      case 'VERIFIED': return 'text-green-600 bg-green-100 dark:bg-green-900/30'
      case 'DISCREPANCY': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
      case 'NOT_FOUND': return 'text-red-600 bg-red-100 dark:bg-red-900/30'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return Clock
      case 'VERIFIED': return CheckCircle
      case 'DISCREPANCY': return AlertTriangle
      case 'NOT_FOUND': return XCircle
      default: return ClipboardList
    }
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading verification details...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!verification) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Verification not found</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {verification.verificationName}
          </DialogTitle>
          <DialogDescription>
            Inventory verification details and progress
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(verification.status)}`}></div>
              {getStatusLabel(verification.status)}
            </Badge>
            
            <div className="flex gap-2">
              {verification.status === 'PLANNED' && (
                <Button onClick={handleStartVerification} disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Play className="mr-2 h-4 w-4" />
                  Start Verification
                </Button>
              )}
              {verification.status === 'IN_PROGRESS' && (
                <Button onClick={handleCompleteVerification} disabled={isActionLoading}>
                  {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Complete Verification
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{verification.totalAssets}</div>
                <div className="text-sm text-muted-foreground">Total Assets</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{verification.scannedAssets}</div>
                <div className="text-sm text-muted-foreground">Scanned</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{verification.verifiedAssets}</div>
                <div className="text-sm text-muted-foreground">Verified</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{verification.discrepancies}</div>
                <div className="text-sm text-muted-foreground">Discrepancies</div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bar */}
          {verification.progress > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Progress</span>
                <span>{verification.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-primary rounded-full h-3 transition-all duration-300"
                  style={{ width: `${verification.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assets">Assets ({verification.verificationItems?.length || 0})</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Verification Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm text-muted-foreground">
                        {verification.description || 'No description provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(verification.startDate), 'PPP')}
                      </p>
                    </div>
                    {verification.endDate && (
                      <div>
                        <p className="text-sm font-medium">End Date</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(verification.endDate), 'PPP')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">Created By</p>
                      <p className="text-sm text-muted-foreground">
                        {verification.createdByEmployee.name} ({verification.createdByEmployee.employeeId})
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Locations ({verification.locations.length})
                      </p>
                      <div className="text-sm text-muted-foreground">
                        {verification.locations.length > 0 
                          ? verification.locations.join(', ')
                          : 'All locations'
                        }
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Categories ({verification.categories.length})
                      </p>
                      <div className="text-sm text-muted-foreground">
                        {verification.categories.length > 0 
                          ? `${verification.categories.length} selected`
                          : 'All categories'
                        }
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-4">
              <div className="space-y-2">
                {verification.verificationItems?.map((item: any) => {
                  const StatusIcon = getItemStatusIcon(item.status)
                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.asset.itemCode}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {item.asset.category.name}
                            </Badge>
                            <Badge className={`text-xs ${getItemStatusColor(item.status)}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {item.status}
                            </Badge>
                          </div>
                          
                          <h4 className="font-medium text-sm mb-2">{item.asset.description}</h4>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-muted-foreground">Expected Location</p>
                              <p>{item.expectedLocation}</p>
                            </div>
                            {item.actualLocation && (
                              <div>
                                <p className="text-muted-foreground">Actual Location</p>
                                <p className={item.actualLocation !== item.expectedLocation ? 'text-orange-600' : ''}>
                                  {item.actualLocation}
                                </p>
                              </div>
                            )}
                            {item.scannedAt && (
                              <div>
                                <p className="text-muted-foreground">Scanned At</p>
                                <p>{format(new Date(item.scannedAt), 'MMM dd, HH:mm')}</p>
                              </div>
                            )}
                          </div>
                          
                          {item.notes && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">Notes: {item.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Assigned Team ({verification.assignedEmployees?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {verification.assignedEmployees?.map((employee: any) => (
                      <div key={employee.id} className="flex items-center gap-3 p-2 border rounded">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {employee.employeeId}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}