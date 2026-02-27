"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Calendar, 
  Heart,
  Sun,
  Clock,
  AlertTriangle,
  Briefcase,
  Clock3,
  Filter,
  FolderOpen
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { PendingApprovalsResponse } from "@/lib/actions/approval-actions";
import { ApprovalActions } from "@/components/approvals/approval-actions";

interface PendingLeaveApprovalsViewProps {
  approvalsData: PendingApprovalsResponse;
  businessUnitId: string;
  currentFilters: {
    status?: string;
    type?: string;
    page: number;
  };
  currentUserRole: string;
}

function getLeaveTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sick')) return Heart;
  if (lowerName.includes('vacation')) return Sun;
  if (lowerName.includes('cto')) return Clock;
  if (lowerName.includes('mandatory')) return AlertTriangle;
  return Briefcase;
}

function formatRequestStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING_MANAGER':
      return 'Pending Approver';
    case 'PENDING_HR':
      return 'Pending HR';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function getStatusVariant(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
      return 'secondary';
    default:
      return 'outline';
  }
}

const statusOptions = [
  { value: 'PENDING_MANAGER', label: 'Pending Approver', icon: Clock3 },
  { value: 'PENDING_HR', label: 'Pending HR', icon: Clock3 }
];

function getSessionDisplay(session: string) {
  switch (session.toUpperCase()) {
    case 'MORNING':
      return 'Morning (0.5 day)';
    case 'AFTERNOON':
      return 'Afternoon (0.5 day)';
    default:
      return 'Full Day';
  }
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PendingLeaveApprovalsView({ 
  approvalsData, 
  businessUnitId,
  currentFilters,
  currentUserRole
}: PendingLeaveApprovalsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requests = approvalsData.leaveRequests;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.leaveType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatRequestStatus(request.status).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/approvals/leave/pending?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/${businessUnitId}/approvals/leave/pending?${params.toString()}`);
  };

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pending Leave Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve leave requests from your team
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by employee, leave type, reason, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Status Filter */}
        <Select
          value={currentFilters.status || ""}
          onValueChange={(value) => updateFilter('status', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>All statuses</span>
              </div>
            </SelectItem>
            {statusOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Leave Type Filter */}
        <Select
          value={currentFilters.type || ""}
          onValueChange={(value) => updateFilter('type', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All types" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-types">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span>All types</span>
              </div>
            </SelectItem>
            {approvalsData.leaveTypes.map((type) => {
              const Icon = getLeaveTypeIcon(type.name);
              return (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{type.name}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} pending requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending leave requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const Icon = getLeaveTypeIcon(request.leaveType.name);
                const isMultiDay = request.startDate.getTime() !== request.endDate.getTime();
                
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md">
                          <AvatarImage 
                            src={request.user.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.user.profilePicture)}?direct=true` : undefined}
                            alt={request.user.name}
                          />
                          <AvatarFallback>{getUserInitials(request.user.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{request.user.name}</div>
                          <div className="text-sm text-muted-foreground">{request.user.employeeId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.leaveType.name} LEAVE</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isMultiDay 
                        ? `${format(request.startDate, 'MMM dd')} - ${format(request.endDate, 'MMM dd, yyyy')}`
                        : format(request.startDate, 'MMM dd, yyyy')
                      }
                    </TableCell>
                    <TableCell>{getSessionDisplay(request.session)}</TableCell>
                    <TableCell className="font-medium">
                      {request.days} {request.days === 1 ? 'day' : 'days'}
                    </TableCell>
                    <TableCell>{format(request.createdAt, "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ApprovalActions 
                        request={request} 
                        businessUnitId={businessUnitId}
                        currentUserRole={currentUserRole}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending leave requests found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const Icon = getLeaveTypeIcon(request.leaveType.name);
            const isMultiDay = request.startDate.getTime() !== request.endDate.getTime();
            
            return (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage 
                          src={request.user.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.user.profilePicture)}?direct=true` : undefined}
                          alt={request.user.name}
                        />
                        <AvatarFallback>{getUserInitials(request.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{request.user.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{request.user.employeeId}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(request.status)}>
                      {formatRequestStatus(request.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.leaveType.name} LEAVE</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date Range:</span>
                      <p className="font-medium">
                        {isMultiDay 
                          ? `${format(request.startDate, 'MMM dd')} - ${format(request.endDate, 'MMM dd, yyyy')}`
                          : format(request.startDate, 'MMM dd, yyyy')
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Session:</span>
                      <p className="font-medium">{getSessionDisplay(request.session)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="font-medium">{request.days} {request.days === 1 ? 'day' : 'days'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p className="font-medium">{format(request.createdAt, "MMM dd, yyyy")}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-sm">Reason:</span>
                    <p className="text-sm mt-1">{request.reason}</p>
                  </div>

                  {(request.managerComments || request.hrComments) && (
                    <div className="bg-muted/50 border rounded-md p-3">
                      {request.managerComments && (
                        <div className="text-xs">
                          <span className="font-medium">Approver Remarks:</span> {request.managerComments}
                        </div>
                      )}
                      {request.hrComments && (
                        <div className="text-xs">
                          <span className="font-medium">HR Remarks:</span> {request.hrComments}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <ApprovalActions 
                      request={request} 
                      businessUnitId={businessUnitId}
                      currentUserRole={currentUserRole}
                      isMobile={true}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {approvalsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((approvalsData.pagination.currentPage - 1) * 10) + 1} to{' '}
            {Math.min(approvalsData.pagination.currentPage * 10, approvalsData.pagination.totalCount)} of{' '}
            {approvalsData.pagination.totalCount} requests
          </div>
          
          <div className="flex gap-2">
            {approvalsData.pagination.hasPrev && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(approvalsData.pagination.currentPage - 1)}
              >
                Previous
              </Button>
            )}
            
            {approvalsData.pagination.hasNext && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(approvalsData.pagination.currentPage + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}