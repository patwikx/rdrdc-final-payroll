"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { 
  Package, 
  Calendar, 
  DollarSign, 
  MapPin, 
  User, 
  Building,
  FileText,
  Clock,
  Activity
} from "lucide-react"
import { format } from "date-fns"

interface AssetCategory {
  id: string
  name: string
  code: string
  description: string | null
}

interface BusinessUnit {
  id: string
  name: string
  code: string
}

interface Department {
  id: string
  name: string
  code: string
}

interface Employee {
  id: string
  name: string
  employeeId: string
}

interface AssetDeployment {
  id: string
  transmittalNumber: string
  deployedDate: Date | string
  expectedReturnDate: Date | string | null
  returnedDate: Date | string | null
  status: string
  employee: Employee
}

interface AssetHistory {
  id: string
  action: string
  notes: string | null
  performedAt: Date | string
  employee: Employee | null
}

interface PublicAssetData {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  modelNumber: string | null
  brand: string | null
  quantity: number
  location: string | null
  notes: string | null
  status: string
  isActive: boolean
  purchasePrice: number | null
  currentBookValue: number | null
  accumulatedDepreciation: number
  purchaseDate: Date | string | null
  warrantyExpiry: Date | string | null
  category: AssetCategory | null
  businessUnit: BusinessUnit | null
  department: Department | null
  createdBy: Employee | null
  createdAt: Date | string
  updatedAt: Date | string
  currentDeployment: AssetDeployment | null
  recentHistory: AssetHistory[]
}

interface PublicAssetDetailsViewProps {
  asset: PublicAssetData
}

export function PublicAssetDetailsView({ asset }: PublicAssetDetailsViewProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "Not specified"
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Not specified"
    return format(new Date(date), "MMM dd, yyyy")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'INACTIVE': return 'bg-muted text-muted-foreground'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'DISPOSED': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'LOST': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{asset.itemCode}</h1>
            <p className="text-lg text-muted-foreground">{asset.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(asset.status)}>
            {asset.status.replace(/_/g, ' ')}
          </Badge>
          {asset.isActive && (
            <Badge variant="outline" className="text-green-600 border-green-600 dark:text-green-400 dark:border-green-400">
              Active
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Item Code</label>
                <p className="text-sm font-mono text-foreground">{asset.itemCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="text-sm text-foreground">{asset.category?.name || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Serial Number</label>
                <p className="text-sm font-mono text-foreground">{asset.serialNumber || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Model Number</label>
                <p className="text-sm text-foreground">{asset.modelNumber || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Brand</label>
                <p className="text-sm text-foreground">{asset.brand || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <p className="text-sm text-foreground">{asset.quantity}</p>
              </div>
            </div>
            
            {asset.location && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Location
                </label>
                <p className="text-sm text-foreground">{asset.location}</p>
              </div>
            )}

            {asset.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="text-sm text-foreground">{asset.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Price</label>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(asset.purchasePrice)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Book Value</label>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(asset.currentBookValue)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Accumulated Depreciation</label>
                <p className="text-sm text-foreground">{formatCurrency(asset.accumulatedDepreciation)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Date</label>
                <p className="text-sm flex items-center gap-1 text-foreground">
                  <Calendar className="h-4 w-4" />
                  {formatDate(asset.purchaseDate)}
                </p>
              </div>
              {asset.warrantyExpiry && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Warranty Expiry</label>
                  <p className="text-sm flex items-center gap-1 text-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(asset.warrantyExpiry)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organization Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Business Unit</label>
              <p className="text-sm text-foreground">{asset.businessUnit?.name} ({asset.businessUnit?.code})</p>
            </div>
            {asset.department && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <p className="text-sm text-foreground">{asset.department.name}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created By</label>
              <p className="text-sm flex items-center gap-1 text-foreground">
                <User className="h-4 w-4" />
                {asset.createdBy?.name} ({asset.createdBy?.employeeId})
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created Date</label>
              <p className="text-sm flex items-center gap-1 text-foreground">
                <Clock className="h-4 w-4" />
                {formatDate(asset.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Current Assignment */}
        {asset.currentDeployment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Current Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                <p className="text-sm font-semibold text-foreground">
                  {asset.currentDeployment.employee.name} ({asset.currentDeployment.employee.employeeId})
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transmittal Number</label>
                <p className="text-sm font-mono text-foreground">{asset.currentDeployment.transmittalNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Deployed Date</label>
                <p className="text-sm text-foreground">{formatDate(asset.currentDeployment.deployedDate)}</p>
              </div>
              {asset.currentDeployment.expectedReturnDate && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expected Return</label>
                  <p className="text-sm text-foreground">{formatDate(asset.currentDeployment.expectedReturnDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      {asset.recentHistory && asset.recentHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {asset.recentHistory.slice(0, 10).map((history: AssetHistory) => (
                <div key={history.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {history.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(history.performedAt)}
                      </p>
                    </div>
                    {history.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{history.notes}</p>
                    )}
                    {history.employee && (
                      <p className="text-xs text-muted-foreground mt-1">
                        by {history.employee.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Asset information accessed via QR code</p>
        <p>Last updated: {formatDate(asset.updatedAt)}</p>
      </div>
    </div>
  )
}