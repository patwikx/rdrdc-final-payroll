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
  Users, 
  Download, 
  Filter, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Printer
} from "lucide-react";
import { EmployeeReportData } from "@/lib/actions/reports-actions";

interface EmployeeReportsViewProps {
  employeeReports: EmployeeReportData[];
  filterOptions: {
    departments: { id: string; name: string }[];
    users: { id: string; name: string; employeeId: string }[];
  };
  businessUnitId: string;
  businessUnitName?: string;
  currentFilters: {
    departmentId?: string;
    userId?: string;
    year?: number;
  };
}

export function EmployeeReportsView({
  employeeReports,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: EmployeeReportsViewProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState({
    departmentId: currentFilters.departmentId || 'all',
    userId: currentFilters.userId || 'all',
    year: currentFilters.year?.toString() || currentYear.toString()
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
    router.push(`/${businessUnitId}/reports/employees?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      departmentId: 'all',
      userId: 'all',
      year: currentYear.toString()
    });
    router.push(`/${businessUnitId}/reports/employees?year=${currentYear}`);
  };

  const exportToCSV = () => {
    // Get all unique leave types to create dynamic headers
    const allLeaveTypes = new Set<string>();
    employeeReports.forEach(employee => {
      employee.leaveBalances.forEach(balance => {
        allLeaveTypes.add(balance.leaveType.name);
      });
    });
    const leaveTypeNames = Array.from(allLeaveTypes).sort();

    // Create headers: basic info + columns for each leave type
    const basicHeaders = ['Employee ID', 'Employee Name', 'Department'];
    const leaveHeaders: string[] = [];
    leaveTypeNames.forEach(leaveType => {
      leaveHeaders.push(
        `${leaveType} - Used`,
        `${leaveType} - Allocated`,
        `${leaveType} - Remaining`
      );
    });
    const headers = [...basicHeaders, ...leaveHeaders, 'Year'];

    const csvData: string[][] = [];
    employeeReports.forEach(employee => {
      const row = [
        employee.employeeId,
        employee.name,
        employee.department?.name || 'No Department'
      ];

      // Create a map of leave balances for easy lookup
      const balanceMap = new Map();
      employee.leaveBalances.forEach(balance => {
        balanceMap.set(balance.leaveType.name, balance);
      });

      // Add data for each leave type (in consistent order)
      leaveTypeNames.forEach(leaveType => {
        const balance = balanceMap.get(leaveType);
        if (balance) {
          row.push(
            balance.usedDays.toString(),
            balance.allocatedDays.toString(),
            balance.remainingDays.toString()
          );
        } else {
          // If employee doesn't have this leave type, add empty values
          row.push('0', '0', '0');
        }
      });

      // Add year (assuming all balances are for the same year)
      const year = employee.leaveBalances.length > 0 ? employee.leaveBalances[0].year.toString() : filters.year;
      row.push(year);

      csvData.push(row);
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Create filename with business unit name
    const businessUnitSlug = businessUnitName 
      ? businessUnitName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : 'business-unit';
    a.download = `${businessUnitSlug}-employee-leave-balances-${filters.year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printReport = () => {
    // Get all unique leave types for consistent column headers
    const allLeaveTypes = new Set<string>();
    employeeReports.forEach(employee => {
      employee.leaveBalances.forEach(balance => {
        allLeaveTypes.add(balance.leaveType.name);
      });
    });
    const leaveTypeNames = Array.from(allLeaveTypes).sort();

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Leave Balances Report</title>
          <style>
            @page {
              size: landscape;
              margin: 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 22px;
              color: #333;
              font-weight: bold;
            }
            .header h2 {
              margin: 5px 0;
              font-size: 16px;
              color: #666;
              font-weight: normal;
            }
            .meta-info {
              margin-bottom: 15px;
              font-size: 11px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: left;
              font-size: 10px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
              text-align: center;
            }
            .employee-info {
              font-weight: bold;
            }
            .leave-data {
              text-align: center;
            }
            .no-data {
              text-align: center;
              font-style: italic;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${businessUnitName || 'Business Unit'}</h1>
            <h2>Employee Leave Balances Report</h2>
          </div>
          
          <div class="meta-info">
            <strong>Report Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
            <strong>Year:</strong> ${filters.year}<br>
            <strong>Total Employees:</strong> ${employeeReports.length}
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2">Employee ID</th>
                <th rowspan="2">Employee Name</th>
                <th rowspan="2">Department</th>
                ${leaveTypeNames.map(leaveType => `<th colspan="3">${leaveType}</th>`).join('')}
              </tr>
              <tr>
                ${leaveTypeNames.map(() => '<th>Used</th><th>Allocated</th><th>Remaining</th>').join('')}
              </tr>
            </thead>
            <tbody>
              ${employeeReports.length === 0 ? 
                `<tr><td colspan="${3 + (leaveTypeNames.length * 3)}" class="no-data">No employee leave balances found</td></tr>` :
                employeeReports.map(employee => {
                  // Create a map of leave balances for easy lookup
                  const balanceMap = new Map<string, typeof employee.leaveBalances[0]>();
                  employee.leaveBalances.forEach(balance => {
                    balanceMap.set(balance.leaveType.name, balance);
                  });

                  return `
                    <tr>
                      <td class="employee-info">${employee.employeeId}</td>
                      <td class="employee-info">${employee.name}</td>
                      <td>${employee.department?.name || 'No Department'}</td>
                      ${leaveTypeNames.map(leaveType => {
                        const balance = balanceMap.get(leaveType);
                        if (balance) {
                          return `
                            <td class="leave-data">${balance.usedDays}</td>
                            <td class="leave-data">${balance.allocatedDays}</td>
                            <td class="leave-data">${balance.remainingDays}</td>
                          `;
                        } else {
                          return '<td class="leave-data">0</td><td class="leave-data">0</td><td class="leave-data">0</td>';
                        }
                      }).join('')}
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  // Calculate statistics
  const totalEmployees = employeeReports.length;
  const totalAllocatedDays = employeeReports.reduce((sum, emp) => 
    sum + emp.leaveBalances.reduce((empSum, balance) => empSum + balance.allocatedDays, 0), 0
  );
  const totalUsedDays = employeeReports.reduce((sum, emp) => 
    sum + emp.leaveBalances.reduce((empSum, balance) => empSum + balance.usedDays, 0), 0
  );

  const overallUsagePercentage = totalAllocatedDays > 0 ? (totalUsedDays / totalAllocatedDays) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Employee Reports</h1>
          <p className="text-muted-foreground">
            View and analyze employee leave balances
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={printReport} disabled={employeeReports.length === 0} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={employeeReports.length === 0} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAllocatedDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsedDays}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Usage</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallUsagePercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">of allocated days</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Year</Label>
          <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)}>
          <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
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
          <Label className="text-sm font-medium">Employee</Label>
          <Select value={filters.userId} onValueChange={(value) => handleFilterChange('userId', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {filterOptions.users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter action buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">&nbsp;</Label>
          <div className="flex gap-2">
            <Button onClick={applyFilters} className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            {(filters.departmentId !== 'all' || filters.userId !== 'all' || filters.year !== currentYear.toString()) && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {employeeReports.length} employee leave balances
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Leave Balances</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeeReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No employee leave balances found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employeeReports.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-muted-foreground">{employee.employeeId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {employee.department?.name || 'No Department'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 overflow-x-auto">
                      {employee.leaveBalances.map((balance) => {
                        const usagePercentage = balance.allocatedDays > 0 
                          ? ((balance.usedDays / balance.allocatedDays) * 100).toFixed(1)
                          : '0.0';
                        
                        return (
                          <div key={balance.leaveType.id} className="flex items-center gap-2 text-xs flex-shrink-0">
                            <span className="font-medium">
                              {balance.leaveType.name}
                            </span>
                            <span className="text-muted-foreground">
                              {balance.usedDays}/{balance.allocatedDays}
                            </span>
                            <div className="bg-gray-200 rounded-full h-2 w-32">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, parseFloat(usagePercentage))}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground font-medium">
                              {usagePercentage}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {employeeReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No employee leave balances found</p>
            </CardContent>
          </Card>
        ) : (
          employeeReports.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{employee.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {employee.employeeId} • {employee.department?.name || 'No Department'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-3">
                  {employee.leaveBalances.map((balance) => {
                    const usagePercentage = balance.allocatedDays > 0 
                      ? ((balance.usedDays / balance.allocatedDays) * 100).toFixed(1)
                      : '0.0';
                    
                    return (
                      <div key={balance.leaveType.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {balance.leaveType.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Year {balance.year}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Allocated:</span>
                            <p className="font-medium">{balance.allocatedDays} days</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Used:</span>
                            <p className="font-medium">{balance.usedDays} days</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Remaining:</span>
                            <p className="font-medium">{balance.remainingDays} days</p>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Usage:</span>
                            <span className="font-medium">{usagePercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, parseFloat(usagePercentage))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}