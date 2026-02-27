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
  Undo2,
  CheckSquare,
  X,
  Package,
  Calendar,
  User,
  Hash,
  Tag,
  FileText,
  Clock
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { DeployedAssetsResponse } from "@/lib/actions/asset-return-actions"
import { AssetReturnDialog } from "./asset-return-dialog"
import { toast } from "sonner"
import { format } from "date-fns"



interface AssetReturnViewProps {
  deployedAssetsData: DeployedAssetsResponse
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    employeeId?: string
    search?: string
    page: number
  }
}

export function AssetReturnView({ 
  deployedAssetsData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: AssetReturnViewProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [showReturnDialog, setShowReturnDialog] = useState(false)

  const filteredAssets = useMemo(() => {
    if (!searchTerm) return deployedAssetsData.assets
    
    const term = searchTerm.toLowerCase()
    return deployedAssetsData.assets.filter(asset => 
      asset.itemCode.toLowerCase().includes(term) ||
      asset.description.toLowerCase().includes(term) ||
      asset.serialNumber?.toLowerCase().includes(term) ||
      asset.brand?.toLowerCase().includes(term) ||
      asset.currentDeployment.employee.name.toLowerCase().includes(term) ||
      asset.currentDeployment.employee.employeeId.toLowerCase().includes(term)
    )
  }, [deployedAssetsData.assets, searchTerm])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.employeeId) params.set('employeeId', currentFilters.employeeId)
    
    router.push(`/${businessUnitId}/asset-management/returns?${params.toString()}`)
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

  const handleReturnAssets = () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to return")
      return
    }
    setShowReturnDialog(true)
  }

  const selectedAssetsData = useMemo(() => {
    return deployedAssetsData.assets.filter(asset => selectedAssets.has(asset.id))
  }, [deployedAssetsData.assets, selectedAssets])

  const handleReturnSuccess = () => {
    setSelectedAssets(new Set())
    setShowReturnDialog(false)
    // Refresh the page to show updated asset status
    router.refresh()
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Asset Returns</h1>
          <p className="text-sm text-muted-foreground">
            Return deployed assets for {businessUnit.name}
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
              <Button onClick={handleReturnAssets}>
                <Undo2 className="h-4 w-4 mr-2" />
                Return Assets
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
            placeholder="Search by item code, description, serial number, employee..."
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
          value={currentFilters.employeeId || "all"} 
          onValueChange={(value) => {
            const params = new URLSearchParams()
            if (searchTerm) params.set('search', searchTerm)
            if (value !== "all") params.set('employeeId', value)
            router.push(`/${businessUnitId}/asset-management/returns?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[250px]">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Employees" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {deployedAssetsData.employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name} ({employee.assetCount} assets)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredAssets.length} of {deployedAssetsData.totalCount} deployed assets
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
              <TableHead>Assigned To</TableHead>
              <TableHead>Deployed Date</TableHead>
              <TableHead>Expected Return</TableHead>
              <TableHead>Transmittal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No assets match your search criteria" : "No deployed assets found"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search criteria or employee filter
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => {
                const isOverdue = asset.currentDeployment.expectedReturnDate && 
                  new Date(asset.currentDeployment.expectedReturnDate) < new Date()
                
                return (
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
                      <Badge variant="outline">
                        {asset.category.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{asset.currentDeployment.employee.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {asset.currentDeployment.employee.employeeId}
                          {asset.currentDeployment.employee.department && (
                            <span> • {asset.currentDeployment.employee.department.name}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(asset.currentDeployment.deployedDate!), 'MMM dd, yyyy')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {asset.currentDeployment.expectedReturnDate ? (
                        <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-destructive' : ''}`}>
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(asset.currentDeployment.expectedReturnDate), 'MMM dd, yyyy')}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">
                        {asset.currentDeployment.transmittalNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                          {isOverdue ? "Overdue" : "Deployed"}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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
                {searchTerm ? "No assets match your search criteria" : "No deployed assets found"}
              </p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Try adjusting your search criteria or employee filter
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((asset) => {
            const isOverdue = asset.currentDeployment.expectedReturnDate && 
              new Date(asset.currentDeployment.expectedReturnDate) < new Date()
            
            return (
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
                      {asset.brand && (
                        <p className="text-xs text-muted-foreground">{asset.brand}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs">
                          {isOverdue ? "Overdue" : "Deployed"}
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{asset.currentDeployment.employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {asset.currentDeployment.employee.employeeId}
                          {asset.currentDeployment.employee.department && (
                            <span> • {asset.currentDeployment.employee.department.name}</span>
                          )}
                        </p>
                      </div>
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
                      <span className="text-muted-foreground">Deployed Date:</span>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs">{format(new Date(asset.currentDeployment.deployedDate!), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected Return:</span>
                      {asset.currentDeployment.expectedReturnDate ? (
                        <div className={`flex items-center gap-1 mt-1 ${isOverdue ? 'text-destructive' : ''}`}>
                          <Clock className="h-3 w-3" />
                          <p className="text-xs">{format(new Date(asset.currentDeployment.expectedReturnDate), 'MMM dd, yyyy')}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Not set</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transmittal:</span>
                      <p className="font-mono text-xs mt-1">
                        {asset.currentDeployment.transmittalNumber}
                      </p>
                    </div>
                  </div>

                  {asset.currentDeployment.deploymentNotes && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Notes: {asset.currentDeployment.deploymentNotes}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {deployedAssetsData.totalCount > 100 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentFilters.page - 1) * 100) + 1} to {Math.min(currentFilters.page * 100, deployedAssetsData.totalCount)} of {deployedAssetsData.totalCount} assets
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                if (searchTerm) params.set('search', searchTerm)
                if (currentFilters.employeeId) params.set('employeeId', currentFilters.employeeId)
                params.set('page', (currentFilters.page - 1).toString())
                router.push(`/${businessUnitId}/asset-management/returns?${params.toString()}`)
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
                if (currentFilters.employeeId) params.set('employeeId', currentFilters.employeeId)
                params.set('page', (currentFilters.page + 1).toString())
                router.push(`/${businessUnitId}/asset-management/returns?${params.toString()}`)
              }}
              disabled={currentFilters.page * 100 >= deployedAssetsData.totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Return Dialog */}
      {showReturnDialog && (
        <AssetReturnDialog
          assets={selectedAssetsData}
          businessUnitId={businessUnitId}
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  )
}

// Removed AssetReturnCard - now using table layout