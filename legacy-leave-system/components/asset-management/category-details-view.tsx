"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft,
  Package,
  User,
  MapPin,
  DollarSign,
  Eye,
  Edit,
  MoreHorizontal,
  Building2,
  Hash,
  FileText,
  Loader2,
  Save,
  X
} from "lucide-react"
import { toast } from "sonner"
import { updateAssetCategory } from "@/lib/actions/asset-categories-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { AssetStatus } from "@prisma/client"

interface CategoryDetailsViewProps {
  category: any
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  glAccounts?: Array<{
    id: string
    accountCode: string
    accountName: string
    accountType: string
  }>
}

export function CategoryDetailsView({
  category,
  businessUnit,
  businessUnitId,
  glAccounts = []
}: CategoryDetailsViewProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm({
    defaultValues: {
      name: category.name,
      code: category.code,
      description: category.description || "",
      isActive: category.isActive,
      defaultAssetAccountId: category.defaultAssetAccountId || "none",
      defaultDepreciationExpenseAccountId: category.defaultDepreciationExpenseAccountId || "none",
      defaultAccumulatedDepAccountId: category.defaultAccumulatedDepAccountId || "none"
    }
  })

  const handleSave = async (data: any) => {
    setIsSaving(true)
    try {
      const processedData = {
        ...data,
        defaultAssetAccountId: data.defaultAssetAccountId === "none" ? null : data.defaultAssetAccountId,
        defaultDepreciationExpenseAccountId: data.defaultDepreciationExpenseAccountId === "none" ? null : data.defaultDepreciationExpenseAccountId,
        defaultAccumulatedDepAccountId: data.defaultAccumulatedDepAccountId === "none" ? null : data.defaultAccumulatedDepAccountId,
        businessUnitId
      }
      
      const result = await updateAssetCategory(category.id, processedData, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        setIsEditing(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update category")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    form.reset()
    setIsEditing(false)
  }

  const getAssetStatusColor = (status: AssetStatus): "default" | "secondary" | "destructive" | "outline" => {
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

  const formatAssetStatus = (status: AssetStatus): string => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  const totalValue = category.assets?.reduce((sum: number, asset: any) => {
    return sum + (Number(asset.purchasePrice) || 0)
  }, 0) || 0

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const statusCounts = category.assets?.reduce((acc: any, asset: any) => {
    acc[asset.status] = (acc[asset.status] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              Category details for {businessUnit.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant={category.isActive ? "default" : "secondary"}>
            {category.isActive ? "Active" : "Inactive"}
          </Badge>
          
          <Button 
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {isEditing ? 'Cancel Edit' : 'Edit Category'}
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold">{category.assets?.length || 0}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold">{statusCounts.AVAILABLE || 0}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Deployed</p>
            <p className="text-2xl font-bold">{statusCounts.DEPLOYED || 0}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="assets">Assets ({category.assets?.length || 0})</TabsTrigger>
          <TabsTrigger value="accounts">Account Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {isEditing ? (
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Edit Category</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Category Name *</Label>
                    <Input
                      id="name"
                      {...form.register('name', { required: 'Name is required' })}
                      placeholder="e.g., Computer Equipment"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Category Code *</Label>
                    <Input
                      id="code"
                      {...form.register('code', { required: 'Code is required' })}
                      placeholder="e.g., COMP"
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      placeholder="Optional description..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={form.watch('isActive')}
                      onCheckedChange={(checked) => form.setValue('isActive', checked)}
                    />
                    <Label htmlFor="isActive">Active (category is available for use)</Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Default GL Accounts</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultAssetAccountId">Asset Account</Label>
                      <Select
                        value={form.watch('defaultAssetAccountId')}
                        onValueChange={(value) => form.setValue('defaultAssetAccountId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select asset account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No account selected</SelectItem>
                          {glAccounts.filter(acc => acc.accountType === 'ASSET').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultDepreciationExpenseAccountId">Depreciation Expense Account</Label>
                      <Select
                        value={form.watch('defaultDepreciationExpenseAccountId')}
                        onValueChange={(value) => form.setValue('defaultDepreciationExpenseAccountId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No account selected</SelectItem>
                          {glAccounts.filter(acc => acc.accountType === 'EXPENSE').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultAccumulatedDepAccountId">Accumulated Depreciation Account</Label>
                      <Select
                        value={form.watch('defaultAccumulatedDepAccountId')}
                        onValueChange={(value) => form.setValue('defaultAccumulatedDepAccountId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select accumulated depreciation account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No account selected</SelectItem>
                          {glAccounts.filter(acc => acc.accountType === 'ASSET').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Category Information</h3>
                </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Category Name</p>
                      <p className="text-sm font-semibold">{category.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Category Code</p>
                      <Badge variant="outline" className="font-mono">
                        {category.code}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="text-sm">{category.description || 'No description provided'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge variant={category.isActive ? "default" : "secondary"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created</p>
                      <p className="text-sm">{format(new Date(category.createdAt), 'PPP')}</p>
                    </div>
                  </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Asset Statistics</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={getAssetStatusColor(status as AssetStatus)}>
                          {formatAssetStatus(status as AssetStatus)}
                        </Badge>
                      </div>
                      <span className="font-semibold">{count as number}</span>
                    </div>
                  ))}
                </div>

                {category.assets?.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Average Value:</span>
                      <span className="font-medium">
                        {formatCurrency(Math.round(totalValue / category.assets.length))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!category.assets || category.assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No assets found in this category</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  category.assets.map((asset: any) => (
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
                        {asset.purchasePrice ? (
                          <div className="flex items-center gap-1 text-sm">
                            <span>{formatCurrency(Number(asset.purchasePrice))}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not specified</span>
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
                            <DropdownMenuItem 
                              onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Asset
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
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Default Account Settings</h3>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Asset Account</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {category.defaultAssetAccount || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Depreciation Account</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {category.defaultDepreciationAccount || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Expense Account</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {category.defaultExpenseAccount || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Useful Life (Years)</p>
                  <p className="text-sm bg-muted p-2 rounded">
                    {category.defaultUsefulLife ? `${category.defaultUsefulLife} years` : 'Not configured'}
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  These default settings are applied to new assets created in this category.
                  Individual assets can override these settings.
                </p>
              </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}