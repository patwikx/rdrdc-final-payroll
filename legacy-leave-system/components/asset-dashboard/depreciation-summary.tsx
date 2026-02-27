"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  TrendingDown, 
  DollarSign, 
  Calculator,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import type { DepreciationSummary } from "@/lib/actions/asset-dashboard-actions";

interface DepreciationSummaryProps {
  data: DepreciationSummary;
  businessUnitId: string;
}

export function DepreciationSummaryCard({ data, businessUnitId }: DepreciationSummaryProps) {
  const depreciationPercentage = data.totalOriginalValue > 0 
    ? (data.totalDepreciation / data.totalOriginalValue) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-orange-600" />
          Depreciation Summary
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessUnitId}/asset-management/depreciation`}>
            <Calculator className="h-4 w-4 mr-2" />
            Manage
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Value Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Original Value</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ₱{data.totalOriginalValue.toLocaleString()}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Current Value</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              ₱{data.totalCurrentValue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Depreciation Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Depreciation</span>
            <span className="text-sm text-muted-foreground">
              {depreciationPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={depreciationPercentage} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-red-600 font-medium">
              ₱{data.totalDepreciation.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              depreciated
            </span>
          </div>
        </div>

        {/* Monthly Depreciation */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Monthly Depreciation</p>
              <p className="text-xs text-muted-foreground">
                Current rate across all assets
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-orange-600">
                ₱{data.monthlyDepreciation.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">per month</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/${businessUnitId}/reports/depreciation`}>
              View Reports
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/${businessUnitId}/asset-management/depreciation/calculate`}>
              Calculate
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}