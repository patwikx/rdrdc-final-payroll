"use client"

import { useState, useEffect } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Archive, Loader2, AlertTriangle, Package } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  retireAssets, 
  RetirableAssetData,
  RetireAssetsData,
  getAvailableReplacementAssets
} from "@/lib/actions/asset-retirement-actions"
import { RETIREMENT_REASONS, RETIREMENT_METHODS, ASSET_CONDITIONS } from "@/lib/constants/asset-retirement-constants"

interface AssetRetirementDialogProps {
  assets: RetirableAssetData[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetRetirementDialog({
  assets,
  businessUnitId,
  open,
  onOpenChange,
  onSuccess
}: AssetRetirementDialogProps) {
  const [retirementDate, setRetirementDate] = useState<Date>(new Date())
  const [reason, setReason] = useState<string>("")
  const [retirementMethod, setRetirementMethod] = useState("")
  const [condition, setCondition] = useState("")
  const [notes, setNotes] = useState("")
  const [replacementAssetId, setReplacementAssetId] = useState("")
  const [disposalPlanned, setDisposalPlanned] = useState(false)
  const [disposalDate, setDisposalDate] = useState<Date | undefined>()
  const [approvedBy, setApprovedBy] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Replacement assets
  const [replacementAssets, setReplacementAssets] = useState<any[]>([])
  const [isLoadingReplacements, setIsLoadingReplacements] = useState(false)

  // Load replacement assets
  useEffect(() => {
    if (open) {
      loadReplacementAssets()
    }
  }, [open, businessUnitId])

  const loadReplacementAssets = async () => {
    setIsLoadingReplacements(true)
    try {
      const assets = await getAvailableReplacementAssets(businessUnitId)
      setReplacementAssets(assets)
    } catch (error) {
      console.error("Error loading replacement assets:", error)
      toast.error("Failed to load replacement assets")
    } finally {
      setIsLoadingReplacements(false)
    }
  }

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a retirement reason")
      return
    }

    if (disposalPlanned && !disposalDate) {
      toast.error("Please select a disposal date when disposal is planned")
      return
    }

    setIsLoading(true)
    try {
      const retirementData: RetireAssetsData = {
        assetIds: assets.map(asset => asset.id),
        retirementDate,
        reason: reason as any,
        retirementMethod: retirementMethod || undefined,
        condition: condition || undefined,
        notes: notes || undefined,
        replacementAssetId: replacementAssetId || undefined,
        disposalPlanned,
        disposalDate: disposalPlanned ? disposalDate : undefined,
        approvedBy: approvedBy || undefined,
        businessUnitId
      }

      const result = await retireAssets(retirementData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error retiring assets:", error)
      toast.error("Failed to retire assets")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setRetirementDate(new Date())
    setReason("")
    setRetirementMethod("")
    setCondition("")
    setNotes("")
    setReplacementAssetId("")
    setDisposalPlanned(false)
    setDisposalDate(undefined)
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

  // Calculate totals
  const totalBookValue = assets.reduce((sum, asset) => sum + (asset.currentBookValue || 0), 0)
  const totalPurchaseValue = assets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0)
  const fullyDepreciatedCount = assets.filter(asset => asset.isFullyDepreciated).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Retire Assets
          </DialogTitle>
          <DialogDescription>
            Retire {assets.length} selected asset{assets.length > 1 ? 's' : ''} from active service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning for deployed assets */}
          {hasDeployedAssets && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Notice: Deployed Assets</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {deployedAssets.length} asset{deployedAssets.length > 1 ? 's are' : ' is'} currently deployed and will be automatically returned:
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
                    {asset.isFullyDepreciated && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1 rounded">
                        Fully Depreciated
                      </span>
                    )}
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
                <span className="text-muted-foreground">Fully Depreciated:</span>
                <div className="font-mono">{fullyDepreciatedCount} of {assets.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Remaining Value:</span>
                <div className="font-mono">₱{totalBookValue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Retirement Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Retirement Date */}
            <div className="space-y-2">
              <Label>Retirement Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !retirementDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {retirementDate ? format(retirementDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={retirementDate}
                    onSelect={(date) => date && setRetirementDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Retirement Reason */}
            <div className="space-y-2">
              <Label htmlFor="retirement-reason">Retirement Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select retirement reason" />
                </SelectTrigger>
                <SelectContent>
                  {RETIREMENT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Retirement Method */}
            <div className="space-y-2">
              <Label htmlFor="retirement-method">Retirement Method</Label>
              <Select value={retirementMethod} onValueChange={setRetirementMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select retirement method (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {RETIREMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Condition */}
            <div className="space-y-2">
              <Label htmlFor="condition">Asset Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset condition (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map((condition) => (
                    <SelectItem key={condition.value} value={condition.value}>
                      {condition.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Replacement Asset */}
            <div className="space-y-2">
              <Label htmlFor="replacement-asset">Replacement Asset</Label>
              <Select value={replacementAssetId} onValueChange={setReplacementAssetId} disabled={isLoadingReplacements}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingReplacements ? "Loading assets..." : "Select replacement asset (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No replacement asset</SelectItem>
                  {replacementAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{asset.itemCode} - {asset.description}</span>
                          <span className="text-xs text-muted-foreground">{asset.category.name}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Disposal Planning */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="disposal-planned" 
                checked={disposalPlanned}
                onCheckedChange={(checked) => setDisposalPlanned(checked === true)}
              />
              <Label htmlFor="disposal-planned">Plan for future disposal</Label>
            </div>

            {disposalPlanned && (
              <div className="space-y-2 ml-6">
                <Label>Planned Disposal Date</Label>
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
                      {disposalDate ? format(disposalDate, "PPP") : <span>Pick a disposal date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={disposalDate}
                      onSelect={setDisposalDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about this retirement..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Retire Assets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}