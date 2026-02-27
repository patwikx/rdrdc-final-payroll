"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Calculator,
  Calendar,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Package,
  PlayCircle,
  X,
  CheckSquare,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  DepreciationCalculationData, 
  calculateDepreciationBatch 
} from "@/lib/actions/depreciation-calculation-actions";

interface DepreciationCalculationViewProps {
  data: DepreciationCalculationData;
  businessUnitId: string;
  canOverride: boolean;
}

export function DepreciationCalculationView({ 
  data, 
  businessUnitId, 
  canOverride 
}: DepreciationCalculationViewProps) {
  const router = useRouter();
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    const newSelected = new Set(selectedAssets);
    if (checked) {
      newSelected.add(assetId);
    } else {
      newSelected.delete(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAssets.size === data.assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(data.assets.map(asset => asset.id)));
    }
  };

  const handleCalculateDepreciation = async (override: boolean = false) => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to calculate depreciation");
      return;
    }

    setIsCalculating(true);
    setCalculationProgress(0);

    try {
      const result = await calculateDepreciationBatch(
        businessUnitId,
        Array.from(selectedAssets),
        override
      );

      setCalculationProgress(100);

      if (result.success) {
        toast.success(
          `Depreciation calculated successfully! Processed ${result.processedCount} assets. Total depreciation: ${formatCurrency(result.totalDepreciation)}`
        );
        
        if (result.failedCount > 0) {
          toast.warning(`${result.failedCount} assets failed to process. Check the details.`);
        }

        // Reset selections and refresh
        setSelectedAssets(new Set());
        router.refresh();
      } else {
        toast.error("Failed to calculate depreciation. Please check the errors.");
      }

      if (result.errors.length > 0) {
        console.error("Depreciation calculation errors:", result.errors);
      }

    } catch (error) {
      console.error("Depreciation calculation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to calculate depreciation");
    } finally {
      setIsCalculating(false);
      setShowConfirmDialog(false);
      setCalculationProgress(0);
    }
  };

  const selectedAssetsData = data.assets.filter(asset => selectedAssets.has(asset.id));
  const selectedTotalDepreciation = selectedAssetsData.reduce(
    (sum, asset) => sum + asset.monthlyDepreciation, 
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Depreciation Calculation</h1>
          <p className="text-sm text-muted-foreground">
            Calculate monthly depreciation for assets due for depreciation
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {data.assets.length > 0 && (
            <>
              <Badge variant="outline" className="font-mono">
                {selectedAssets.size} selected
              </Badge>
              {selectedAssets.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedAssets(new Set())}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button 
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!data.summary.canCalculate && !canOverride}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Depreciation
                  </Button>
                </>
              )}
            </>
          )}
          {data.assets.length === 0 && data.nextMonthAssets && data.nextMonthAssets.length > 0 && (
            <Badge variant="secondary" className="font-mono">
              Preview Mode - No Actions Available
            </Badge>
          )}
        </div>
      </div>

      {/* Date Restriction Alert */}
      {!data.summary.canCalculate && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                <strong className="mr-1">Depreciation calculation is restricted.</strong> 
                 Calculations can only be performed on the 30th or 31st of each month.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>Current Date: {format(data.summary.currentDate, 'MMMM dd, yyyy')}</span>
                {data.summary.nextAllowedDate && (
                  <span>Next Allowed: {format(data.summary.nextAllowedDate, 'MMMM dd, yyyy')}</span>
                )}
              </div>
              {canOverride && (
                <p className="text-sm text-muted-foreground">
                  As an admin, you can override this restriction by clicking "Calculate with Override" below.
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-sm font-medium">Assets Due</p>
            <p className="text-2xl font-bold">{data.summary.totalAssets}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-sm font-medium">Total Book Value</p>
            <p className="text-2xl font-bold">{formatCurrency(data.summary.totalCurrentBookValue)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <div>
            <p className="text-sm font-medium">Monthly Depreciation</p>
            <p className="text-2xl font-bold">{formatCurrency(data.summary.totalMonthlyDepreciation)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {data.summary.canCalculate ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Clock className="h-4 w-4 text-orange-500" />
          )}
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-sm font-bold">
              {data.summary.canCalculate ? 'Ready to Calculate' : 'Restricted'}
            </p>
          </div>
        </div>
      </div>

      {/* Selected Assets Summary */}
      {selectedAssets.size > 0 && (
        <div className="border border-primary/20 bg-primary/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Selected Assets Summary</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Selected Assets</p>
              <p className="text-2xl font-bold">{selectedAssets.size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Depreciation</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedTotalDepreciation)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calculation Status</p>
              <div className="flex items-center gap-2">
                {data.summary.canCalculate ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-600">Ready</span>
                  </>
                ) : canOverride ? (
                  <>
                    <Shield className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-600">Override Available</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">Restricted</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Assets Due for Depreciation</h3>
          </div>
          {data.assets.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSelectAll}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {selectedAssets.size === data.assets.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          {data.assets.length === 0 && data.nextMonthAssets && data.nextMonthAssets.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Next Month: {data.summary.nextMonthAssetsCount} assets
            </Badge>
          )}
        </div>
        
        <div className="rounded-md border">
          {data.assets.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Assets Due This Month</h3>
                <p className="text-muted-foreground">
                  All assets are up to date with their depreciation calculations for this period.
                </p>
              </div>
              
              {/* Next Month Preview */}
              {data.nextMonthAssets && data.nextMonthAssets.length > 0 && (
                <div className="border-t pt-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-lg font-semibold">Next Month Preview</h3>
                      <Badge variant="secondary" className="ml-2">
                        {data.summary.nextMonthAssetsCount} assets
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Assets scheduled for depreciation next month. Calculation will be available on the 30th/31st.
                    </p>
                  </div>
                  
                  {/* Next Month Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Assets Due</p>
                        <p className="text-xl font-bold">{data.summary.nextMonthAssetsCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Total Depreciation</p>
                        <p className="text-xl font-bold text-red-600">
                          {formatCurrency(data.summary.nextMonthTotalDepreciation || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Status</p>
                        <p className="text-sm font-bold text-orange-600">Preview Only</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Next Month Assets Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Current Book Value</TableHead>
                          <TableHead className="text-right">Monthly Depreciation</TableHead>
                          <TableHead>Next Due Date</TableHead>
                          <TableHead>Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.nextMonthAssets.map((asset) => (
                          <TableRow key={asset.id} className="opacity-75">
                            <TableCell>
                              <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{asset.description}</div>
                                {asset.brand && (
                                  <div className="text-xs text-muted-foreground">{asset.brand}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{asset.category.name}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(asset.currentBookValue)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              -{formatCurrency(asset.monthlyDepreciation)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3" />
                                <span>{format(asset.nextDepreciationDate, 'MMM dd, yyyy')}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {asset.depreciationMethod.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {data.summary.nextMonthAssetsCount && data.summary.nextMonthAssetsCount > 50 && (
                    <div className="text-center text-sm text-muted-foreground mt-4">
                      Showing first 50 assets. {data.summary.nextMonthAssetsCount - 50} more assets will be available for calculation next month.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={data.assets.length > 0 && selectedAssets.size === data.assets.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Book Value</TableHead>
                    <TableHead className="text-right">Monthly Depreciation</TableHead>
                    <TableHead>Next Due Date</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assets.map((asset) => {
                    const isOverdue = new Date(asset.nextDepreciationDate) < new Date();
                    
                    return (
                      <TableRow 
                        key={asset.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedAssets.has(asset.id) ? "bg-muted/50" : ""}`}
                        onClick={() => handleSelectAsset(asset.id, !selectedAssets.has(asset.id))}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedAssets.has(asset.id)}
                            onCheckedChange={(checked) => handleSelectAsset(asset.id, checked === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{asset.description}</div>
                            {asset.brand && (
                              <div className="text-xs text-muted-foreground">{asset.brand}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.category.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(asset.currentBookValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -{formatCurrency(asset.monthlyDepreciation)}
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-red-600' : ''}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{format(asset.nextDepreciationDate, 'MMM dd, yyyy')}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {asset.depreciationMethod.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Confirm Depreciation Calculation
            </DialogTitle>
            <DialogDescription>
              You are about to calculate depreciation for {selectedAssets.size} assets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Selected Assets:</span>
                <span className="font-medium">{selectedAssets.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Depreciation:</span>
                <span className="font-medium text-red-600">{formatCurrency(selectedTotalDepreciation)}</span>
              </div>
              <div className="flex justify-between">
                <span>Calculation Date:</span>
                <span className="font-medium">{format(data.summary.currentDate, 'MMM dd, yyyy')}</span>
              </div>
            </div>

            {!data.summary.canCalculate && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Date Restriction Override:</strong> You are calculating depreciation outside the normal period (30th/31st of month).
                </AlertDescription>
              </Alert>
            )}

            {isCalculating && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Calculating depreciation...</span>
                </div>
                <Progress value={calculationProgress} className="w-full" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={isCalculating}
            >
              Cancel
            </Button>
            {data.summary.canCalculate ? (
              <Button 
                onClick={() => handleCalculateDepreciation(false)}
                disabled={isCalculating}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Depreciation
              </Button>
            ) : canOverride ? (
              <Button 
                onClick={() => handleCalculateDepreciation(true)}
                disabled={isCalculating}
                variant="destructive"
              >
                <Shield className="h-4 w-4 mr-2" />
                Calculate with Override
              </Button>
            ) : (
              <Button disabled>
                <Clock className="h-4 w-4 mr-2" />
                Calculation Restricted
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}