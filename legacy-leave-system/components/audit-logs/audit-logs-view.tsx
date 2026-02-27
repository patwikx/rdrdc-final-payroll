"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Shield,
  Filter,
  CalendarIcon,
  User,
  Activity,
  Database,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { Prisma } from "@prisma/client";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  oldValues: Prisma.JsonValue | null;
  newValues: Prisma.JsonValue | null;
  userId: string;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  employee: {
    id: string;
    name: string;
    employeeId: string;
    email: string | null;
    role: string;
    businessUnit: {
      id: string;
      name: string;
    } | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
}

interface AuditLogsData {
  logs: AuditLog[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AuditLogsViewProps {
  auditLogsData: AuditLogsData;
  businessUnitId: string;
  currentFilters: {
    tableName?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page: number;
  };
}

function getActionIcon(action: string) {
  switch (action.toUpperCase()) {
    case 'LOGIN':
      return LogIn;
    case 'LOGOUT':
      return LogOut;
    case 'CREATE':
      return Plus;
    case 'UPDATE':
      return Edit;
    case 'DELETE':
      return Trash2;
    default:
      return Activity;
  }
}

function getActionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  switch (action.toUpperCase()) {
    case 'LOGIN':
      return 'default';
    case 'LOGOUT':
      return 'secondary';
    case 'CREATE':
      return 'default';
    case 'UPDATE':
      return 'outline';
    case 'DELETE':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function formatTableName(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AuditLogsView({ 
  auditLogsData, 
  businessUnitId,
  currentFilters,
}: AuditLogsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logs = auditLogsData.logs;
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    currentFilters.startDate ? new Date(currentFilters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    currentFilters.endDate ? new Date(currentFilters.endDate) : undefined
  );

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== `all-${key}`) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/audit-logs?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/${businessUnitId}/audit-logs?${params.toString()}`);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      updateFilter("startDate", date.toISOString().split('T')[0]);
    } else {
      updateFilter("startDate", undefined);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      updateFilter("endDate", date.toISOString().split('T')[0]);
    } else {
      updateFilter("endDate", undefined);
    }
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    router.push(`/${businessUnitId}/audit-logs`);
  };

  const uniqueTableNames = Array.from(new Set(logs.map(log => log.tableName)));
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  
  const hasActiveFilters = currentFilters.tableName || currentFilters.action || currentFilters.startDate || currentFilters.endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            System activity and security logs
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Total Events</span>
          </div>
          <div className="text-3xl font-bold">{auditLogsData.pagination.totalCount}</div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <LogIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Login Events</span>
          </div>
          <div className="text-3xl font-bold">
            {logs.filter(log => log.action === 'LOGIN').length}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Logout Events</span>
          </div>
          <div className="text-3xl font-bold">
            {logs.filter(log => log.action === 'LOGOUT').length}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Data Changes</span>
          </div>
          <div className="text-3xl font-bold">
            {logs.filter(log => ['CREATE', 'UPDATE', 'DELETE'].includes(log.action)).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {[currentFilters.tableName, currentFilters.action, currentFilters.startDate, currentFilters.endDate].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <div className="p-2 space-y-4">
              {/* Table/Module Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Table/Module</label>
                <Select
                  value={currentFilters.tableName || "all-tableName"}
                  onValueChange={(value) => updateFilter("tableName", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-tableName">All Tables</SelectItem>
                    {uniqueTableNames.map((tableName) => (
                      <SelectItem key={tableName} value={tableName}>
                        {formatTableName(tableName)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select
                  value={currentFilters.action || "all-action"}
                  onValueChange={(value) => updateFilter("action", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-action">All Actions</SelectItem>
                    {uniqueActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM dd") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={handleStartDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM dd") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}

        {/* Active Filters Display */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentFilters.tableName && (
            <Badge variant="secondary" className="gap-1">
              Table: {formatTableName(currentFilters.tableName)}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("tableName", undefined)}
              />
            </Badge>
          )}
          {currentFilters.action && (
            <Badge variant="secondary" className="gap-1">
              Action: {currentFilters.action}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("action", undefined)}
              />
            </Badge>
          )}
          {currentFilters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {format(new Date(currentFilters.startDate), "MMM dd, yyyy")}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  setStartDate(undefined);
                  updateFilter("startDate", undefined);
                }}
              />
            </Badge>
          )}
          {currentFilters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {format(new Date(currentFilters.endDate), "MMM dd, yyyy")}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  setEndDate(undefined);
                  updateFilter("endDate", undefined);
                }}
              />
            </Badge>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Activity Log
        </h3>
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const ActionIcon = getActionIcon(log.action);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{log.employee.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {log.employee.employeeId}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionVariant(log.action)} className="gap-1">
                              <ActionIcon className="h-3 w-3" />
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatTableName(log.tableName)}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.ipAddress || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((auditLogsData.pagination.currentPage - 1) * auditLogsData.pagination.pageSize) + 1} to{" "}
                {Math.min(
                  auditLogsData.pagination.currentPage * auditLogsData.pagination.pageSize,
                  auditLogsData.pagination.totalCount
                )}{" "}
                of {auditLogsData.pagination.totalCount} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(auditLogsData.pagination.currentPage - 1)}
                  disabled={!auditLogsData.pagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(auditLogsData.pagination.currentPage + 1)}
                  disabled={!auditLogsData.pagination.hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="font-mono text-sm">
                    {format(new Date(selectedLog.timestamp), "PPpp")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <div className="mt-1">
                    <Badge variant={getActionVariant(selectedLog.action)}>
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <p className="text-sm">{selectedLog.employee.name} ({selectedLog.employee.employeeId})</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <p className="text-sm">{selectedLog.employee.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Table</label>
                  <p className="text-sm">{formatTableName(selectedLog.tableName)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Record ID</label>
                  <p className="font-mono text-xs">{selectedLog.recordId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                  <p className="font-mono text-sm">{selectedLog.ipAddress || "—"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Business Unit</label>
                  <p className="text-sm">{selectedLog.employee.businessUnit?.name || "—"}</p>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                  <p className="text-xs font-mono bg-muted p-2 rounded mt-1 break-all">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}

              {selectedLog.oldValues && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Old Values</label>
                  <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">New Values</label>
                  <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
