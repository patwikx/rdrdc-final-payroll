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
  Clock, 
  Download, 
  Filter, 
  Users,
  TrendingUp,
  Calendar,
  Printer
} from "lucide-react";
import { OvertimeReportData } from "@/lib/actions/reports-actions";
import { DatePicker } from "@/components/ui/date-picker";

interface OvertimeReportsViewProps {
  overtimeReports: OvertimeReportData[];
  filterOptions: {
    departments: { id: string; name: string }[];
    users: { id: string; name: string; employeeId: string }[];
  };
  businessUnitId: string;
  businessUnitName?: string;
  currentFilters: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    userId?: string;
  };
}

export function OvertimeReportsView({
  overtimeReports,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: OvertimeReportsViewProps) {
  const router = useRouter();
  
  // Helper function to format date for input without timezone issues
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filters, setFilters] = useState({
    startDate: currentFilters.startDate ? formatDateForInput(currentFilters.startDate) : '',
    endDate: currentFilters.endDate ? formatDateForInput(currentFilters.endDate) : '',
    departmentId: currentFilters.departmentId || 'all',
    userId: currentFilters.userId || 'all'
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
    router.push(`/${businessUnitId}/reports/overtime?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      departmentId: 'all',
      userId: 'all'
    });
    router.push(`/${businessUnitId}/reports/overtime`);
  };

  const exportToCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Start Time',
      'End Time',
      'Hours',
      'Reason',
      'Manager Approved By',
      'Manager Approved At',
      'HR Approved By',
      'HR Approved At',
      'Request Date'
    ];

    const csvData = overtimeReports.map(report => [
      report.user.employeeId,
      report.user.name,
      report.user.department?.name || 'No Department',
      report.startTime.toLocaleString(),
      report.endTime.toLocaleString(),
      report.hours.toString(),
      report.reason,
      report.managerActionBy || '',
      report.managerActionAt ? report.managerActionAt.toLocaleDateString() : '',
      report.hrActionBy || '',
      report.hrActionAt ? report.hrActionAt.toLocaleDateString() : '',
      report.createdAt.toLocaleDateString()
    ]);

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
    a.download = `${businessUnitSlug}-overtime-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printReport = () => {
    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Overtime Reports</title>
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
            <h2>Overtime Reports</h2>
          </div>
          
          <div class="meta-info">
            <strong>Report Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
            <strong>Total Overtime Requests:</strong> ${overtimeReports.length}<br>
            ${filters.startDate ? `<strong>Start Date:</strong> ${new Date(filters.startDate).toLocaleDateString()}<br>` : ''}
            ${filters.endDate ? `<strong>End Date:</strong> ${new Date(filters.endDate).toLocaleDateString()}<br>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Manager Approved By</th>
                <th>HR Approved By</th>
                <th>Request Date</th>
              </tr>
            </thead>
            <tbody>
              ${overtimeReports.length === 0 ? 
                '<tr><td colspan="10" class="no-data">No approved overtime requests found</td></tr>' :
                overtimeReports.map(report => `
                  <tr>
                    <td class="employee-info">${report.user.employeeId}</td>
                    <td class="employee-info">${report.user.name}</td>
                    <td>${report.user.department?.name || 'No Department'}</td>
                    <td>${report.startTime.toLocaleString()}</td>
                    <td>${report.endTime.toLocaleString()}</td>
                    <td>${report.hours}</td>
                    <td>${report.reason}</td>
                    <td>${report.managerActionBy || '-'}</td>
                    <td>${report.hrActionBy || '-'}</td>
                    <td>${report.createdAt.toLocaleDateString()}</td>
                  </tr>
                `).join('')
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
  const totalHours = overtimeReports.reduce((sum, report) => sum + report.hours, 0);
  const uniqueEmployees = new Set(overtimeReports.map(report => report.user.id)).size;
  const avgHoursPerRequest = overtimeReports.length > 0 ? totalHours / overtimeReports.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Overtime Reports</h1>
          <p className="text-sm text-muted-foreground">
            Approved overtime requests and analytics
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={printReport} disabled={overtimeReports.length === 0} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={overtimeReports.length === 0} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overtimeReports.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Hours/Request</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgHoursPerRequest.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Start Date</Label>
          <DatePicker
            date={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : undefined}
            onDateChange={(date) => handleFilterChange('startDate', date ? formatDateForInput(date) : '')}
            placeholder="Start date"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm font-medium">End Date</Label>
          <DatePicker
            date={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : undefined}
            onDateChange={(date) => handleFilterChange('endDate', date ? formatDateForInput(date) : '')}
            placeholder="End date"
          />
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
            {(filters.startDate || filters.endDate || filters.departmentId !== 'all' || filters.userId !== 'all') && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {overtimeReports.length} approved overtime requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time Period</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Approved By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overtimeReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No approved overtime requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              overtimeReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{report.user.name}</div>
                      <div className="text-sm text-muted-foreground">{report.user.employeeId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {report.user.department?.name || 'No Department'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {report.startTime.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{report.startTime.toLocaleTimeString()}</div>
                      <div className="text-muted-foreground">to {report.endTime.toLocaleTimeString()}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {report.hours}h
                  </TableCell>
                  <TableCell>{report.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={report.reason}>
                      {report.reason}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {report.managerActionBy && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-blue-600" />
                          <span className="text-xs">Manager: {report.managerActionBy}</span>
                        </div>
                      )}
                      {report.hrActionBy && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-purple-600" />
                          <span className="text-xs">HR: {report.hrActionBy}</span>
                        </div>
                      )}
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
        {overtimeReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No approved overtime requests found</p>
            </CardContent>
          </Card>
        ) : (
          overtimeReports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Overtime Request</CardTitle>
                  </div>
                  <Badge className="text-xs">Approved</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Employee:</span>
                    <p className="font-medium">{report.user.name}</p>
                    <p className="text-xs text-muted-foreground">{report.user.employeeId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{report.user.department?.name || 'No Department'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">{report.startTime.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hours:</span>
                    <p className="font-medium">{report.hours}h</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time Period:</span>
                    <p className="font-medium">
                      {report.startTime.toLocaleTimeString()} - {report.endTime.toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>
                    <p className="font-medium">{report.createdAt.toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Reason:</span>
                  <p className="text-sm mt-1">{report.reason}</p>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Approved By:</span>
                  <div className="mt-1 space-y-1">
                    {report.managerActionBy && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-blue-600" />
                        <span className="text-xs">Manager: {report.managerActionBy}</span>
                      </div>
                    )}
                    {report.hrActionBy && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-purple-600" />
                        <span className="text-xs">HR: {report.hrActionBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(report.managerComments || report.hrComments) && (
                  <div className="bg-muted/50 border rounded-md p-3">
                    {report.managerComments && (
                      <div className="text-xs">
                        <span className="font-medium">Manager:</span> {report.managerComments}
                      </div>
                    )}
                    {report.hrComments && (
                      <div className="text-xs">
                        <span className="font-medium">HR:</span> {report.hrComments}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>


    </div>
  );
}