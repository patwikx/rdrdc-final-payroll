"use client"


import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  History, 
  User, 
  Calendar,
  MapPin,
  Package,
  Truck,
  Settings,
  AlertCircle,
  CheckCircle,
  Edit,
  Power,
  Calculator
} from "lucide-react"
import { format } from "date-fns"
import { AssetDetailsData } from "@/lib/actions/asset-details-actions"

interface AssetHistoryTabProps {
  asset: AssetDetailsData
}

export function AssetHistoryTab({ asset }: AssetHistoryTabProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATED':
        return <Package className="h-4 w-4 text-green-600" />
      case 'DEPLOYED':
        return <Truck className="h-4 w-4 text-blue-600" />
      case 'RETURNED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'TRANSFERRED':
        return <Truck className="h-4 w-4 text-orange-600" />
      case 'STATUS_CHANGED':
        return <Settings className="h-4 w-4 text-purple-600" />
      case 'MAINTENANCE_START':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'MAINTENANCE_END':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'RETIRED':
        return <Power className="h-4 w-4 text-gray-600" />
      case 'LOST':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'DAMAGED':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'REPAIRED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'LOCATION_CHANGED':
        return <MapPin className="h-4 w-4 text-blue-600" />
      case 'UPDATED':
        return <Edit className="h-4 w-4 text-gray-600" />
      case 'DEPRECIATION_CALCULATED':
        return <Calculator className="h-4 w-4 text-purple-600" />
      case 'DISPOSED':
        return <Power className="h-4 w-4 text-gray-600" />
      default:
        return <History className="h-4 w-4 text-gray-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'text-green-600'
      case 'DEPLOYED':
        return 'text-blue-600'
      case 'RETURNED':
        return 'text-green-600'
      case 'TRANSFERRED':
        return 'text-orange-600'
      case 'STATUS_CHANGED':
        return 'text-purple-600'
      case 'MAINTENANCE_START':
        return 'text-yellow-600'
      case 'MAINTENANCE_END':
        return 'text-green-600'
      case 'RETIRED':
        return 'text-gray-600'
      case 'LOST':
      case 'DAMAGED':
        return 'text-red-600'
      case 'REPAIRED':
        return 'text-green-600'
      case 'LOCATION_CHANGED':
        return 'text-blue-600'
      case 'UPDATED':
        return 'text-gray-600'
      case 'DEPRECIATION_CALCULATED':
        return 'text-purple-600'
      case 'DISPOSED':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatActionName = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  return (
    <div className="space-y-8">
      {/* History Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <History className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Asset History</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete timeline of all actions performed on this asset
        </p>
        
        <div>
          <ScrollArea className="h-[600px] w-full">
            {asset.recentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2" />
                <p>No history records found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {asset.recentHistory.map((record, index) => (
                  <div key={record.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                    <div className="flex-shrink-0 mt-1">
                      {getActionIcon(record.action)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${getActionColor(record.action)}`}>
                            {formatActionName(record.action)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(record.performedAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      
                      {record.notes && (
                        <p className="text-sm text-muted-foreground">
                          {record.notes}
                        </p>
                      )}
                      
                      {record.employee && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>Performed by {record.employee.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold pb-2 border-b">History Statistics</h3>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Total Actions</h4>
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{asset.recentHistory.length}</div>
            <p className="text-xs text-muted-foreground">
              Recorded activities
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Last Activity</h4>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {asset.recentHistory.length > 0 
                ? format(new Date(asset.recentHistory[0].performedAt), 'MMM dd')
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {asset.recentHistory.length > 0 
                ? formatActionName(asset.recentHistory[0].action)
                : 'No activities'
              }
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Created By</h4>
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold truncate">
              {asset.createdBy.name}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(asset.createdAt), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}