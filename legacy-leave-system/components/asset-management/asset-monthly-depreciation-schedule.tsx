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
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { getAssetDepreciationSchedule, DepreciationScheduleEntry } from "@/lib/actions/asset-depreciation-schedule-actions";
import { toast } from "sonner";

interface AssetMonthlyDepreciationScheduleProps {
  assetId: string;
  businessUnitId: string;
}

export function AssetMonthlyDepreciationSchedule({ assetId, businessUnitId }: AssetMonthlyDepreciationScheduleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [schedule, setSchedule] = useState<DepreciationScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadSchedule = async () => {
    if (hasLoaded) return;
    
    setIsLoading(true);
    try {
      const scheduleData = await getAssetDepreciationSchedule(assetId, businessUnitId);
      setSchedule(scheduleData);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error loading depreciation schedule:", error);
      toast.error("Failed to load depreciation schedule");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && !hasLoaded) {
      loadSchedule();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const completedPeriods = schedule.filter(entry => entry.isCompleted).length;
  const remainingPeriods = schedule.filter(entry => !entry.isCompleted).length;
  const totalDepreciation = schedule.reduce((sum, entry) => sum + entry.depreciationAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Monthly Depreciation Schedule</h3>
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
          {isExpanded ? 'Hide' : 'Show'} Monthly Schedule
          {schedule.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {schedule.length} periods
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
              <div className="text-muted-foreground">Loading depreciation schedule...</div>
            </div>
          ) : schedule.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No Schedule Available</h4>
              <p className="text-muted-foreground">
                This asset doesn't have sufficient information to generate a depreciation schedule.
                Ensure purchase price, useful life, and depreciation method are configured.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {schedule.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Periods</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {completedPeriods}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {remainingPeriods}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(totalDepreciation)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Depreciation</div>
                </div>
              </div>

              {/* Monthly Schedule Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Depreciation</TableHead>
                      <TableHead className="text-right">Accumulated</TableHead>
                      <TableHead className="text-right">Book Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((entry) => (
                      <TableRow 
                        key={entry.period}
                        className={entry.isCompleted ? "bg-muted/30" : ""}
                      >
                        <TableCell>
                          <div className="font-medium">
                            Period {entry.period}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {format(entry.date, 'MMM yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(entry.date, 'MMMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={entry.isCompleted ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}>
                            -{formatCurrency(entry.depreciationAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={entry.isCompleted ? "text-muted-foreground" : "text-orange-600 dark:text-orange-400"}>
                            {formatCurrency(entry.accumulatedDepreciation)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={entry.isCompleted ? "text-muted-foreground" : ""}>
                            {formatCurrency(entry.bookValue)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.isCompleted ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600">Completed</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-blue-600">Pending</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Info */}
              <div className="text-sm text-muted-foreground text-center py-2 space-y-1">
                <div>
                  Showing {completedPeriods} completed and {remainingPeriods} remaining depreciation periods
                </div>
                <div className="text-xs">
                  Completed periods are shown with muted colors. Schedule is calculated based on current asset configuration.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}