"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  Filter,
  Package,
  Building,
  Eye
} from "lucide-react";
import { DepreciationAnalysisData } from "@/lib/actions/depreciation-reports-actions";
import { DatePicker } from "@/components/ui/date-picker";

interface DepreciationScheduleViewProps {
  analysisData: DepreciationAnalysisData[];
  filterOptions: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    depreciationMethods: { value: string; label: string }[];
    assetStatuses: { value: string; label: string }[];
  };
  businessUnitId: string;

  currentFilters: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    departmentId?: string;
    depreciationMethod?: string;
    status?: string;
    isFullyDepreciated?: boolean;
  };
}

export function DepreciationScheduleView({
  analysisData,
  filterOptions,
  businessUnitId,
  currentFilters
}: DepreciationScheduleViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    startDate: currentFilters.startDate ? currentFilters.startDate.toISOString().split('T')[0] : '',
    endDate: currentFilters.endDate ? currentFilters.endDate.toISOString().split('T')[0] : '',
    categoryId: currentFilters.categoryId || 'all',
    departmentId: currentFilters.departmentId || 'all',
    depreciationMethod: currentFilters.depreciationMethod || 'all',
    status: currentFilters.status || 'all',
    isFullyDepreciated: currentFilters.isFullyDepreciated?.toString() || 'all'
  });

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== 'all') params.set(filterKey, filterValue);
    });
    params.set('tab', 'schedule');
    router.push(`/${businessUnitId}/reports/depreciation?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      categoryId: 'all',
      departmentId: 'all',
      depreciationMethod: 'all',
      status: 'all',
      isFullyDepreciated: 'all'
    });
    router.push(`/${businessUnitId}/reports/depreciation?tab=schedule`);
  };

  const handlePreviewReport = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== 'all') params.set(filterKey, filterValue);
    });
    router.push(`/${businessUnitId}/reports/depreciation/schedule/preview?${params.toString()}`);
  };

  // Filter assets that have depreciation data
  const assetsWithDepreciation = analysisData.filter(asset => 
    asset.depreciationMethod && 
    asset.usefulLifeYears && 
    asset.purchasePrice && 
    asset.depreciationStartDate
  );

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Depreciation Schedule Report</h1>
          <p className="text-muted-foreground">
            Generate formal depreciation schedules for assets with complete depreciation breakdown
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handlePreviewReport} 
            disabled={assetsWithDepreciation.length === 0}
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Start Date</Label>
          <DatePicker
            date={filters.startDate ? new Date(filters.startDate) : undefined}
            onDateChange={(date) => handleFilterChange('startDate', date ? date.toISOString().split('T')[0] : '')}
            placeholder="Start date"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">End Date</Label>
          <DatePicker
            date={filters.endDate ? new Date(filters.endDate) : undefined}
            onDateChange={(date) => handleFilterChange('endDate', date ? date.toISOString().split('T')[0] : '')}
            placeholder="End date"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Category</Label>
          <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filterOptions.categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Department</Label>
          <Select value={filters.departmentId} onValueChange={(value) => handleFilterChange('departmentId', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {filterOptions.departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Method</Label>
          <Select value={filters.depreciationMethod} onValueChange={(value) => handleFilterChange('depreciationMethod', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {filterOptions.depreciationMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {filterOptions.assetStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Depreciation Status</Label>
          <Select value={filters.isFullyDepreciated} onValueChange={(value) => handleFilterChange('isFullyDepreciated', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="true">Fully Depreciated</SelectItem>
              <SelectItem value="false">Not Fully Depreciated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">&nbsp;</Label>
          <div className="flex gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Apply
            </Button>
            {Object.values(filters).some(value => value && value !== 'all') && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Found {assetsWithDepreciation.length} assets with complete depreciation information
      </div>

      {/* Assets List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Package className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Assets Available for Schedule Report</h3>
        </div>

        {assetsWithDepreciation.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Assets Available</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No assets found with complete depreciation information (method, useful life, purchase price, and start date) for the selected criteria.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assetsWithDepreciation.map((asset) => (
              <div key={asset.id} className="p-4 bg-card border rounded-lg">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{asset.itemCode}</h4>
                      <p className="text-sm text-muted-foreground">{asset.description}</p>
                    </div>
                    <Badge variant="outline">{asset.category.name}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Purchase Price:</span>
                      <div className="font-medium">{formatCurrency(asset.purchasePrice)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Book Value:</span>
                      <div className="font-medium">{formatCurrency(asset.currentBookValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Method:</span>
                      <div className="font-medium">
                        {asset.depreciationMethod === 'STRAIGHT_LINE' ? 'Straight Line' :
                         asset.depreciationMethod === 'DECLINING_BALANCE' ? 'Declining Balance' :
                         asset.depreciationMethod === 'UNITS_OF_PRODUCTION' ? 'Units of Production' :
                         asset.depreciationMethod === 'SUM_OF_YEARS_DIGITS' ? 'Sum of Years Digits' :
                         asset.depreciationMethod}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Useful Life:</span>
                      <div className="font-medium">{asset.usefulLifeYears} years</div>
                    </div>
                  </div>

                  {asset.department && (
                    <div className="flex items-center gap-2 text-xs">
                      <Building className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{asset.department.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}