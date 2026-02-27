"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Edit,
  QrCode,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  User,
  Building,
  FileText,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { format } from "date-fns"
import { AssetDetailsData } from "@/lib/actions/asset-details-actions"
import { QRCodeCard } from "./qr-code-card"
import { AssetStatusBadge } from "./asset-status-badge"
import { AssetHistoryTab } from "./asset-history-tab"
import { AssetDeploymentTab } from "./asset-deployment-tab"
import { AssetFinancialTab } from "./asset-financial-tab"
import { EditAssetDialog } from "./edit-asset-dialog"

interface AssetDetailsViewProps {
  asset: AssetDetailsData
  businessUnitId: string
}

export function AssetDetailsView({ asset, businessUnitId }: AssetDetailsViewProps) {
  const router = useRouter()
  const [showEditDialog, setShowEditDialog] = useState(false)

  const handleBack = () => {
    router.push(`/${businessUnitId}/asset-management/assets`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{asset.description}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {asset.itemCode}
            </Badge>
            <AssetStatusBadge status={asset.status} />
            {!asset.isActive && (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Asset
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        
        <QRCodeCard
          assetId={asset.id}
          assetData={{
            itemCode: asset.itemCode,
            description: asset.description,
            serialNumber: asset.serialNumber || undefined
          }}
          initialQRCode={asset.barcodeValue}
        />
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{asset.category.name}</div>
          <p className="text-xs text-muted-foreground">
            Code: {asset.category.code}
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Purchase Price</h3>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            {asset.purchasePrice 
              ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.purchasePrice)
              : 'N/A'
            }
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM dd, yyyy') : 'Date not specified'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Current Value</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            {asset.currentBookValue 
              ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.currentBookValue)
              : 'N/A'
            }
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.isFullyDepreciated ? 'Fully Depreciated' : 'Book Value'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Assignment</h3>
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            {asset.currentDeployment ? 'Deployed' : 'Available'}
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.currentDeployment 
              ? asset.currentDeployment.employee.name
              : 'Not assigned'
            }
          </p>
        </div>

      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Asset Identification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Package className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Asset Identification</h3>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-6 border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Item Code</label>
                    <div className="text-lg font-mono font-semibold mt-1">{asset.itemCode}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                    <div className="font-medium mt-1">{asset.description}</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Serial Number</label>
                    <div className="text-lg font-mono font-semibold mt-1">{asset.serialNumber || 'Not Available'}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                    <div className="mt-1">
                      <Badge variant="secondary" className="font-medium">
                        {asset.category.name}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Status</label>
                    <div className="mt-1">
                      <AssetStatusBadge status={asset.status} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity</label>
                    <div className="text-lg font-semibold mt-1">{asset.quantity}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <FileText className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Technical Specifications</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-card border rounded-lg">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand</label>
                <div className="text-sm font-medium mt-2">{asset.brand || 'Not specified'}</div>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model Number</label>
                <div className="text-sm font-medium mt-2">{asset.modelNumber || 'Not specified'}</div>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Date</label>
                <div className="text-sm font-medium mt-2">
                  {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM dd, yyyy') : 'Not specified'}
                </div>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Warranty Status</label>
                <div className="flex items-center gap-2 mt-2">
                  {asset.warrantyExpiry ? (
                    <>
                      <span className="text-sm font-medium">
                        {format(new Date(asset.warrantyExpiry), 'MMM dd, yyyy')}
                      </span>
                      {new Date(asset.warrantyExpiry) < new Date() ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </>
                  ) : (
                    <span className="text-sm font-medium">No warranty info</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location & Assignment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <MapPin className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Location & Assignment</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-primary" />
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{asset.department?.name || 'Unassigned'}</span>
                    {asset.department?.code && (
                      <Badge variant="outline" className="text-xs">
                        {asset.department.code}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="p-4 bg-muted/50 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Location</label>
                  </div>
                  <div className="font-medium">{asset.location || 'Location not specified'}</div>
                </div>
              </div>
              
              <div>
                {asset.currentDeployment ? (
                  <div className="p-4 bg-accent/50 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-primary" />
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currently Assigned To</label>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{asset.currentDeployment.employee.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {asset.currentDeployment.employee.employeeId}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deployed: {asset.currentDeployment.deployedDate 
                          ? format(new Date(asset.currentDeployment.deployedDate), 'MMM dd, yyyy')
                          : 'Date not specified'
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignment Status</label>
                    </div>
                    <div className="font-medium">Available for Assignment</div>
                    <div className="text-xs text-muted-foreground mt-1">This asset is currently unassigned and available for deployment</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          {asset.notes && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Additional Notes</h3>
              </div>
              <div className="p-4 bg-muted/50 border rounded-lg">
                <div className="text-sm leading-relaxed">{asset.notes}</div>
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Calendar className="h-5 w-5" />
              <h3 className="text-lg font-semibold">System Information</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</label>
                <div className="text-sm font-medium mt-1">{format(new Date(asset.createdAt), 'MMM dd, yyyy')}</div>
                <div className="text-xs text-muted-foreground">by {asset.createdBy?.name || 'System'}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Updated</label>
                <div className="text-sm font-medium mt-1">{format(new Date(asset.updatedAt), 'MMM dd, yyyy')}</div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Status</label>
                <div className="text-sm font-medium mt-1">
                  {asset.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category Code</label>
                <div className="text-sm font-medium mt-1 font-mono">{asset.category.code}</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financial">
          <AssetFinancialTab asset={asset} businessUnitId={businessUnitId} />
        </TabsContent>

        <TabsContent value="deployment">
          <AssetDeploymentTab asset={asset} businessUnitId={businessUnitId} />
        </TabsContent>

        <TabsContent value="history">
          <AssetHistoryTab asset={asset} />
        </TabsContent>
      </Tabs>

      {/* Edit Asset Dialog */}
      <EditAssetDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        asset={asset}
        businessUnitId={businessUnitId}
      />
    </div>
  )
}