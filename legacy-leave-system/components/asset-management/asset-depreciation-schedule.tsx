"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  TrendingDown,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { getAssetDepreciationHistory, AssetDepreciationRecord } from "@/lib/actions/asset-depreciation-history-actions";
import { toast } from "sonner";

interface AssetDepreciationScheduleProps {
  assetId: string;
  businessUnitId: string;
}

export function AssetDepreciationSchedule({ assetId, businessUnitId }: AssetDepreciationScheduleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [depreciationHistory, setDepreciationHistory] = useState<AssetDepreciationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadDepreciationHistory = async () => {
    if (hasLoaded) return; // Don't reload if already loaded
    
    setIsLoading(true);
    try {
      const history = await getAssetDepreciationHistory(assetId, businessUnitId);
      setDepreciationHistory(history);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading depreciation history:", error);
      toast.error("Failed to load depreciation history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && !hasLoaded) {
      loadDepreciationHistory();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'STRAIGHT_LINE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DECLINING_BALANCE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'UNITS_OF_PRODUCTION':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Depreciation Schedule</h3>
      </div>

      {/* Toggle Button */}
      <Button
        variant="outline"
        onClick={handleToggle}
        className="w-full justify-between"
        disabled={isLoading}
      >
        <span className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          {isExpanded ? 'Hide' : 'Show'} Depreciation History
          {depreciationHistory.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {depreciationHistory.length} records
            </Badge>
          )}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading depreciation history...</div>
            </div>
          ) : depreciationHistory.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No Depreciation Records</h4>
              <p className="text-muted-foreground">
                This asset has no depreciation history yet. Depreciation records will appear here once calculations are performed.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {depreciationHistory.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      depreciationHistory.reduce((sum, record) => sum + record.depreciationAmount, 0)
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Depreciation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(
                      depreciationHistory.length > 0 
                        ? depreciationHistory.reduce((sum, record) => sum + record.depreciationAmount, 0) / depreciationHistory.length
                        : 0
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Average per Period</div>
                </div>
              </div>

              {/* Depreciation History Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Book Value Start</TableHead>
                      <TableHead className="text-right">Depreciation</TableHead>
                      <TableHead className="text-right">Book Value End</TableHead>
                      <TableHead className="text-right">Accumulated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depreciationHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">
                              {format(new Date(record.depreciationDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(record.periodStartDate), 'MMM dd')} - {format(new Date(record.periodEndDate), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getMethodBadgeColor(record.method)}>
                            {record.method.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(record.bookValueStart)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="text-red-600 dark:text-red-400">
                            -{formatCurrency(record.depreciationAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(record.bookValueEnd)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="text-orange-600 dark:text-orange-400">
                            {formatCurrency(record.accumulatedDepreciation)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {record.isAdjustment ? (
                              <>
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-sm text-amber-600">Adjustment</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600">Regular</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            {record.adjustmentReason && (
                              <div className="text-xs text-amber-600 mb-1">
                                Reason: {record.adjustmentReason}
                              </div>
                            )}
                            {record.notes && (
                              <div className="text-xs text-muted-foreground truncate">
                                {record.notes}
                              </div>
                            )}
                            {record.calculatedBy && (
                              <div className="text-xs text-muted-foreground mt-1">
                                by {record.calculatedBy}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Info */}
              <div className="text-sm text-muted-foreground text-center py-2">
                Showing all {depreciationHistory.length} depreciation records for this asset
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}