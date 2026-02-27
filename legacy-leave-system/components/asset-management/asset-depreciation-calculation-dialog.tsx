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
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Calculator, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  calculateDepreciation, 
  DepreciationAssetData,
  CalculateDepreciationData
} from "@/lib/actions/asset-depreciation-actions"

interface AssetDepreciationCalculationDialogProps {
  assets: DepreciationAssetData[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetDepreciationCalculationDialog({
  assets,
  businessUnitId,
  open,
  onOpenChange,
  onSuccess
}: AssetDepreciationCalculationDialogProps) {
  const [calculationDate, setCalculationDate] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const calculationData: CalculateDepreciationData = {
        assetIds: assets.map(asset => asset.id),
        calculationDate,
        businessUnitId
      }

      const result = await calculateDepreciation(calculationData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error calculating depreciation:", error)
      toast.error("Failed to calculate depreciation")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setCalculationDate(new Date())
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  // Check for assets that might not need depreciation
  const fullyDepreciatedAssets = assets.filter(asset => asset.isFullyDepreciated)
  const assetsWithoutDepreciationSetup = assets.filter(asset => 
    !asset.depreciationStartDate || !asset.monthlyDepreciation)
  const assetsNeedingCalculation = assets.filter(asset => 
    !asset.isFullyDepreciated && 
    asset.depreciationStartDate && 
    asset.monthlyDepreciation &&
    asset.monthlyDepreciation > 0 &&
    (!asset.nextDepreciationDate || new Date(asset.nextDepreciationDate) <= calculationDate))

  // Calculate estimated total depreciation
  const estimatedTotalDepreciation = assetsNeedingCalculation.reduce((sum, asset) => 
    sum + (asset.monthlyDepreciation || 0), 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculate Depreciation
          </DialogTitle>
          <DialogDescription>
            Calculate depreciation for {assets.length} selected asset{assets.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warnings */}
          {fullyDepreciatedAssets.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Fully Depreciated Assets</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {fullyDepreciatedAssets.length} asset{fullyDepreciatedAssets.length > 1 ? 's are' : ' is'} already fully depreciated:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                    {fullyDepreciatedAssets.slice(0, 5).map(asset => (
                      <li key={asset.id} className="font-mono">
                        • {asset.itemCode} - {asset.description}
                      </li>
                    ))}
                    {fullyDepreciatedAssets.length > 5 && (
                      <li className="text-xs">... and {fullyDepreciatedAssets.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {assetsWithoutDepreciationSetup.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 dark:text-red-200">Depreciation Setup Required</h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {assetsWithoutDepreciationSetup.length} asset{assetsWithoutDepreciationSetup.length > 1 ? 's need' : ' needs'} depreciation setup:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
                    {assetsWithoutDepreciationSetup.slice(0, 5).map(asset => (
                      <li key={asset.id} className="font-mono">
                        • {asset.itemCode} - Missing {!asset.depreciationStartDate ? 'start date' : 'depreciation amount'}
                      </li>
                    ))}
                    {assetsWithoutDepreciationSetup.length > 5 && (
                      <li className="text-xs">... and {assetsWithoutDepreciationSetup.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Selected Assets Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assets Ready for Calculation ({assetsNeedingCalculation.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
              {assetsNeedingCalculation.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{asset.itemCode}</span>
                    <span className="text-muted-foreground truncate">{asset.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Monthly: ₱{(asset.monthlyDepreciation || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <h4 className="font-medium">Calculation Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Assets to Calculate:</span>
                <div className="font-mono">{assetsNeedingCalculation.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Depreciation:</span>
                <div className="font-mono">₱{estimatedTotalDepreciation.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Fully Depreciated:</span>
                <div className="font-mono">{fullyDepreciatedAssets.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Setup Required:</span>
                <div className="font-mono">{assetsWithoutDepreciationSetup.length}</div>
              </div>
            </div>
          </div>

          {/* Calculation Date */}
          <div className="space-y-2">
            <Label>Calculation Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !calculationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {calculationDate ? format(calculationDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={calculationDate}
                  onSelect={(date) => date && setCalculationDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Method Breakdown */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Depreciation Methods</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION', 'SUM_OF_YEARS_DIGITS'].map(method => {
                const count = assetsNeedingCalculation.filter(asset => asset.depreciationMethod === method).length
                if (count === 0) return null
                return (
                  <div key={method} className="p-2 border rounded">
                    <p className="font-medium">{method.replace('_', ' ')}</p>
                    <p className="text-muted-foreground">{count} assets</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || assetsNeedingCalculation.length === 0}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Calculate Depreciation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}