"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Calculator, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { executeManualDepreciation, getAssetsNeedingDepreciation } from "@/lib/actions/depreciation-schedule-actions-simple"
import { format } from "date-fns"

interface ManualDepreciationDialogProps {
  businessUnitId: string
  categories: Array<{ id: string; name: string; count: number }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ManualDepreciationDialog({
  businessUnitId,
  categories,
  open,
  onOpenChange,
  onSuccess
}: ManualDepreciationDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'include' | 'exclude'>('all')
  const [previewData, setPreviewData] = useState<any>(null)
  const [executionResult, setExecutionResult] = useState<any>(null)

  const handlePreview = async () => {
    setIsLoading(true)
    setIsPreviewMode(true)
    
    try {
      const result = await getAssetsNeedingDepreciation(businessUnitId)
      setPreviewData(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview assets")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecute = async () => {
    setIsLoading(true)
    
    try {
      const config: any = {}
      
      if (categoryFilter === 'include' && selectedCategories.length > 0) {
        config.includeCategories = selectedCategories
      } else if (categoryFilter === 'exclude' && selectedCategories.length > 0) {
        config.excludeCategories = selectedCategories
      }

      const result = await executeManualDepreciation(businessUnitId, config)
      
      setExecutionResult(result)
      
      toast.success(
        `Depreciation completed! Processed ${result.totalAssetsProcessed} assets, ` +
        `calculated ₱${result.totalDepreciationAmount.toLocaleString()} in depreciation.`
      )
      
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to execute depreciation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    setSelectedCategories(prev => 
      checked 
        ? [...prev, categoryId]
        : prev.filter(id => id !== categoryId)
    )
  }

  const handleClose = () => {
    setIsPreviewMode(false)
    setPreviewData(null)
    setExecutionResult(null)
    setSelectedCategories([])
    setCategoryFilter('all')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Manual Depreciation Calculation
          </DialogTitle>
          <DialogDescription>
            Execute depreciation calculations for assets that are due for monthly depreciation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* End of Month Notice */}
          <div className="p-3 border rounded-md">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">End-of-Month Depreciation</p>
                <p className="mt-1">
                  This will calculate monthly depreciation for all eligible assets. 
                  Typically run on the 30th or 31st of each month.
                </p>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          {!isPreviewMode && !executionResult && (
            <div className="space-y-4">
              <h4 className="font-medium">Asset Category Filters</h4>
              
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="categoryFilter"
                      checked={categoryFilter === 'all'}
                      onChange={() => setCategoryFilter('all')}
                    />
                    <span className="text-sm">All Categories</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="categoryFilter"
                      checked={categoryFilter === 'include'}
                      onChange={() => setCategoryFilter('include')}
                    />
                    <span className="text-sm">Include Specific</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="categoryFilter"
                      checked={categoryFilter === 'exclude'}
                      onChange={() => setCategoryFilter('exclude')}
                    />
                    <span className="text-sm">Exclude Specific</span>
                  </label>
                </div>

                {categoryFilter !== 'all' && (
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-2">
                      {categories.map(category => {
                        const isChecked = selectedCategories.includes(category.id)
                        
                        return (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => 
                                handleCategoryToggle(category.id, checked === true)
                              }
                            />
                            <label 
                              htmlFor={`category-${category.id}`}
                              className="text-sm flex-1 cursor-pointer"
                            >
                              {category.name} ({category.count} assets)
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Results */}
          {isPreviewMode && previewData && (
            <div className="space-y-4">
              <h4 className="font-medium">Assets Ready for Depreciation</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-600">Total Assets</div>
                  <div className="text-2xl font-bold text-blue-800">{previewData.totalCount}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-md">
                  <div className="text-sm text-green-600">Monthly Depreciation</div>
                  <div className="text-2xl font-bold text-green-800">
                    ₱{previewData.totalMonthlyDepreciation.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">End of Month Status</span>
                </div>
                <div className="text-sm">
                  {previewData.isEndOfMonth ? (
                    <span className="text-green-600">✓ Today is end of month - ready to execute</span>
                  ) : (
                    <span className="text-amber-600">⚠ Not end of month - manual execution</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Execution Results */}
          {executionResult && (
            <div className="space-y-4">
              <h4 className="font-medium">Execution Results</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-green-50 rounded-md">
                  <div className="text-sm text-green-600">Successful</div>
                  <div className="text-2xl font-bold text-green-800">{executionResult.successfulCalculations}</div>
                </div>
                <div className="p-3 bg-red-50 rounded-md">
                  <div className="text-sm text-red-600">Failed</div>
                  <div className="text-2xl font-bold text-red-800">{executionResult.failedCalculations}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-600">Total Amount</div>
                  <div className="text-lg font-bold text-blue-800">
                    ₱{executionResult.totalDepreciationAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded-md">
                <div className="text-sm text-muted-foreground">
                  Execution completed in {executionResult.executionDurationMs}ms on {format(new Date(), 'MMM dd, yyyy HH:mm:ss')}
                </div>
              </div>

              {/* Show some details */}
              {executionResult.details.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Asset Details (showing first 5)</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {executionResult.details.slice(0, 5).map((detail: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                        <div>
                          <span className="font-mono">{detail.itemCode}</span>
                          <span className="ml-2 text-muted-foreground">{detail.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {detail.status === 'SUCCESS' ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : detail.status === 'FAILED' ? (
                            <XCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-500" />
                          )}
                          <span>₱{detail.depreciationAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {!isPreviewMode && !executionResult && (
              <>
                <Button variant="outline" onClick={handlePreview} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Preview Assets
                </Button>
                <Button onClick={handleExecute} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Execute Depreciation
                </Button>
              </>
            )}
            
            {isPreviewMode && !executionResult && (
              <>
                <Button variant="outline" onClick={() => setIsPreviewMode(false)}>
                  Back
                </Button>
                <Button onClick={handleExecute} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Execute Depreciation
                </Button>
              </>
            )}
            
            {executionResult && (
              <Button onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}