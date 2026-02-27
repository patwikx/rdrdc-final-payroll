"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  CalendarIcon, 
  Trash2, 
  ArrowLeft, 
  AlertTriangle,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  disposeAssets, 
  DisposableAssetData,
  DisposeAssetsData,
  DisposableAssetsResponse
} from "@/lib/actions/asset-disposal-actions"
import { DISPOSAL_METHODS, DISPOSAL_REASONS } from "@/lib/constants/asset-disposal-constants"

interface AssetDisposalCreateViewProps {
  disposableAssetsData: DisposableAssetsResponse
  businessUnitId: string
  preSelectedAssetIds: string[]
}

export function AssetDisposalCreateView({
  disposableAssetsData,
  businessUnitId,
  preSelectedAssetIds
}: AssetDisposalCreateViewProps) {
  const router = useRouter()
  
  // Form state
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set(preSelectedAssetIds))
  const [disposalDate, setDisposalDate] = useState<Date>(new Date())
  const [disposalMethod, setDisposalMethod] = useState<string>("")
  const [disposalLocation, setDisposalLocation] = useState("")
  const [disposalValue, setDisposalValue] = useState("")
  const [disposalCost, setDisposalCost] = useState("")
  const [disposalReason, setDisposalReason] = useState<string>("")
  const [disposalNotes, setDisposalNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleAssetToggle = (assetId: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId)
    } else {
      newSelected.add(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleSubmit = async () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to dispose")
      return
    }

    if (!disposalMethod) {
      toast.error("Please select a disposal method")
      return
    }

    if (!disposalReason) {
      toast.error("Disposal reason is required")
      return
    }

    setIsLoading(true)
    try {
      const disposalValueNum = parseFloat(disposalValue) || 0
      const disposalCostNum = parseFloat(disposalCost) || 0

      const disposalData: DisposeAssetsData = {
        assetIds: Array.from(selectedAssets),
        disposalDate,
        disposalMethod: disposalMethod as any,
        disposalLocation: disposalLocation || undefined,
        disposalValue: disposalValueNum || undefined,
        disposalCost: disposalCostNum || undefined,
        disposalReason: disposalReason as any,
        disposalNotes: disposalNotes || undefined,
        businessUnitId
      }

      const result = await disposeAssets(disposalData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        router.push(`/${businessUnitId}/asset-management/retirements?tab=disposals`)
      }
    } catch (error) {
      console.error("Error disposing assets:", error)
      toast.error("Failed to dispose assets")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedAssetsList = disposableAssetsData.assets.filter(asset => 
    selectedAssets.has(asset.id)
  )

  // Calculate financial summary
  const totalBookValue = selectedAssetsList.reduce((sum, asset) => 
    sum + (asset.currentBookValue || 0), 0
  )
  const totalPurchaseValue = selectedAssetsList.reduce((sum, asset) => 
    sum + (asset.purchasePrice || 0), 0
  )
  const disposalValueNum = parseFloat(disposalValue) || 0
  const disposalCostNum = parseFloat(disposalCost) || 0
  const netDisposalValue = disposalValueNum - disposalCostNum
  const estimatedGainLoss = netDisposalValue - totalBookValue

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispose Assets</h1>
          <p className="text-sm text-muted-foreground">
            Permanently dispose of retired assets and record disposal details
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Asset Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Assets to Dispose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Book Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposableAssetsData.assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAssets.has(asset.id)}
                            onCheckedChange={() => handleAssetToggle(asset.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{asset.itemCode}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {asset.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {asset.currentBookValue ? 
                            `₱${asset.currentBookValue.toLocaleString()}` : 
                            'N/A'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {selectedAssets.size > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedAssets.size} asset{selectedAssets.size > 1 ? 's' : ''} selected
                    </span>
                    <span className="text-sm font-medium">
                      Total Book Value: ₱{totalBookValue.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disposal Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Disposal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Disposal Date */}
            <div className="space-y-2">
              <Label>Disposal Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !disposalDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {disposalDate ? format(disposalDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={disposalDate}
                    onSelect={(date) => date && setDisposalDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Disposal Method */}
            <div className="space-y-2">
              <Label>Disposal Method *</Label>
              <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select disposal method" />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSAL_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Disposal Reason */}
            <div className="space-y-2">
              <Label>Disposal Reason *</Label>
              <Select value={disposalReason} onValueChange={setDisposalReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select disposal reason" />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSAL_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Disposal Location */}
            <div className="space-y-2">
              <Label>Disposal Location</Label>
              <Input
                placeholder="Where the disposal took place"
                value={disposalLocation}
                onChange={(e) => setDisposalLocation(e.target.value)}
              />
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disposal Value (₱)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={disposalValue}
                  onChange={(e) => setDisposalValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Disposal Cost (₱)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={disposalCost}
                  onChange={(e) => setDisposalCost(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes about the disposal..."
                value={disposalNotes}
                onChange={(e) => setDisposalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      {selectedAssets.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">₱{totalPurchaseValue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Original Purchase Value</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">₱{totalBookValue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Current Book Value</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">₱{netDisposalValue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Net Disposal Value</div>
              </div>
              <div className={cn(
                "text-center p-3 rounded-lg",
                estimatedGainLoss >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
              )}>
                <div className={cn(
                  "text-lg font-bold flex items-center justify-center gap-1",
                  estimatedGainLoss >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {estimatedGainLoss >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  ₱{Math.abs(estimatedGainLoss).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Estimated {estimatedGainLoss >= 0 ? 'Gain' : 'Loss'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || selectedAssets.size === 0}
          variant="destructive"
        >
          {isLoading ? "Disposing..." : `Dispose ${selectedAssets.size} Asset${selectedAssets.size > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  )
}