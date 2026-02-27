"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
  ArrowLeft,
  QrCode,
  Camera
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { 
  startVerification,
  completeVerification,
  scanAsset,
  markAssetNotFound
} from "@/lib/actions/inventory-verification-actions"
import { AssetScanDialog } from "./asset-scan-dialog"

interface VerificationDetailsViewProps {
  verification: any
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
}

export function VerificationDetailsView({
  verification,
  businessUnit,
  businessUnitId
}: VerificationDetailsViewProps) {
  const router = useRouter()
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)

  const handleStartVerification = async () => {
    setIsActionLoading(true)
    try {
      const result = await startVerification(verification.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
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
      const result = await completeVerification(verification.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      console.error("Error completing verification:", error)
      toast.error("Failed to complete verification")
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleScanAsset = (asset: any) => {
    setSelectedAsset(asset)
    setShowScanDialog(true)
  }

  const handleScanSuccess = () => {
    setShowScanDialog(false)
    setSelectedAsset(null)
    router.refresh()
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{verification.verificationName}</h1>
            <p className="text-sm text-muted-foreground">
              Inventory verification for {businessUnit.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(verification.status)}`}></div>
            {getStatusLabel(verification.status)}
          </Badge>
          
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Assets</p>
                <p className="text-2xl font-bold">{verification.items?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Verified</p>
                <p className="text-2xl font-bold text-green-600">
                  {verification.items?.filter((item: any) => item.status === 'VERIFIED').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Discrepancies</p>
                <p className="text-2xl font-bold text-orange-600">
                  {verification.items?.filter((item: any) => item.status === 'DISCREPANCY').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Not Found</p>
                <p className="text-2xl font-bold text-red-600">
                  {verification.items?.filter((item: any) => item.status === 'NOT_FOUND').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="assets">Assets ({verification.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Verification Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{verification.description || 'No description provided'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                    <p className="text-sm">{format(new Date(verification.startDate), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">End Date</p>
                    <p className="text-sm">
                      {verification.endDate ? format(new Date(verification.endDate), 'PPP') : 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-sm">{format(new Date(verification.createdAt), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{format(new Date(verification.updatedAt), 'PPP')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filters Applied</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Locations</p>
                  {verification.locations && verification.locations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {verification.locations.map((location: string) => (
                        <Badge key={location} variant="secondary" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {location}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">All locations</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Categories</p>
                  {verification.categories && verification.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {verification.categories.map((category: any) => (
                        <Badge key={category.id} variant="secondary" className="text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">All categories</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Verification List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {verification.items?.map((item: any) => {
                  const StatusIcon = getItemStatusIcon(item.status)
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <StatusIcon className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{item.asset.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.asset.assetTag} • {item.asset.location}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getItemStatusColor(item.status)}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                        
                        {verification.status === 'IN_PROGRESS' && item.status === 'PENDING' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleScanAsset(item.asset)}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Scan
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                }) || (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No assets found for this verification</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assigned Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {verification.assignedTo?.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{assignment.employee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {assignment.employee.employeeId}
                        {assignment.employee.department && ` • ${assignment.employee.department.name}`}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {assignment.employee.role}
                    </Badge>
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No team members assigned</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Asset Scan Dialog */}
      {showScanDialog && selectedAsset && (
        <AssetScanDialog
          asset={selectedAsset}
          verificationId={verification.id}
          open={showScanDialog}
          onOpenChange={setShowScanDialog}
          onSuccess={handleScanSuccess}
        />
      )}
    </div>
  )
}