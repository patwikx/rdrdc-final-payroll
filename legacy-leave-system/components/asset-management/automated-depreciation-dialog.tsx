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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Calculator, Loader2, Eye, Play, BarChart3 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  runAutomatedDepreciation, 
  getDepreciationSchedulePreview,
  AutomatedDepreciationConfig,
  AutomatedDepreciationResult
} from "@/lib/actions/automated-depreciation-actions"

interface AutomatedDepreciationDialogProps {
  businessUnitId: string
  categories: { id: string; name: string; count: number }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AutomatedDepreciationDialog({
  businessUnitId,
  categories,
  open,
  onOpenChange,
  onSuccess
}: AutomatedDepreciationDialogProps) {
  const [calculationDate, setCalculationDate] = useState<Date>(new Date())
  const [period, setPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'>('MONTHLY')
  const [includeCategories, setIncludeCategories] = useState<string[]>([])
  const [excludeCategories, setExcludeCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewResult, setPreviewResult] = useState<AutomatedDepreciationResult | null>(null)

  const handlePreview = async () => {
    setIsLoading(true)
    setIsPreviewMode(true)
    try {
      const config: AutomatedDepreciationConfig = {
        businessUnitId,
        calculationDate,
        period,
        includeCategories: includeCategories.length > 0 ? includeCategories : undefined,
        excludeCategories: excludeCategories.length > 0 ? excludeCategories : undefined,
        dryRun: true
      }

      const result = await getDepreciationSchedulePreview(config)
      setPreviewResult(result)
    } catch (error) {
      console.error("Error generating preview:", error)
      toast.error("Failed to generate preview")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!previewResult) {
      toast.error("Please generate a preview first")
      return
    }

    setIsLoading(true)
    try {
      const config: AutomatedDepreciationConfig = {
        businessUnitId,
        calculationDate,
        period,
        includeCategories: includeCategories.length > 0 ? includeCategories : undefined,
        excludeCategories: excludeCategories.length > 0 ? excludeCategories : undefined,
        dryRun: false
      }

      const result = await runAutomatedDepreciation(config)
      
      toast.success(
        `Automated depreciation completed! Processed ${result.successfulCalculations} assets with total depreciation of ₱${result.totalDepreciationAmount.toLocaleString()}`
      )
      
      onSuccess()
    } catch (error) {
      console.error("Error executing automated depreciation:", error)
      toast.error("Failed to execute automated depreciation")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setCalculationDate(new Date())
    setPeriod('MONTHLY')
    setIncludeCategories([])
    setExcludeCategories([])
    setPreviewResult(null)
    setIsPreviewMode(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleCategoryInclude = (categoryId: string, checked: boolean) => {
    if (checked) {
      setIncludeCategories(prev => [...prev, categoryId])
      setExcludeCategories(prev => prev.filter(id => id !== categoryId))
    } else {
      setIncludeCategories(prev => prev.filter(id => id !== categoryId))
    }
  }

  const handleCategoryExclude = (categoryId: string, checked: boolean) => {
    if (checked) {
      setExcludeCategories(prev => [...prev, categoryId])
      setIncludeCategories(prev => prev.filter(id => id !== categoryId))
    } else {
      setExcludeCategories(prev => prev.filter(id => id !== categoryId))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Automated Depreciation Schedule
          </DialogTitle>
          <DialogDescription>
            Run automated depreciation calculation for multiple assets based on schedule
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!isPreviewMode ? (
            // Configuration Form
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Period */}
                <div className="space-y-2">
                  <Label htmlFor="period">Depreciation Period</Label>
                  <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="ANNUALLY">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category Filters */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Category Filters (Optional)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Include Only These Categories</Label>
                    <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-2">
                      {categories.map((category) => (
                        <div key={`include-${category.id}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`include-${category.id}`}
                            checked={includeCategories.includes(category.id)}
                            onCheckedChange={(checked) => handleCategoryInclude(category.id, checked === true)}
                          />
                          <Label htmlFor={`include-${category.id}`} className="text-sm">
                            {category.name} ({category.count} assets)
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Exclude These Categories</Label>
                    <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-2">
                      {categories.map((category) => (
                        <div key={`exclude-${category.id}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exclude-${category.id}`}
                            checked={excludeCategories.includes(category.id)}
                            onCheckedChange={(checked) => handleCategoryExclude(category.id, checked === true)}
                          />
                          <Label htmlFor={`exclude-${category.id}`} className="text-sm">
                            {category.name} ({category.count} assets)
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Summary */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Configuration Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Period:</span>
                    <div className="font-mono">{period}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <div className="font-mono">{format(calculationDate, 'MMM dd, yyyy')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Include Categories:</span>
                    <div className="font-mono">{includeCategories.length || 'All'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exclude Categories:</span>
                    <div className="font-mono">{excludeCategories.length || 'None'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Preview Results
            <div className="space-y-4">
              {previewResult && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold">{previewResult.totalAssetsProcessed}</div>
                      <div className="text-sm text-muted-foreground">Total Assets</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{previewResult.successfulCalculations}</div>
                      <div className="text-sm text-muted-foreground">Will Calculate</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold">₱{previewResult.totalDepreciationAmount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Depreciation</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{previewResult.assetsWithoutSetup}</div>
                      <div className="text-sm text-muted-foreground">Need Setup</div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  {previewResult.summary.byCategory.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">By Category</Label>
                      <div className="space-y-2">
                        {previewResult.summary.byCategory.map((category) => (
                          <div key={category.categoryId} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{category.categoryName}</span>
                            <div className="text-right">
                              <div className="text-sm font-mono">₱{category.totalDepreciation.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">{category.assetsCount} assets</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Asset Details (first 10) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Asset Details (showing first 10)</Label>
                    <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-1">
                      {previewResult.details.slice(0, 10).map((detail) => (
                        <div key={detail.assetId} className="flex items-center justify-between text-sm p-2 border rounded">
                          <div>
                            <span className="font-mono">{detail.itemCode}</span>
                            <span className="text-muted-foreground ml-2">{detail.description}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-mono ${
                              detail.status === 'SUCCESS' ? 'text-green-600' : 
                              detail.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {detail.status === 'SUCCESS' ? `₱${detail.depreciationAmount.toLocaleString()}` : detail.status}
                            </div>
                            {detail.error && (
                              <div className="text-xs text-muted-foreground">{detail.error}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {previewResult.details.length > 10 && (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          ... and {previewResult.details.length - 10} more assets
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          {!isPreviewMode ? (
            <Button onClick={handlePreview} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsPreviewMode(false)} disabled={isLoading}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Back to Config
              </Button>
              <Button onClick={handleExecute} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Play className="mr-2 h-4 w-4" />
                Execute Depreciation
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}