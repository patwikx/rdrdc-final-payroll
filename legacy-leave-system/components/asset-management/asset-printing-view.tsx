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
  Printer,
  CheckSquare,
  X,
  Package,
  QrCode,
  MapPin,
  User,
  Hash,
  Tag,
  Activity
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { AssetsResponse } from "@/lib/actions/asset-management-actions"
import { AssetStatus } from "@prisma/client"
import { toast } from "sonner"

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

interface AssetPrintingViewProps {
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

export function AssetPrintingView({ 
  assetsData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: AssetPrintingViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())


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
    
    router.push(`/${businessUnitId}/asset-management/asset-printing?${params.toString()}`)
  }

  const handleSearch = () => {
    updateFilter('search', searchTerm || undefined)
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/${businessUnitId}/asset-management/asset-printing?${params.toString()}`)
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

  const handlePrintPreview = () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to print")
      return
    }
    
    // Navigate to print preview page with selected asset IDs
    const assetIds = Array.from(selectedAssets).join(',')
    router.push(`/${businessUnitId}/asset-management/asset-printing/preview?assets=${assetIds}`)
  }



  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Asset QR Code Printing</h1>
          <p className="text-sm text-muted-foreground">
            Select assets to print their QR codes for {businessUnit.name}
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
              <Button onClick={handlePrintPreview}>
                <Printer className="h-4 w-4 mr-2" />
                Print Preview
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
          onValueChange={(value) => updateFilter('categoryId', value || undefined)}
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
          Showing {assetsData.assets.length} of {assetsData.totalCount} assets (Page {currentFilters.page} of {Math.ceil(assetsData.totalCount / 10)})
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
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>QR Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No assets match your search criteria" : "No assets found"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search criteria or category filter
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
                    <div className="flex items-center gap-1">
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        Ready to Print
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
              <QrCode className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No assets match your search criteria" : "No assets found"}
              </p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Try adjusting your search criteria or category filter
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
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        Ready to Print
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

                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
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
                    <span className="text-muted-foreground">Assigned To:</span>
                    {asset.currentDeployment ? (
                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs">{asset.currentDeployment.employee.name}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Unassigned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
    </div>
  )
}

// Removed AssetSelectionCard - now using table layout