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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users,
  Download, 
  Filter,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle,
  Printer,
  BarChart3,
  PieChart,
  Calendar,
  Building2
} from "lucide-react";
import { DeploymentReportSummary, DeploymentReportData, DeploymentReportFilters } from "@/lib/actions/deployment-reports-actions";
import { DatePicker } from "@/components/ui/date-picker";
import { DeploymentStatus } from "@prisma/client";

interface DeploymentSummaryViewProps {
  summaryData: DeploymentReportSummary;
  reportData: DeploymentReportData[];
  filterOptions: {
    employees: Array<{
      id: string;
      name: string;
      employeeId: string;
    }>;
    departments: Array<{
      id: string;
      name: string;
    }>;
    categories: Array<{
      id: string;
      name: string;
      code: string;
    }>;
  };
  businessUnitId: string;
  businessUnitName?: string;
  currentFilters: DeploymentReportFilters;
}

const STATUS_LABELS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "Pending Approval",
  [DeploymentStatus.DEPLOYED]: "Deployed",
  [DeploymentStatus.RETURNED]: "Returned",
  APPROVED: "Approved",
};

export function DeploymentSummaryView({
  summaryData,
  reportData,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: DeploymentSummaryViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    startDate: currentFilters.startDate ? currentFilters.startDate.toISOString().split('T')[0] : '',
    endDate: currentFilters.endDate ? currentFilters.endDate.toISOString().split('T')[0] : '',
    employeeId: currentFilters.employeeId || 'all',
    departmentId: currentFilters.departmentId || 'all',
    categoryId: currentFilters.categoryId || 'all',
    status: currentFilters.status || 'ALL',
    includeReturned: currentFilters.includeReturned !== false
  });

  const handleFilterChange = (key: string, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== 'all' && filterValue !== 'ALL') {
        params.set(filterKey, filterValue.toString());
      }
    });
    params.set('tab', 'summary');
    router.push(`/${businessUnitId}/reports/deployments?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      employeeId: 'all',
      departmentId: 'all',
      categoryId: 'all',
      status: 'ALL',
      includeReturned: true
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Report Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <DatePicker
              date={filters.startDate ? new Date(filters.startDate) : undefined}
              onDateChange={(date) => handleFilterChange('startDate', date ? date.toISOString().split('T')[0] : '')}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <DatePicker
              date={filters.endDate ? new Date(filters.endDate) : undefined}
              onDateChange={(date) => handleFilterChange('endDate', date ? date.toISOString().split('T')[0] : '')}
            />
          </div>

          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={filters.employeeId} onValueChange={(value) => handleFilterChange('employeeId', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {filterOptions.employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} ({employee.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={filters.departmentId} onValueChange={(value) => handleFilterChange('departmentId', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {filterOptions.departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Asset Category</Label>
            <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterOptions.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeReturned"
            checked={filters.includeReturned}
            onCheckedChange={(checked) => handleFilterChange('includeReturned', checked)}
          />
          <Label htmlFor="includeReturned">Include returned assets</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={applyFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalDeployments}</div>
            <p className="text-xs text-muted-foreground">
              All deployment records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summaryData.activeDeployments}</div>
            <p className="text-xs text-muted-foreground">
              Currently deployed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Returned Assets</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summaryData.returnedDeployments}</div>
            <p className="text-xs text-muted-foreground">
              Successfully returned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summaryData.pendingApproval}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asset Value</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₱{formatCurrency(summaryData.totalAssetValue)}</div>
            <p className="text-xs text-muted-foreground">
              Current book value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{Math.round(summaryData.averageDeploymentDuration)}</div>
            <p className="text-xs text-muted-foreground">
              days (returned assets)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Department Breakdown</h3>
          </div>
          <div className="space-y-4">
            {summaryData.departmentBreakdown.slice(0, 8).map((dept, index) => (
              <div key={dept.departmentName} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{dept.departmentName}</p>
                    <p className="text-sm text-muted-foreground">₱{formatCurrency(dept.totalValue)}</p>
                  </div>
                </div>
                <Badge variant="secondary">{dept.count} assets</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Category Breakdown</h3>
          </div>
          <div className="space-y-4">
            {summaryData.categoryBreakdown.slice(0, 8).map((category, index) => (
              <div key={category.categoryName} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{category.categoryName}</p>
                    <p className="text-sm text-muted-foreground">₱{formatCurrency(category.totalValue)}</p>
                  </div>
                </div>
                <Badge variant="secondary">{category.count} assets</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Deployments Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Deployments</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transmittal #</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Deployed Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Asset Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.slice(0, 10).map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell className="font-mono text-xs">{deployment.transmittalNumber}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deployment.asset.itemCode}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {deployment.asset.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deployment.employee.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {deployment.employee.employeeId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{deployment.employee.department?.name || 'No Department'}</TableCell>
                  <TableCell>
                    {deployment.deployedDate 
                      ? new Date(deployment.deployedDate).toLocaleDateString()
                      : 'Not deployed'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {STATUS_LABELS[deployment.status] || deployment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₱{formatCurrency(deployment.asset.currentBookValue || deployment.asset.purchasePrice || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {reportData.length > 10 && (
          <div className="text-center py-4 text-muted-foreground">
            Showing 10 of {reportData.length} deployments. View detailed report for complete data.
          </div>
        )}
      </div>
    </div>
  );
}