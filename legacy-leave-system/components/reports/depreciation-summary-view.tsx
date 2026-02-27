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
import { 
  TrendingDown,
  Download, 
  Filter,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle,
  Printer,
  BarChart3,
  PieChart
} from "lucide-react";
import { DepreciationSummaryData } from "@/lib/actions/depreciation-reports-actions";
import { DatePicker } from "@/components/ui/date-picker";


interface DepreciationSummaryViewProps {
  summaryData: DepreciationSummaryData;
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

export function DepreciationSummaryView({
  summaryData,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: DepreciationSummaryViewProps) {
  const router = useRouter();
  
  // Helper function to format date for input without timezone issues
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to create date from input string in local timezone
  const createLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const [filters, setFilters] = useState({
    startDate: currentFilters.startDate ? formatDateForInput(currentFilters.startDate) : '',
    endDate: currentFilters.endDate ? formatDateForInput(currentFilters.endDate) : '',
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
    params.set('tab', 'summary'); // Ensure we stay on the summary tab
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== 'all') params.set(filterKey, filterValue);
    });
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
    router.push(`/${businessUnitId}/reports/depreciation?tab=summary`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const exportToCSV = () => {
    const headers = [
      'Category',
      'Asset Count',
      'Purchase Value',
      'Current Book Value',
      'Accumulated Depreciation',
      'Depreciation Rate %'
    ];

    const csvData = summaryData.byCategory.map(category => [
      category.categoryName,
      category.assetCount.toString(),
      category.purchaseValue.toString(),
      category.currentBookValue.toString(),
      category.accumulatedDepreciation.toString(),
      category.depreciationRate.toFixed(2)
    ]);

    const csvContent = [
      ['Depreciation Summary Report'],
      ['Business Unit:', businessUnitName || 'N/A'],
      ['Generated:', new Date().toLocaleDateString()],
      [''],
      ['SUMMARY TOTALS'],
      ['Total Assets:', summaryData.totalAssets.toString()],
      ['Total Purchase Value:', summaryData.totalPurchaseValue.toString()],
      ['Total Current Book Value:', summaryData.totalCurrentBookValue.toString()],
      ['Total Accumulated Depreciation:', summaryData.totalAccumulatedDepreciation.toString()],
      ['Fully Depreciated Assets:', summaryData.fullyDepreciatedAssets.toString()],
      ['Assets Nearing Full Depreciation:', summaryData.assetsNearingFullDepreciation.toString()],
      [''],
      ['BY CATEGORY'],
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
    link.setAttribute('download', `${businessUnitSlug}-depreciation-summary-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    // Helper function for print formatting
    const formatPrintCurrency = (amount: number) => {
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
          <title>Depreciation Summary Report</title>
          <style>
            @page { size: landscape; margin: 0.5in; }
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 22px; color: #333; font-weight: bold; }
            .header h2 { margin: 5px 0; font-size: 16px; color: #666; font-weight: normal; }
            .meta-info { margin-bottom: 15px; font-size: 11px; color: #666; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
            .summary-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
            .summary-card h3 { margin: 0 0 5px 0; font-size: 14px; color: #333; }
            .summary-card .value { font-size: 18px; font-weight: bold; color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 10px; }
            th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
            .currency { text-align: right; }
            .no-data { text-align: center; font-style: italic; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${businessUnitName || 'Business Unit'}</h1>
            <h2>Depreciation Summary Report</h2>
          </div>
          
          <div class="meta-info">
            <strong>Report Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
            <strong>Total Assets:</strong> ${summaryData.totalAssets}<br>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Purchase Value</h3>
              <div class="value">${formatPrintCurrency(summaryData.totalPurchaseValue)}</div>
            </div>
            <div class="summary-card">
              <h3>Current Book Value</h3>
              <div class="value">${formatPrintCurrency(summaryData.totalCurrentBookValue)}</div>
            </div>
            <div class="summary-card">
              <h3>Accumulated Depreciation</h3>
              <div class="value">${formatPrintCurrency(summaryData.totalAccumulatedDepreciation)}</div>
            </div>
            <div class="summary-card">
              <h3>Fully Depreciated Assets</h3>
              <div class="value">${summaryData.fullyDepreciatedAssets}</div>
            </div>
            <div class="summary-card">
              <h3>Nearing Full Depreciation</h3>
              <div class="value">${summaryData.assetsNearingFullDepreciation}</div>
            </div>
            <div class="summary-card">
              <h3>Period Depreciation Expense</h3>
              <div class="value">${formatPrintCurrency(summaryData.totalDepreciationExpense)}</div>
            </div>
          </div>

          <h3>Depreciation by Category</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Assets</th>
                <th>Purchase Value</th>
                <th>Current Book Value</th>
                <th>Accumulated Depreciation</th>
                <th>Depreciation Rate</th>
              </tr>
            </thead>
            <tbody>
              ${summaryData.byCategory.map(category => `
                <tr>
                  <td>${category.categoryName}</td>
                  <td>${category.assetCount}</td>
                  <td class="currency">${formatPrintCurrency(category.purchaseValue)}</td>
                  <td class="currency">${formatPrintCurrency(category.currentBookValue)}</td>
                  <td class="currency">${formatPrintCurrency(category.accumulatedDepreciation)}</td>
                  <td>${formatPercentage(category.depreciationRate)}</td>
                </tr>
              `).join('')}
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

  // Calculate overall depreciation rate
  const overallDepreciationRate = summaryData.totalPurchaseValue > 0 
    ? (summaryData.totalAccumulatedDepreciation / summaryData.totalPurchaseValue) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Depreciation Summary</h1>
          <p className="text-muted-foreground">
            Asset depreciation overview and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={printReport} disabled={summaryData.totalAssets === 0} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={summaryData.totalAssets === 0} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalAssets}</div>
            <p className="text-xs text-muted-foreground">
              Active assets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchase Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summaryData.totalPurchaseValue)}</div>
            <p className="text-xs text-muted-foreground">
              Original cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Book Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summaryData.totalCurrentBookValue)}</div>
            <p className="text-xs text-muted-foreground">
              Depreciated value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accumulated Depreciation</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summaryData.totalAccumulatedDepreciation)}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercentage(overallDepreciationRate)} of original
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Depreciated</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.fullyDepreciatedAssets}</div>
            <p className="text-xs text-muted-foreground">
              Assets at salvage value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nearing Full Depreciation</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.assetsNearingFullDepreciation}</div>
            <p className="text-xs text-muted-foreground">
              Within 6 months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Start Date</Label>
          <DatePicker
            date={filters.startDate ? createLocalDate(filters.startDate) : undefined}
            onDateChange={(date) => handleFilterChange('startDate', date ? formatDateForInput(date) : '')}
            placeholder="Start date"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">End Date</Label>
          <DatePicker
            date={filters.endDate ? createLocalDate(filters.endDate) : undefined}
            onDateChange={(date) => handleFilterChange('endDate', date ? formatDateForInput(date) : '')}
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
        Showing depreciation summary for {summaryData.totalAssets} assets
      </div>

      {/* Category Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Depreciation by Category</h3>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Purchase Value</TableHead>
                <TableHead className="text-right">Current Book Value</TableHead>
                <TableHead className="text-right">Accumulated Depreciation</TableHead>
                <TableHead className="text-right">Depreciation Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.byCategory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No assets found for the selected criteria.
                  </TableCell>
                </TableRow>
              ) : (
                summaryData.byCategory.map((category) => (
                  <TableRow key={category.categoryId}>
                    <TableCell className="font-medium">{category.categoryName}</TableCell>
                    <TableCell className="text-right">{category.assetCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.purchaseValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.currentBookValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.accumulatedDepreciation)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={category.depreciationRate > 75 ? "destructive" : category.depreciationRate > 50 ? "default" : "secondary"}>
                        {formatPercentage(category.depreciationRate)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Method Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Depreciation by Method</h3>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Purchase Value</TableHead>
                <TableHead className="text-right">Current Book Value</TableHead>
                <TableHead className="text-right">Accumulated Depreciation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.byMethod.map((method) => (
                <TableRow key={method.method}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">
                      {method.method === 'STRAIGHT_LINE' ? 'Straight Line' :
                       method.method === 'DECLINING_BALANCE' ? 'Declining Balance' :
                       method.method === 'UNITS_OF_PRODUCTION' ? 'Units of Production' :
                       method.method === 'SUM_OF_YEARS_DIGITS' ? 'Sum of Years Digits' :
                       method.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{method.assetCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(method.purchaseValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(method.currentBookValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(method.accumulatedDepreciation)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Depreciation by Department</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Purchase Value</TableHead>
                <TableHead className="text-right">Current Book Value</TableHead>
                <TableHead className="text-right">Accumulated Depreciation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.byDepartment.map((dept) => (
                <TableRow key={dept.departmentId || 'unassigned'}>
                  <TableCell className="font-medium">{dept.departmentName}</TableCell>
                  <TableCell className="text-right">{dept.assetCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(dept.purchaseValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(dept.currentBookValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(dept.accumulatedDepreciation)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}