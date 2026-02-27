"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calculator,
  Download, 
  Filter,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Printer,
  Eye,
  Calendar
} from "lucide-react";
import { DepreciationAnalysisData } from "@/lib/actions/depreciation-reports-actions";
import { DatePicker } from "@/components/ui/date-picker";


interface DepreciationAnalysisViewProps {
  analysisData: DepreciationAnalysisData[];
  filterOptions: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    depreciationMethods: { value: string; label: string }[];
    assetStatuses: { value: string; label: string }[];
  };
  businessUnitId: string;
  businessUnitName?: string;
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

export function DepreciationAnalysisView({
  analysisData,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: DepreciationAnalysisViewProps) {
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
    router.push(`/${businessUnitId}/reports/depreciation/analysis?${params.toString()}`);
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
    router.push(`/${businessUnitId}/reports/depreciation/analysis`);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getDepreciationStatusBadge = (asset: DepreciationAnalysisData) => {
    if (asset.isFullyDepreciated) {
      return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Fully Depreciated</Badge>;
    }
    if (asset.remainingUsefulLife <= 6) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Nearing End</Badge>;
    }
    if (asset.remainingUsefulLife <= 12) {
      return <Badge variant="default"><Clock className="h-3 w-3 mr-1" />Within 1 Year</Badge>;
    }
    return <Badge variant="outline"><TrendingDown className="h-3 w-3 mr-1" />Active</Badge>;
  };

  const exportToCSV = () => {
    const headers = [
      'Item Code',
      'Description',
      'Serial Number',
      'Category',
      'Department',
      'Purchase Date',
      'Purchase Price',
      'Current Book Value',
      'Accumulated Depreciation',
      'Salvage Value',
      'Depreciation Method',
      'Useful Life (Years)',
      'Monthly Depreciation',
      'Depreciation Rate %',
      'Remaining Useful Life (Months)',
      'Projected Full Depreciation Date',
      'Status',
      'Location',
      'Assigned To'
    ];

    const csvData = analysisData.map(asset => [
      asset.itemCode,
      asset.description,
      asset.serialNumber || '',
      asset.category.name,
      asset.department?.name || 'Unassigned',
      asset.purchaseDate ? asset.purchaseDate.toLocaleDateString() : '',
      asset.purchasePrice?.toString() || '0',
      asset.currentBookValue?.toString() || '0',
      asset.accumulatedDepreciation.toString(),
      asset.salvageValue?.toString() || '0',
      asset.depreciationMethod || '',
      asset.usefulLifeYears?.toString() || '',
      asset.monthlyDepreciation?.toString() || '0',
      asset.depreciationRate.toFixed(2),
      asset.remainingUsefulLife.toString(),
      asset.projectedFullDepreciationDate ? asset.projectedFullDepreciationDate.toLocaleDateString() : '',
      asset.status,
      asset.location || '',
      asset.assignedEmployee ? `${asset.assignedEmployee.name} (${asset.assignedEmployee.employeeId})` : ''
    ]);

    const csvContent = [
      ['Asset Depreciation Analysis Report'],
      ['Business Unit:', businessUnitName || 'N/A'],
      ['Generated:', new Date().toLocaleDateString()],
      ['Total Assets:', analysisData.length.toString()],
      [''],
      headers,
      ...csvData
    ].map(row => Array.isArray(row) ? row.map(cell => `"${cell}"`).join(',') : `"${row}"`)
     .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const businessUnitSlug = businessUnitName 
      ? businessUnitName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : 'business-unit';
    link.setAttribute('download', `${businessUnitSlug}-depreciation-analysis-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    // Helper function for print formatting
    const formatPrintCurrency = (amount: number | null) => {
      if (!amount) return '₱0.00';
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Depreciation Analysis</title>
          <style>
            @page { size: landscape; margin: 0.5in; }
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 20px; color: #333; font-weight: bold; }
            .header h2 { margin: 5px 0; font-size: 14px; color: #666; font-weight: normal; }
            .meta-info { margin-bottom: 15px; font-size: 9px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; font-size: 8px; }
            th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
            .currency { text-align: right; }
            .center { text-align: center; }
            .no-data { text-align: center; font-style: italic; color: #999; }
            .status-badge { padding: 2px 4px; border-radius: 2px; font-size: 7px; }
            .status-active { background-color: #e5e7eb; }
            .status-warning { background-color: #fef3c7; }
            .status-danger { background-color: #fee2e2; }
            .status-success { background-color: #d1fae5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${businessUnitName || 'Business Unit'}</h1>
            <h2>Asset Depreciation Analysis Report</h2>
          </div>
          
          <div class="meta-info">
            <strong>Report Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
            <strong>Total Assets Analyzed:</strong> ${analysisData.length}<br>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>Category</th>
                <th>Purchase Price</th>
                <th>Book Value</th>
                <th>Accumulated Dep.</th>
                <th>Dep. Rate</th>
                <th>Method</th>
                <th>Remaining Life</th>
                <th>Status</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              ${analysisData.length === 0 ? 
                '<tr><td colspan="11" class="no-data">No assets found for analysis</td></tr>' :
                analysisData.map(asset => {
                  let statusClass = 'status-active';
                  if (asset.isFullyDepreciated) statusClass = 'status-success';
                  else if (asset.remainingUsefulLife <= 6) statusClass = 'status-danger';
                  else if (asset.remainingUsefulLife <= 12) statusClass = 'status-warning';
                  
                  return `
                    <tr>
                      <td><strong>${asset.itemCode}</strong></td>
                      <td>${asset.description}</td>
                      <td>${asset.category.name}</td>
                      <td class="currency">${formatPrintCurrency(asset.purchasePrice)}</td>
                      <td class="currency">${formatPrintCurrency(asset.currentBookValue)}</td>
                      <td class="currency">${formatPrintCurrency(asset.accumulatedDepreciation)}</td>
                      <td class="center">${formatPercentage(asset.depreciationRate)}</td>
                      <td class="center">${asset.depreciationMethod || 'N/A'}</td>
                      <td class="center">${asset.remainingUsefulLife} months</td>
                      <td class="center">
                        <span class="status-badge ${statusClass}">
                          ${asset.isFullyDepreciated ? 'Fully Depreciated' : 
                            asset.remainingUsefulLife <= 6 ? 'Nearing End' :
                            asset.remainingUsefulLife <= 12 ? 'Within 1 Year' : 'Active'}
                        </span>
                      </td>
                      <td>${asset.assignedEmployee ? asset.assignedEmployee.name : 'Unassigned'}</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  // Calculate summary statistics
  const totalAssets = analysisData.length;
  const fullyDepreciatedCount = analysisData.filter(asset => asset.isFullyDepreciated).length;
  const nearingEndCount = analysisData.filter(asset => !asset.isFullyDepreciated && asset.remainingUsefulLife <= 6).length;
  const avgDepreciationRate = totalAssets > 0 
    ? analysisData.reduce((sum, asset) => sum + asset.depreciationRate, 0) / totalAssets 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Depreciation Analysis</h1>
          <p className="text-muted-foreground">
            Detailed asset-by-asset depreciation breakdown and analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={printReport} disabled={analysisData.length === 0} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={analysisData.length === 0} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">
              Assets analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Depreciated</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fullyDepreciatedCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalAssets > 0 ? ((fullyDepreciatedCount / totalAssets) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nearing End</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nearingEndCount}</div>
            <p className="text-xs text-muted-foreground">
              Within 6 months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Depreciation Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(avgDepreciationRate)}</div>
            <p className="text-xs text-muted-foreground">
              Across all assets
            </p>
          </CardContent>
        </Card>
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
        Showing {analysisData.length} assets for detailed analysis
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Purchase Price</TableHead>
              <TableHead className="text-right">Book Value</TableHead>
              <TableHead className="text-right">Accumulated Dep.</TableHead>
              <TableHead className="text-center">Depreciation Progress</TableHead>
              <TableHead className="text-center">Method</TableHead>
              <TableHead className="text-center">Remaining Life</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analysisData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No assets found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              analysisData.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{asset.itemCode}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]" title={asset.description}>
                        {asset.description}
                      </p>
                      {asset.serialNumber && (
                        <p className="text-xs text-muted-foreground">SN: {asset.serialNumber}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{asset.category.name}</Badge>
                    {asset.department && (
                      <p className="text-xs text-muted-foreground mt-1">{asset.department.name}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(asset.purchasePrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(asset.currentBookValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(asset.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-center">
                    <div className="space-y-1">
                      <Progress value={asset.depreciationRate} className="w-20" />
                      <p className="text-xs">{formatPercentage(asset.depreciationRate)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      {asset.depreciationMethod === 'STRAIGHT_LINE' ? 'Straight Line' :
                       asset.depreciationMethod === 'DECLINING_BALANCE' ? 'Declining Balance' :
                       asset.depreciationMethod === 'UNITS_OF_PRODUCTION' ? 'Units of Production' :
                       asset.depreciationMethod === 'SUM_OF_YEARS_DIGITS' ? 'Sum of Years Digits' :
                       asset.depreciationMethod || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="space-y-1">
                      <p className="font-medium">{asset.remainingUsefulLife}</p>
                      <p className="text-xs text-muted-foreground">months</p>
                      {asset.projectedFullDepreciationDate && (
                        <p className="text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {asset.projectedFullDepreciationDate.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getDepreciationStatusBadge(asset)}
                  </TableCell>
                  <TableCell>
                    {asset.assignedEmployee ? (
                      <div>
                        <p className="font-medium text-sm">{asset.assignedEmployee.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.assignedEmployee.employeeId}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                    {asset.location && (
                      <p className="text-xs text-muted-foreground mt-1">{asset.location}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {analysisData.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                No assets found for the selected criteria.
              </div>
            </CardContent>
          </Card>
        ) : (
          analysisData.map((asset) => (
            <Card key={asset.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{asset.itemCode}</CardTitle>
                    <p className="text-sm text-muted-foreground">{asset.description}</p>
                    {asset.serialNumber && (
                      <p className="text-xs text-muted-foreground">SN: {asset.serialNumber}</p>
                    )}
                  </div>
                  {getDepreciationStatusBadge(asset)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium">{asset.category.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{asset.department?.name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Purchase Price:</span>
                    <p className="font-medium">{formatCurrency(asset.purchasePrice)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Book Value:</span>
                    <p className="font-medium">{formatCurrency(asset.currentBookValue)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Accumulated Dep.:</span>
                    <p className="font-medium">{formatCurrency(asset.accumulatedDepreciation)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly Dep.:</span>
                    <p className="font-medium">{formatCurrency(asset.monthlyDepreciation)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground text-sm">Depreciation Progress:</span>
                    <span className="text-sm font-medium">{formatPercentage(asset.depreciationRate)}</span>
                  </div>
                  <Progress value={asset.depreciationRate} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Method:</span>
                    <p className="font-medium">
                      {asset.depreciationMethod === 'STRAIGHT_LINE' ? 'Straight Line' :
                       asset.depreciationMethod === 'DECLINING_BALANCE' ? 'Declining Balance' :
                       asset.depreciationMethod === 'UNITS_OF_PRODUCTION' ? 'Units of Production' :
                       asset.depreciationMethod === 'SUM_OF_YEARS_DIGITS' ? 'Sum of Years Digits' :
                       asset.depreciationMethod || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining Life:</span>
                    <p className="font-medium">{asset.remainingUsefulLife} months</p>
                  </div>
                </div>

                {asset.assignedEmployee && (
                  <div>
                    <span className="text-muted-foreground text-sm">Assigned To:</span>
                    <p className="font-medium">{asset.assignedEmployee.name} ({asset.assignedEmployee.employeeId})</p>
                  </div>
                )}

                {asset.location && (
                  <div>
                    <span className="text-muted-foreground text-sm">Location:</span>
                    <p className="font-medium">{asset.location}</p>
                  </div>
                )}

                {asset.projectedFullDepreciationDate && (
                  <div>
                    <span className="text-muted-foreground text-sm">Projected Full Depreciation:</span>
                    <p className="font-medium">{asset.projectedFullDepreciationDate.toLocaleDateString()}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/${businessUnitId}/asset-management/assets/${asset.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Asset Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}