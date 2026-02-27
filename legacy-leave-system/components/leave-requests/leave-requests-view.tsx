"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Calendar, 
  Eye, 
  Plus,
  Heart,
  Sun,
  Clock,
  AlertTriangle,
  Briefcase,
  X,
  CheckCircle,
  XCircle,
  Clock3,
  Filter,
  FolderOpen,
  User
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LeaveRequestsResponse, LeaveRequestWithDetails } from "@/lib/actions/leave-request-actions";
import { LeaveRequestDetails } from "./leave-request-details";

interface LeaveRequestsViewProps {
  leaveRequestsData: LeaveRequestsResponse;
  businessUnitId: string;
  currentFilters: {
    status?: string;
    type?: string;
    page: number;
  };
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
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
    case 'PENDING':
      return 'Pending Approval';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function getStatusVariant(status: string) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
    case 'CANCELLED':
      return 'destructive';
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
    case 'PENDING':
      return 'secondary';
    default:
      return 'outline';
  }
}

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

function getApprovalStatusBadge(status: 'APPROVED' | 'REJECTED' | 'PENDING', type: 'manager' | 'hr') {
  if (status === 'PENDING') {
    return (
      <Badge variant="secondary" className="text-xs">
        Pending
      </Badge>
    );
  }
  
  if (status === 'APPROVED') {
    return (
      <Badge className="text-xs">
        Approved
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="destructive" 
    >
      Rejected
    </Badge>
  );
}

const statusOptions = [
  { value: 'PENDING_MANAGER', label: 'Pending Approver', icon: Clock3 },
  { value: 'PENDING_HR', label: 'Pending HR', icon: Clock3 },
  { value: 'APPROVED', label: 'Approved', icon: CheckCircle },
  { value: 'REJECTED', label: 'Rejected', icon: XCircle },
  { value: 'CANCELLED', label: 'Cancelled', icon: X }
];

export function LeaveRequestsView({ 
  leaveRequestsData, 
  businessUnitId,
  currentFilters 
}: LeaveRequestsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requests] = useState<LeaveRequestWithDetails[]>(leaveRequestsData.requests);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/leave-requests?${params.toString()}`);
  };

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.leaveType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatRequestStatus(request.status).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Leave Requests</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all your leave requests
          </p>
        </div>
        <Button asChild>
          <Link href={`/${businessUnitId}/leave-requests/create`}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by leave type, reason, or status..."
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
            {leaveRequestsData.leaveTypes.map((type) => {
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
        Showing {filteredRequests.length} of {requests.length} leave requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leave Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No leave requests found</p>
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
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.leaveType.name}</span>
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
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        {(() => {
                          if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED', 'manager');
                          } else if (request.managerComments !== null) {
                            return getApprovalStatusBadge('APPROVED', 'manager');
                          }
                          return getApprovalStatusBadge('PENDING', 'manager');
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-purple-600" />
                        {(() => {
                          if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED', 'hr');
                          } else if (request.hrComments !== null || request.status === 'APPROVED') {
                            return getApprovalStatusBadge('APPROVED', 'hr');
                          }
                          return getApprovalStatusBadge('PENDING', 'hr');
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/${businessUnitId}/leave-requests/${request.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {request.status.includes('PENDING') && (
                          <Button
                            variant="outline"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
              <p className="text-muted-foreground">No leave requests found</p>
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
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{request.leaveType.name}</CardTitle>
                    </div>
                    <Badge variant={getStatusVariant(request.status)}>
                      {formatRequestStatus(request.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
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

                  <div>
                    <span className="text-muted-foreground text-sm">Approval Status:</span>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-blue-600" />
                        <span className="text-xs font-medium">Manager:</span>
                        {(() => {
                          if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED', 'manager');
                          } else if (request.managerComments !== null) {
                            return getApprovalStatusBadge('APPROVED', 'manager');
                          }
                          return getApprovalStatusBadge('PENDING', 'manager');
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="h-3 w-3 text-purple-600" />
                        <span className="text-xs font-medium">HR:</span>
                        {(() => {
                          if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED', 'hr');
                          } else if (request.hrComments !== null || request.status === 'APPROVED') {
                            return getApprovalStatusBadge('APPROVED', 'hr');
                          }
                          return getApprovalStatusBadge('PENDING', 'hr');
                        })()}
                      </div>
                    </div>
                  </div>

                  {(request.managerComments || request.hrComments) && (
                    <div className="bg-muted/50 border rounded-md p-3">
                      {request.managerComments && (
                        <div className="text-xs">
                          <span className="font-medium">Manager:</span> {request.managerComments}
                        </div>
                      )}
                      {request.hrComments && (
                        <div className="text-xs">
                          <span className="font-medium">HR:</span> {request.hrComments}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Link href={`/${businessUnitId}/leave-requests/${request.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                    {request.status.includes('PENDING') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <LeaveRequestDetails
          requestId={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open: boolean) => !open && setSelectedRequest(null)}
        />
      )}
    </div>
  );
}