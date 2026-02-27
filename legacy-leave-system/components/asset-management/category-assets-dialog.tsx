"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Package, 
  Search, 
  ExternalLink,
  Building,
  MapPin,
  Calendar,
  DollarSign
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { 
  getCategoryAssets,
  AssetCategoryWithDetails
} from "@/lib/actions/asset-categories-actions"
import { AssetStatus } from "@prisma/client"

interface CategoryAssetsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: AssetCategoryWithDetails
  businessUnitId: string
}

interface CategoryAsset {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  status: AssetStatus
  purchasePrice: any | null
  purchaseDate: Date | null
  location: string | null
  department: {
    name: string
    code: string | null
  } | null
  businessUnit: {
    name: string
    code: string
  }
}

interface CategoryAssetsResponse {
  assets: CategoryAsset[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export function CategoryAssetsDialog({ 
  open, 
  onOpenChange, 
  category, 
  businessUnitId 
}: CategoryAssetsDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [assetsData, setAssetsData] = useState<CategoryAssetsResponse | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (open) {
      loadAssets(1)
    }
  }, [open, category.id])

  const loadAssets = async (page: number) => {
    setIsLoading(true)
    try {
      const data = await getCategoryAssets(category.id, businessUnitId, page, 10)
      setAssetsData(data as any)
      setCurrentPage(page)
    } catch (error) {
      console.error("Error loading category assets:", error)
      toast.error("Failed to load category assets")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: AssetStatus) => {
    const statusConfig = {
      AVAILABLE: { variant: "default" as const, label: "Available" },
      DEPLOYED: { variant: "secondary" as const, label: "Deployed" },
      IN_MAINTENANCE: { variant: "outline" as const, label: "Maintenance" },
      RETIRED: { variant: "secondary" as const, label: "Retired" },
      LOST: { variant: "destructive" as const, label: "Lost" },
      DAMAGED: { variant: "destructive" as const, label: "Damaged" },
      FULLY_DEPRECIATED: { variant: "outline" as const, label: "Fully Depreciated" },
      DISPOSED: { variant: "secondary" as const, label: "Disposed" }
    }

    const config = statusConfig[status] || { variant: "outline" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const handleViewAsset = (assetId: string) => {
    router.push(`/${businessUnitId}/asset-management/assets/${assetId}`)
    onOpenChange(false)
  }

  const filteredAssets = assetsData?.assets.filter(asset =>
    asset.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assets in Category: {category.name}
          </DialogTitle>
          <DialogDescription>
            View all assets belonging to the "{category.name}" category
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Category Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Code:</span>
                  <div className="font-medium">{category.code}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Assets:</span>
                  <div className="font-medium">{category._count.assets}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div className="font-medium">
                    {format(new Date(category.createdAt), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>
              {category.description && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-muted-foreground">Description:</span>
                  <div className="text-sm mt-1">{category.description}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search assets by item code, description, or serial number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Assets Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Assets ({assetsData?.totalCount || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading assets...</div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead className="w-[70px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? "No assets found matching your search" : "No assets in this category"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAssets.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell>
                              <div className="font-medium">{asset.itemCode}</div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px] truncate">
                                {asset.description}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">
                                {asset.serialNumber || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(asset.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Building className="h-3 w-3 text-muted-foreground" />
                                {asset.department?.name || "Unassigned"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {asset.location || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {asset.purchasePrice ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  {new Intl.NumberFormat('en-PH', {
                                    style: 'currency',
                                    currency: 'PHP'
                                  }).format(Number(asset.purchasePrice))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewAsset(asset.id)}
                                className="h-8 w-8 p-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Pagination */}
          {assetsData && assetsData.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, assetsData.totalCount)} of {assetsData.totalCount} assets
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAssets(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAssets(currentPage + 1)}
                  disabled={currentPage >= assetsData.totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}