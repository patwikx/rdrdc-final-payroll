"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Send,
  CheckSquare,
  X,
  Package,
  MapPin,
  Hash,
  Tag,
  Wrench
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { AssetsResponse } from "@/lib/actions/asset-management-actions"
import { AssetDeploymentDialog } from "./asset-deployment-dialog"
import { toast } from "sonner"

// Helper function for currency formatting
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

interface AssetDeploymentViewProps {
  assetsData: AssetsResponse
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    categoryId?: string
    search?: string
    page: number
  }
}

export function AssetDeploymentView({ 
  assetsData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: AssetDeploymentViewProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [showDeploymentDialog, setShowDeploymentDialog] = useState(false)

  const filteredAssets = useMemo(() => {
    if (!searchTerm) return assetsData.assets
    
    const term = searchTerm.toLowerCase()
    return assetsData.assets.filter(asset => 
      asset.itemCode.toLowerCase().includes(term) ||
      asset.description.toLowerCase().includes(term) ||
      asset.serialNumber?.toLowerCase().includes(term) ||
      asset.brand?.toLowerCase().includes(term)
    )
  }, [assetsData.assets, searchTerm])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
    
    router.push(`/${businessUnitId}/asset-management/deployments?${params.toString()}`)
  }

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    const newSelected = new Set(selectedAssets)
    if (checked) {
      newSelected.add(assetId)
    } else {
      newSelected.delete(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedAssets.size === filteredAssets.length) {
      // Deselect all
      setSelectedAssets(new Set())
    } else {
      // Select all visible assets
      setSelectedAssets(new Set(filteredAssets.map(asset => asset.id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedAssets(new Set())
  }

  const handleDeployAssets = () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to deploy")
      return
    }
    setShowDeploymentDialog(true)
  }

  const selectedAssetsData = useMemo(() => {
    return assetsData.assets.filter(asset => selectedAssets.has(asset.id))
  }, [assetsData.assets, selectedAssets])

  const handleDeploymentSuccess = () => {
    setSelectedAssets(new Set())
    setShowDeploymentDialog(false)
    // Refresh the page to show updated asset status
    router.refresh()
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Asset Deployment</h1>
          <p className="text-sm text-muted-foreground">
            Deploy assets to employees for {businessUnit.name}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {selectedAssets.size} selected
          </Badge>
          {selectedAssets.size > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearSelection}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button onClick={handleDeployAssets}>
                <Send className="h-4 w-4 mr-2" />
                Deploy Assets
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by item code, description, serial number, or brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
        
        <Select 
          value={currentFilters.categoryId || "all"} 
          onValueChange={(value) => {
            const params = new URLSearchParams()
            if (searchTerm) params.set('search', searchTerm)
            if (value !== "all") params.set('categoryId', value)
            router.push(`/${businessUnitId}/asset-management/deployments?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {assetsData.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name} ({category.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredAssets.length} of {assetsData.totalCount} available assets
        </div>
        {filteredAssets.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectedAssets.size === filteredAssets.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={filteredAssets.length > 0 && selectedAssets.size === filteredAssets.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all assets"
                />
              </TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Purchase Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No assets match your search criteria" : "No available assets found for deployment"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Assets must be ACTIVE and not currently deployed to appear here
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow 
                  key={asset.id}
                  className={`cursor-pointer ${selectedAssets.has(asset.id) ? 'bg-muted/50' : ''}`}
                  onClick={() => handleSelectAsset(asset.id, !selectedAssets.has(asset.id))}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedAssets.has(asset.id)}
                      onCheckedChange={(checked) => handleSelectAsset(asset.id, checked === true)}
                      aria-label={`Select ${asset.itemCode}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{asset.description}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {asset.serialNumber || <span className="text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {asset.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {asset.brand || <span className="text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{asset.location || "Not specified"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.purchasePrice ? (
                      <div className="flex items-center gap-1 text-sm">
                        <span>{formatCurrency(Number(asset.purchasePrice))}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <Badge variant="default" className="text-xs">
                        Available
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No assets match your search criteria" : "No available assets found for deployment"}
              </p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Assets must be ACTIVE and not currently deployed to appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((asset) => (
            <Card 
              key={asset.id} 
              className={`cursor-pointer transition-colors ${selectedAssets.has(asset.id) ? 'bg-muted/50 border-primary' : ''}`}
              onClick={() => handleSelectAsset(asset.id, !selectedAssets.has(asset.id))}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base font-mono">{asset.itemCode}</CardTitle>
                    </div>
                    <p className="text-sm font-medium">{asset.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <Badge variant="default" className="text-xs">
                        Available
                      </Badge>
                    </div>
                    <Checkbox
                      checked={selectedAssets.has(asset.id)}
                      onCheckedChange={(checked) => handleSelectAsset(asset.id, checked === true)}
                      aria-label={`Select ${asset.itemCode}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">
                    {asset.category.name}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Serial Number:</span>
                    <p className="font-mono text-xs mt-1">
                      {asset.serialNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Brand:</span>
                    <p className="font-medium mt-1">
                      {asset.brand || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs">{asset.location || "Not specified"}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Purchase Price:</span>
                    <p className="font-medium mt-1">
                      {asset.purchasePrice ? formatCurrency(Number(asset.purchasePrice)) : "Not specified"}
                    </p>
                  </div>
                </div>

                {(asset.modelNumber || asset.brand) && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {asset.brand && asset.modelNumber 
                          ? `${asset.brand} - ${asset.modelNumber}`
                          : asset.brand || asset.modelNumber
                        }
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {assetsData.totalCount > 100 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentFilters.page - 1) * 100) + 1} to {Math.min(currentFilters.page * 100, assetsData.totalCount)} of {assetsData.totalCount} assets
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                if (searchTerm) params.set('search', searchTerm)
                if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
                params.set('page', (currentFilters.page - 1).toString())
                router.push(`/${businessUnitId}/asset-management/deployments?${params.toString()}`)
              }}
              disabled={currentFilters.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                if (searchTerm) params.set('search', searchTerm)
                if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
                params.set('page', (currentFilters.page + 1).toString())
                router.push(`/${businessUnitId}/asset-management/deployments?${params.toString()}`)
              }}
              disabled={currentFilters.page * 100 >= assetsData.totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Deployment Dialog */}
      {showDeploymentDialog && (
        <AssetDeploymentDialog
          assets={selectedAssetsData}
          businessUnitId={businessUnitId}
          open={showDeploymentDialog}
          onOpenChange={setShowDeploymentDialog}
          onSuccess={handleDeploymentSuccess}
        />
      )}
    </div>
  )
}

// Removed AssetDeploymentCard - now using table layout