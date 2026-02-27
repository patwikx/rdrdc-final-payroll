"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Plus,
  Package,
  User,
  Calendar,
  DollarSign,
  MapPin,
  MoreHorizontal,
  Edit,
  Power,
  Trash2,
  Eye,
  QrCode,
  FileSpreadsheet,
  Printer,
  Send,
  Undo2
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useRouter, useSearchParams } from "next/navigation"
import { AssetsResponse, AssetWithDetails, updateAssetStatus, toggleAssetActiveStatus, deleteAsset } from "@/lib/actions/asset-management-actions"
import { QRCodeScanner } from "./qr-code-scanner"
import { AssetStatus } from "@prisma/client"
import { format } from "date-fns"
import { toast } from "sonner"

interface AssetsManagementViewProps {
  assetsData: AssetsResponse
  businessUnitId: string
  currentFilters: {
    categoryId?: string
    status?: AssetStatus
    isActive?: boolean
    search?: string
    assignedTo?: string
    page: number
  }
}

// Helper functions
function getAssetStatusColor(status: AssetStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "AVAILABLE":
      return "default"
    case "DEPLOYED":
      return "secondary"
    case "IN_MAINTENANCE":
      return "outline"
    case "RETIRED":
      return "outline"
    case "LOST":
    case "DAMAGED":
    case "DISPOSED":
      return "destructive"
    case "FULLY_DEPRECIATED":
      return "secondary"
    default:
      return "outline"
  }
}

function formatAssetStatus(status: AssetStatus): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function AssetsManagementView({ 
  assetsData, 
  businessUnitId,
  currentFilters 
}: AssetsManagementViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [deletingAsset, setDeletingAsset] = useState<AssetWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)

  const filteredAssets = useMemo(() => {
    let filtered = assetsData.assets

    // Apply search term filter (client-side for better UX)
    if (searchTerm && searchTerm !== currentFilters.search) {
      filtered = filtered.filter(asset => 
        asset.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.modelNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.tagNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }, [assetsData.assets, searchTerm, currentFilters.search])

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    // Reset to first page when filters change
    if (key !== 'page') {
      params.delete('page')
    }
    
    router.push(`/${businessUnitId}/asset-management/assets?${params.toString()}`)
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/${businessUnitId}/asset-management/assets?${params.toString()}`)
  }

  const handleSearch = () => {
    updateFilter('search', searchTerm || undefined)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleStatusChange = async (asset: AssetWithDetails, newStatus: AssetStatus) => {
    setIsLoading(true)
    try {
      const result = await updateAssetStatus(asset.id, newStatus, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update asset status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (asset: AssetWithDetails) => {
    setIsLoading(true)
    try {
      const result = await toggleAssetActiveStatus(asset.id, !asset.isActive, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update asset status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingAsset) return

    setIsLoading(true)
    try {
      const result = await deleteAsset(deletingAsset.id, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to delete asset")
    } finally {
      setIsLoading(false)
      setDeletingAsset(null)
    }
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assets Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all organizational assets
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => router.push(`/${businessUnitId}/asset-management/assets/bulk-creation`)}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => router.push(`/${businessUnitId}/asset-management/assets/create`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by item code, description, serial number, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
          {searchTerm !== (currentFilters.search || "") && (
            <Button
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
              onClick={handleSearch}
            >
              Search
            </Button>
          )}
        </div>
        
        {/* Category Filter */}
        <Select
          value={currentFilters.categoryId || ""}
          onValueChange={(value) => updateFilter('categoryId', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All categories" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {assetsData.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name} ({category.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={currentFilters.status || ""}
          onValueChange={(value) => updateFilter('status', value || undefined)}
        >
          <SelectTrigger className="w-[140px]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="DEPLOYED">Deployed</SelectItem>
            <SelectItem value="IN_MAINTENANCE">In Maintenance</SelectItem>
            <SelectItem value="RETIRED">Retired</SelectItem>
            <SelectItem value="LOST">Lost</SelectItem>
            <SelectItem value="DAMAGED">Damaged</SelectItem>
            <SelectItem value="FULLY_DEPRECIATED">Fully Depreciated</SelectItem>
            <SelectItem value="DISPOSED">Disposed</SelectItem>
          </SelectContent>
        </Select>

        {/* Active Filter */}
        <Select
          value={currentFilters.isActive === undefined ? "" : currentFilters.isActive.toString()}
          onValueChange={(value) => updateFilter('isActive', value || undefined)}
        >
          <SelectTrigger className="w-[120px]">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {assetsData.assets.length} of {assetsData.totalCount} assets (Page {currentFilters.page} of {Math.ceil(assetsData.totalCount / 10)})
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Model Number</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No assets match your search criteria" : "No assets found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{asset.description}</div>
                    {asset.brand && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {asset.brand}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {asset.serialNumber || <span className="text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {asset.modelNumber || <span className="text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {asset.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={getAssetStatusColor(asset.status)}>
                        {formatAssetStatus(asset.status)}
                      </Badge>
                      {!asset.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{asset.location || "Not specified"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.currentDeployment ? (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{asset.currentDeployment.employee.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleToggleActive(asset)}
                          disabled={isLoading}
                        >
                          <Power className={`h-4 w-4 mr-2 ${asset.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                          {asset.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingAsset(asset)}
                          disabled={isLoading}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-4 sm:hidden">
        {filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assets found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No assets match your search criteria." : "No assets have been added yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{asset.description}</CardTitle>
                    <p className="text-sm font-mono text-muted-foreground mt-1">{asset.itemCode}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant={getAssetStatusColor(asset.status)}>
                      {formatAssetStatus(asset.status)}
                    </Badge>
                    {!asset.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {asset.category.name}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="font-medium mt-1">{asset.location || "Not specified"}</p>
                  </div>
                  {asset.serialNumber && (
                    <div>
                      <span className="text-muted-foreground">Serial Number:</span>
                      <p className="font-mono text-xs mt-1">{asset.serialNumber}</p>
                    </div>
                  )}
                  {asset.brand && (
                    <div>
                      <span className="text-muted-foreground">Brand:</span>
                      <p className="font-medium mt-1">
                        {asset.brand} {asset.modelNumber && `- ${asset.modelNumber}`}
                      </p>
                    </div>
                  )}
                </div>
                
                {asset.currentDeployment && (
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground text-sm">Assigned to:</span>
                    <p className="font-medium mt-1">{asset.currentDeployment.employee.name}</p>
                  </div>
                )}

                {asset.purchasePrice && (
                  <div className="border-t pt-3">
                    <span className="text-muted-foreground text-sm">Purchase Price:</span>
                    <p className="font-medium mt-1">{formatCurrency(Number(asset.purchasePrice))}</p>
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-3"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}/edit`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Asset
                      </DropdownMenuItem>
                      {asset.barcodeValue && (
                        <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}/barcode`)}>
                          <QrCode className="h-4 w-4 mr-2" />
                          View Barcode
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleToggleActive(asset)}
                        disabled={isLoading}
                      >
                        <Power className={`h-4 w-4 mr-2 ${asset.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                        {asset.isActive ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeletingAsset(asset)}
                        disabled={isLoading}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Asset
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAsset} onOpenChange={(open) => !open && setDeletingAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the asset "{deletingAsset?.itemCode} - {deletingAsset?.description}"? 
              This action cannot be undone and will fail if the asset has active deployments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {Math.ceil(assetsData.totalCount / 10) > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentFilters.page - 1) * 10) + 1} to{' '}
            {Math.min(currentFilters.page * 10, assetsData.totalCount)} of{' '}
            {assetsData.totalCount} assets
          </div>
          
          <div className="flex gap-2">
            {currentFilters.page > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentFilters.page - 1)}
              >
                Previous
              </Button>
            )}
            
            {currentFilters.page < Math.ceil(assetsData.totalCount / 10) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentFilters.page + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      {/* QR Code Scanner */}
      <QRCodeScanner
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        businessUnitId={businessUnitId}
      />
    </div>
  )
}