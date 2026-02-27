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
  FileText, 
  Download, 
  Filter,
  Calendar,
  Users,
  TrendingUp,
  Printer
} from "lucide-react";
import { LeaveReportData } from "@/lib/actions/reports-actions";
import { DatePicker } from "@/components/ui/date-picker";

interface LeaveReportsViewProps {
  leaveReports: LeaveReportData[];
  filterOptions: {
    departments: { id: string; name: string }[];
    leaveTypes: { id: string; name: string }[];
    users: { id: string; name: string; employeeId: string }[];
  };
  businessUnitId: string;
  businessUnitName?: string;
  currentFilters: {
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
    leaveTypeId?: string;
    userId?: string;
  };
}

export function LeaveReportsView({
  leaveReports,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: LeaveReportsViewProps) {
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
    leaveTypeId: currentFilters.leaveTypeId || 'all',
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
    router.push(`/${businessUnitId}/reports/leave?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      departmentId: 'all',
      leaveTypeId: 'all',
      userId: 'all'
    });
    router.push(`/${businessUnitId}/reports/leave`);
  };

  const exportToCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Leave Type',
      'Start Date',
      'End Date',
      'Days',
      'Session',
      'Reason',
      'Manager Approved By',
      'Manager Approved At',
      'HR Approved By',
      'HR Approved At',
      'Request Date'
    ];

    const csvData = leaveReports.map(report => [
      report.user.employeeId,
      report.user.name,
      report.user.department?.name || 'No Department',
      report.leaveType.name,
      report.startDate.toLocaleDateString(),
      report.endDate.toLocaleDateString(),
      report.days.toString(),
      report.session,
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Create filename with business unit name
    const businessUnitSlug = businessUnitName 
      ? businessUnitName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : 'business-unit';
    link.setAttribute('download', `${businessUnitSlug}-leave-reports-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Leave Reports</title>
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
            <h2>Leave Reports</h2>
          </div>
          
          <div class="meta-info">
            <strong>Report Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>
            <strong>Total Leave Requests:</strong> ${leaveReports.length}<br>
            ${filters.startDate ? `<strong>Start Date:</strong> ${new Date(filters.startDate).toLocaleDateString()}<br>` : ''}
            ${filters.endDate ? `<strong>End Date:</strong> ${new Date(filters.endDate).toLocaleDateString()}<br>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Session</th>
                <th>Reason</th>
                <th>Manager Approved By</th>
                <th>HR Approved By</th>
                <th>Request Date</th>
              </tr>
            </thead>
            <tbody>
              ${leaveReports.length === 0 ? 
                '<tr><td colspan="12" class="no-data">No approved leave requests found</td></tr>' :
                leaveReports.map(report => `
                  <tr>
                    <td class="employee-info">${report.user.employeeId}</td>
                    <td class="employee-info">${report.user.name}</td>
                    <td>${report.user.department?.name || 'No Department'}</td>
                    <td>${report.leaveType.name}</td>
                    <td>${report.startDate.toLocaleDateString()}</td>
                    <td>${report.endDate.toLocaleDateString()}</td>
                    <td>${report.days}</td>
                    <td>${report.session}</td>
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
  const totalRequests = leaveReports.length;
  const totalDays = leaveReports.reduce((sum, report) => sum + report.days, 0);
  const uniqueEmployees = new Set(leaveReports.map(report => report.user.id)).size;
  const avgDaysPerRequest = totalRequests > 0 ? Math.round((totalDays / totalRequests) * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Leave Reports</h1>
          <p className="text-muted-foreground">
            View and analyze approved leave requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={printReport} disabled={leaveReports.length === 0} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={leaveReports.length === 0} variant="outline" size="sm">
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
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              Approved leave requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDays}</div>
            <p className="text-xs text-muted-foreground">
              Days of leave taken
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Unique employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Days/Request</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDaysPerRequest}</div>
            <p className="text-xs text-muted-foreground">
              Average duration
            </p>
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
          <Label className="text-sm font-medium">Leave Type</Label>
          <Select value={filters.leaveTypeId} onValueChange={(value) => handleFilterChange('leaveTypeId', value)}>
             <SelectTrigger className="w-full">
              <SelectValue placeholder="All Leave Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leave Types</SelectItem>
              {filterOptions.leaveTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
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
            {(filters.startDate || filters.endDate || filters.departmentId !== 'all' || filters.leaveTypeId !== 'all' || filters.userId !== 'all') && (
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {leaveReports.length} approved leave requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Approved By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No approved leave requests found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              leaveReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{report.user.name}</p>
                      <p className="text-sm text-muted-foreground">{report.user.employeeId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {report.user.department?.name || 'No Department'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {report.leaveType.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.startDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {report.endDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{report.days}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {report.session}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={report.reason}>
                      {report.reason}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {report.managerActionBy && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">Manager</Badge>
                          <span className="text-xs">{report.managerActionBy}</span>
                        </div>
                      )}
                      {report.hrActionBy && (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">HR</Badge>
                          <span className="text-xs">{report.hrActionBy}</span>
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
        {leaveReports.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                No approved leave requests found for the selected criteria.
              </div>
            </CardContent>
          </Card>
        ) : (
          leaveReports.map((report) => (
            <Card key={report.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{report.user.name}</p>
                      <p className="text-sm text-muted-foreground">{report.user.employeeId}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.user.department?.name || 'No Department'}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {report.leaveType.name}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Start Date:</span>
                      <p className="font-medium">{report.startDate.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End Date:</span>
                      <p className="font-medium">{report.endDate.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Days:</span>
                      <p className="font-medium">{report.days}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Session:</span>
                      <Badge variant="outline" className="text-xs">
                        {report.session}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-sm">Reason:</span>
                    <p className="text-sm mt-1">{report.reason}</p>
                  </div>

                  <div className="space-y-2">
                    {report.managerActionBy && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Manager</Badge>
                        <span className="text-xs">{report.managerActionBy}</span>
                      </div>
                    )}
                    {report.hrActionBy && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">HR</Badge>
                        <span className="text-xs">{report.hrActionBy}</span>
                      </div>
                    )}
                  </div>

                  {(report.managerComments || report.hrComments) && (
                    <div className="space-y-2 pt-2 border-t">
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}