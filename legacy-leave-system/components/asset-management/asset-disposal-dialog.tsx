"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  disposeAssets, 
  DisposableAssetData,
  DisposeAssetsData
} from "@/lib/actions/asset-disposal-actions"
import { DISPOSAL_METHODS, DISPOSAL_REASONS } from "@/lib/constants/asset-disposal-constants"

interface AssetDisposalDialogProps {
  assets: DisposableAssetData[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetDisposalDialog({
  assets,
  businessUnitId,
  open,
  onOpenChange,
  onSuccess
}: AssetDisposalDialogProps) {
  const [disposalDate, setDisposalDate] = useState<Date>(new Date())
  const [disposalMethod, setDisposalMethod] = useState<string>("")
  const [disposalLocation, setDisposalLocation] = useState("")
  const [disposalValue, setDisposalValue] = useState("")
  const [disposalCost, setDisposalCost] = useState("")
  const [disposalReason, setDisposalReason] = useState<string>("")
  const [disposalNotes, setDisposalNotes] = useState("")
  const [approvedBy, setApprovedBy] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Calculate totals
  const totalBookValue = assets.reduce((sum, asset) => sum + (asset.currentBookValue || 0), 0)
  const totalPurchaseValue = assets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0)
  const disposalValueNum = parseFloat(disposalValue) || 0
  const disposalCostNum = parseFloat(disposalCost) || 0
  const netDisposalValue = disposalValueNum - disposalCostNum
  const estimatedGainLoss = netDisposalValue - totalBookValue

  const handleSubmit = async () => {
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
      const disposalData: DisposeAssetsData = {
        assetIds: assets.map(asset => asset.id),
        disposalDate,
        disposalMethod: disposalMethod as any,
        disposalLocation: disposalLocation || undefined,
        disposalValue: disposalValueNum || undefined,
        disposalCost: disposalCostNum || undefined,
        disposalReason: disposalReason as any,
        disposalNotes: disposalNotes || undefined,
        approvedBy: approvedBy || undefined,
        businessUnitId
      }

      const result = await disposeAssets(disposalData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error disposing assets:", error)
      toast.error("Failed to dispose assets")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setDisposalDate(new Date())
    setDisposalMethod("")
    setDisposalLocation("")
    setDisposalValue("")
    setDisposalCost("")
    setDisposalReason("")
    setDisposalNotes("")
    setApprovedBy("")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  // Check if any assets are currently deployed
  const deployedAssets = assets.filter(asset => asset.status === 'DEPLOYED')
  const hasDeployedAssets = deployedAssets.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Dispose Assets
          </DialogTitle>
          <DialogDescription>
            Permanently dispose {assets.length} selected asset{assets.length > 1 ? 's' : ''}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning for deployed assets */}
          {hasDeployedAssets && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Warning: Deployed Assets</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {deployedAssets.length} asset{deployedAssets.length > 1 ? 's are' : ' is'} currently deployed and must be returned before disposal:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                    {deployedAssets.map(asset => (
                      <li key={asset.id} className="font-mono">
                        • {asset.itemCode} - {asset.assignedEmployee?.name} ({asset.assignedEmployee?.employeeId})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Selected Assets Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Assets ({assets.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{asset.itemCode}</span>
                    <span className="text-muted-foreground truncate">{asset.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Book: ₱{(asset.currentBookValue || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <h4 className="font-medium">Financial Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Purchase Value:</span>
                <div className="font-mono">₱{totalPurchaseValue.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Book Value:</span>
                <div className="font-mono">₱{totalBookValue.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Net Disposal Value:</span>
                <div className="font-mono">₱{netDisposalValue.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Gain/Loss:</span>
                <div className={`font-mono ${estimatedGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {estimatedGainLoss >= 0 ? '+' : ''}₱{estimatedGainLoss.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Disposal Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Disposal Date */}
            <div className="space-y-2">
              <Label>Disposal Date</Label>
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
                    {disposalDate ? format(disposalDate, "PPP") : <span>Pick a date</span>}
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
              <Label htmlFor="disposal-method">Disposal Method *</Label>
              <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                <SelectTrigger className="w-full">
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
              <Label htmlFor="disposal-reason">Disposal Reason *</Label>
              <Select value={disposalReason} onValueChange={setDisposalReason}>
                <SelectTrigger className="w-full">
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
              <Label htmlFor="disposal-location">Disposal Location</Label>
              <Input
                id="disposal-location"
                value={disposalLocation}
                onChange={(e) => setDisposalLocation(e.target.value)}
                placeholder="e.g., Scrap yard, Donation center, etc."
              />
            </div>

            {/* Approved By */}
            <div className="space-y-2">
              <Label htmlFor="approved-by">Approved By</Label>
              <Input
                id="approved-by"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Name of approving authority"
              />
            </div>

            {/* Disposal Value */}
            <div className="space-y-2">
              <Label htmlFor="disposal-value">Disposal Value (₱)</Label>
              <Input
                id="disposal-value"
                type="number"
                min="0"
                step="0.01"
                value={disposalValue}
                onChange={(e) => setDisposalValue(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Disposal Cost */}
            <div className="space-y-2">
              <Label htmlFor="disposal-cost">Disposal Cost (₱)</Label>
              <Input
                id="disposal-cost"
                type="number"
                min="0"
                step="0.01"
                value={disposalCost}
                onChange={(e) => setDisposalCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Disposal Notes */}
          <div className="space-y-2">
            <Label htmlFor="disposal-notes">Additional Notes</Label>
            <Textarea
              id="disposal-notes"
              value={disposalNotes}
              onChange={(e) => setDisposalNotes(e.target.value)}
              placeholder="Any additional information about this disposal..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || hasDeployedAssets}
            variant="destructive"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dispose Assets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}