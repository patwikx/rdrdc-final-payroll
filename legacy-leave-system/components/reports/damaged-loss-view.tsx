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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertTriangle,
  Filter,
  Building,
  Eye,
  Calendar,
  User,
  Package
} from "lucide-react";
import { DamagedLossReportData } from "@/lib/actions/damaged-loss-reports-actions";
import { DatePicker } from "@/components/ui/date-picker";

interface DamagedLossViewProps {
  reportData: DamagedLossReportData[];
  filterOptions: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    assetStatuses: { value: string; label: string }[];
    disposalReasons: { value: string; label: string }[];
  };
  businessUnitId: string;
  currentFilters: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    departmentId?: string;
    status?: string;
    disposalReason?: string;
    includeDisposed?: boolean;
  };
}

export function DamagedLossView({
  reportData,
  filterOptions,
  businessUnitId,
  currentFilters
}: DamagedLossViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    startDate: currentFilters.startDate ? currentFilters.startDate.toISOString().split('T')[0] : '',
    endDate: currentFilters.endDate ? currentFilters.endDate.toISOString().split('T')[0] : '',
    categoryId: currentFilters.categoryId || 'all',
    departmentId: currentFilters.departmentId || 'all',
    status: currentFilters.status || 'all',
    disposalReason: currentFilters.disposalReason || 'all',
    includeDisposed: currentFilters.includeDisposed || false
  });

  const handleFilterChange = (key: string, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterKey === 'includeDisposed' && filterValue) {
        params.set(filterKey, 'true');
      } else if (filterValue && filterValue !== 'all') {
        params.set(filterKey, filterValue.toString());
      }
    });
    params.set('tab', 'damaged-loss');
    router.push(`/${businessUnitId}/reports/depreciation?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      categoryId: 'all',
      departmentId: 'all',
      status: 'all',
      disposalReason: 'all',
      includeDisposed: false
    });
    router.push(`/${businessUnitId}/reports/depreciation?tab=damaged-loss`);
  };

  const handlePreviewReport = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterKey === 'includeDisposed' && filterValue) {
        params.set(filterKey, 'true');
      } else if (filterValue && filterValue !== 'all') {
        params.set(filterKey, filterValue.toString());
      }
    });
    router.push(`/${businessUnitId}/reports/depreciation/damaged-loss/preview?${params.toString()}`);
  };

  // Group assets by status
  const assetsByStatus = new Map<string, DamagedLossReportData[]>();
  
  reportData.forEach(asset => {
    const status = asset.status;
    if (!assetsByStatus.has(status)) {
      assetsByStatus.set(status, []);
    }
    assetsByStatus.get(status)!.push(asset);
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LOST': return 'destructive';
      case 'DAMAGED': return 'secondary';
      case 'DISPOSED': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'LOST': return '🔍';
      case 'DAMAGED': return '⚠️';
      case 'DISPOSED': return '🗑️';
      default: return '❓';
    }
  };

  // Calculate totals
  const totalAssets = reportData.length;
  const totalBookValue = reportData.reduce((sum, asset) => sum + (asset.currentBookValue || 0), 0);
  const totalLoss = reportData.reduce((sum, asset) => {
    if (asset.disposal?.gainLoss) {
      return sum + Math.abs(asset.disposal.gainLoss);
    }
    return sum + (asset.currentBookValue || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Damaged & Loss Report</h1>
          <p className="text-muted-foreground">
            Track and analyze assets that are lost, damaged, or disposed due to damage
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handlePreviewReport} 
            disabled={reportData.length === 0}
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Total Assets</span>
          </div>
          <div className="text-2xl font-bold">{totalAssets}</div>
        </div>
        <div className="p-4 bg-card border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Total Book Value</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalBookValue)}</div>
        </div>
        <div className="p-4 bg-card border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-muted-foreground">Estimated Loss</span>
          </div>
          <div className="text-2xl font-bold text-destructive">{formatCurrency(totalLoss)}</div>
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
          <Label className="text-sm font-medium">Disposal Reason</Label>
          <Select value={filters.disposalReason} onValueChange={(value) => handleFilterChange('disposalReason', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {filterOptions.disposalReasons.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Include Disposed</Label>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="includeDisposed"
              checked={filters.includeDisposed}
              onCheckedChange={(checked) => handleFilterChange('includeDisposed', checked)}
            />
            <Label htmlFor="includeDisposed" className="text-sm">Show disposed assets</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">&nbsp;</Label>
          <div className="flex gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Apply
            </Button>
            {(Object.entries(filters).some(([key, value]) => key !== 'includeDisposed' && value && value !== 'all') || filters.includeDisposed) && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Found {reportData.length} damaged/lost assets across {assetsByStatus.size} status categories
      </div>

      {/* Assets by Status */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Assets by Status</h3>
        </div>

        {assetsByStatus.size === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Damaged or Lost Assets</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No assets found matching the selected criteria. This is good news!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(assetsByStatus.entries()).map(([status, assets]) => {
              const statusTotal = assets.reduce((sum, asset) => sum + (asset.currentBookValue || 0), 0);

              return (
                <div key={status} className="space-y-4">
                  {/* Status Header */}
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getStatusIcon(status)}</span>
                        <div>
                          <h4 className="text-lg font-semibold">{status.replace('_', ' ')}</h4>
                          <p className="text-sm text-muted-foreground">
                            {assets.length} assets • Total value: {formatCurrency(statusTotal)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={getStatusColor(status) as any}>{assets.length} assets</Badge>
                    </div>
                  </div>

                  {/* Assets List */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {assets.map((asset) => (
                      <div key={asset.id} className="p-4 bg-card border rounded-lg">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-semibold">{asset.itemCode}</h5>
                              <p className="text-sm text-muted-foreground line-clamp-2">{asset.description}</p>
                            </div>
                            <Badge variant={getStatusColor(asset.status) as any} className="text-xs">
                              {asset.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Category:</span>
                              <div className="font-medium">{asset.category.name}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Book Value:</span>
                              <div className="font-medium">{formatCurrency(asset.currentBookValue)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Updated:</span>
                              <div className="font-medium">{formatDate(asset.lastHistoryEntry?.actionDate || null)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Serial Number:</span>
                              <div className="font-medium">{asset.serialNumber || 'N/A'}</div>
                            </div>
                          </div>

                          {asset.assignedEmployee && (
                            <div className="flex items-center gap-2 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {asset.assignedEmployee.name} ({asset.assignedEmployee.employeeId})
                              </span>
                            </div>
                          )}

                          {asset.department && (
                            <div className="flex items-center gap-2 text-xs">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{asset.department.name}</span>
                            </div>
                          )}

                          {asset.disposal && (
                            <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                              <div className="font-medium mb-1">Disposal Info:</div>
                              <div>Reason: {asset.disposal.reason.replace('_', ' ')}</div>
                              <div>Date: {formatDate(asset.disposal.disposalDate)}</div>
                              {asset.disposal.gainLoss && (
                                <div className={asset.disposal.gainLoss < 0 ? 'text-destructive' : 'text-green-600'}>
                                  {asset.disposal.gainLoss < 0 ? 'Loss' : 'Gain'}: {formatCurrency(Math.abs(asset.disposal.gainLoss))}
                                </div>
                              )}
                            </div>
                          )}

                          {asset.lastHistoryEntry && (
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Last action: {asset.lastHistoryEntry.action} on {formatDate(asset.lastHistoryEntry.actionDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}