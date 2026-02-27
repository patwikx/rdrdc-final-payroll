"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  CheckCircle,
  XCircle,
  Clock3,
  Filter,
  FolderOpen,
  User,
  FileText,
  ChevronLeft,
  ChevronRight
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
import { ApprovalHistoryResponse, ApprovalHistoryLeaveRequest, ApprovalHistoryOvertimeRequest } from "@/lib/actions/approval-actions";

interface ApprovalHistoryViewProps {
  historyData: ApprovalHistoryResponse;
  businessUnitId: string;
  currentFilters: {
    type?: string;
    status?: string;
    leaveTypeId?: string;
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
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function getStatusVariant(status: string) {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
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

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const typeOptions = [
  { value: 'all', label: 'All Requests', icon: FileText },
  { value: 'leave', label: 'Leave Requests', icon: Calendar },
  { value: 'overtime', label: 'Overtime Requests', icon: Clock }
];

const statusOptions = [
  { value: 'all', label: 'All Actions', icon: FileText },
  { value: 'APPROVED', label: 'Approved', icon: CheckCircle },
  { value: 'REJECTED', label: 'Rejected', icon: XCircle }
];

export function ApprovalHistoryView({ 
  historyData, 
  businessUnitId,
  currentFilters 
}: ApprovalHistoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");

  // Combine and filter requests
  const allRequests = useMemo(() => {
    const combined = [
      ...historyData.leaveRequests.map(req => ({ ...req, type: 'leave' as const })),
      ...historyData.overtimeRequests.map(req => ({ ...req, type: 'overtime' as const }))
    ];

    // Sort by action date (most recent first)
    return combined.sort((a, b) => {
      const aDate = a.approvedAt || a.rejectedAt || a.createdAt;
      const bDate = b.approvedAt || b.rejectedAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [historyData.leaveRequests, historyData.overtimeRequests]);

  const filteredRequests = useMemo(() => {
    let filtered = allRequests;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(request => {
        const searchLower = searchTerm.toLowerCase();
        return (
          request.user.name.toLowerCase().includes(searchLower) ||
          request.user.employeeId.toLowerCase().includes(searchLower) ||
          request.reason.toLowerCase().includes(searchLower) ||
          formatRequestStatus(request.status).toLowerCase().includes(searchLower) ||
          (request.type === 'leave' && (request as ApprovalHistoryLeaveRequest & { type: 'leave' }).leaveType.name.toLowerCase().includes(searchLower))
        );
      });
    }

    return filtered;
  }, [allRequests, searchTerm]);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/approvals/history?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/${businessUnitId}/approvals/history?${params.toString()}`);
  };

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Approval History</h1>
          <p className="text-sm text-muted-foreground">
            View all requests you have approved or rejected
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by employee, type, reason, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Request Type Filter */}
        <Select
          value={currentFilters.type || ""}
          onValueChange={(value) => updateFilter('type', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All types" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>All types</span>
              </div>
            </SelectItem>
            {typeOptions.map((option) => {
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

        {/* Action Status Filter */}
        <Select
          value={currentFilters.status || ""}
          onValueChange={(value) => updateFilter('status', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All actions" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span>All actions</span>
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

        {/* Leave Type Filter - only show if type is 'leave' or 'all' */}
        {(currentFilters.type === 'leave' || !currentFilters.type) && (
          <Select
            value={currentFilters.leaveTypeId || ""}
            onValueChange={(value) => updateFilter('leaveTypeId', value || undefined)}
          >
            <SelectTrigger className="w-[180px]">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All leave types" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>All leave types</span>
                </div>
              </SelectItem>
              {historyData.leaveTypes.map((type) => {
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
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {allRequests.length} approval records
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Request Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Approval Flow</TableHead>
              <TableHead>Your Action</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>Action Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No approval records match your search criteria" : "No approval history found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const actionDate = request.approvedAt || request.rejectedAt;
                
                return (
                  <TableRow key={`${request.type}-${request.id}`}>
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
                      {request.type === 'leave' ? (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const Icon = getLeaveTypeIcon((request as ApprovalHistoryLeaveRequest & { type: 'leave' }).leaveType.name);
                            return <Icon className="h-4 w-4 text-muted-foreground" />;
                          })()}
                          <span className="font-medium">{(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).leaveType.name} LEAVE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">OVERTIME REQUEST</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.type === 'leave' ? (
                        <div className="space-y-1">
                          <div className="text-sm">
                            {(() => {
                              const leaveReq = request as ApprovalHistoryLeaveRequest & { type: 'leave' };
                              const isMultiDay = leaveReq.startDate.getTime() !== leaveReq.endDate.getTime();
                              return isMultiDay 
                                ? `${format(leaveReq.startDate, 'MMM dd')} - ${format(leaveReq.endDate, 'MMM dd, yyyy')}`
                                : format(leaveReq.startDate, 'MMM dd, yyyy');
                            })()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).days} {(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).days === 1 ? 'day' : 'days'} • {getSessionDisplay((request as ApprovalHistoryLeaveRequest & { type: 'leave' }).session)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-sm">
                            {format(new Date((request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).startTime), 'MMM dd, HH:mm')} - {format(new Date((request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).endTime), 'HH:mm')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).hours} hours
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">Approver:</span>
                          {request.managerComments !== null ? (
                            <Badge variant={request.status === 'REJECTED' && request.managerComments ? 'destructive' : 'default'} className="text-xs">
                              {request.status === 'REJECTED' && request.managerComments ? 'Rejected' : 'Approved'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">HR:</span>
                          {request.status === 'REJECTED' ? (
                            <Badge variant="destructive" className="text-xs">Rejected</Badge>
                          ) : request.hrComments !== null ? (
                            <Badge variant="outline" className="text-xs">Approved</Badge>
                          ) : request.status === 'APPROVED' ? (
                            <Badge className="text-xs">Approved</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {request.actionTaken === 'APPROVED' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {request.actionTaken === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={request.actionComments || ''}>
                        {request.actionComments || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {actionDate ? (
                        <div className="text-sm">
                          {format(new Date(actionDate), "MMM dd, yyyy")}
                          <div className="text-muted-foreground">
                            {format(new Date(actionDate), 'HH:mm')}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-4 sm:hidden">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No approval history found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No records match your search criteria." : "You haven't approved or rejected any requests yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const actionDate = request.approvedAt || request.rejectedAt;
            
            return (
              <Card key={`${request.type}-${request.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage 
                          src={request.user.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.user.profilePicture)}?direct=true` : undefined}
                          alt={request.user.name}
                        />
                        <AvatarFallback>{getUserInitials(request.user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{request.user.name}</span>
                        <div className="text-sm text-muted-foreground">{request.user.employeeId}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {request.actionTaken === 'APPROVED' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                    </div>
                  </div>
                  
                  {request.type === 'leave' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getLeaveTypeIcon((request as ApprovalHistoryLeaveRequest & { type: 'leave' }).leaveType.name);
                          return <Icon className="h-4 w-4 text-muted-foreground" />;
                        })()}
                        <span className="font-medium">{(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).leaveType.name} LEAVE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {(() => {
                            const leaveReq = request as ApprovalHistoryLeaveRequest & { type: 'leave' };
                            const isMultiDay = leaveReq.startDate.getTime() !== leaveReq.endDate.getTime();
                            return isMultiDay 
                              ? `${format(leaveReq.startDate, 'MMM dd')} - ${format(leaveReq.endDate, 'MMM dd, yyyy')}`
                              : format(leaveReq.startDate, 'MMM dd, yyyy');
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).days} {(request as ApprovalHistoryLeaveRequest & { type: 'leave' }).days === 1 ? 'day' : 'days'} • {getSessionDisplay((request as ApprovalHistoryLeaveRequest & { type: 'leave' }).session)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">OVERTIME REQUEST</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date((request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).startTime), 'MMM dd, HH:mm')} - {format(new Date((request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).endTime), 'HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{(request as ApprovalHistoryOvertimeRequest & { type: 'overtime' }).hours} hours</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Reason:</span>
                      <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>
                    </div>
                    
                    <div>
                      <span className="text-sm font-medium">Approval Flow:</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">Manager:</span>
                          {request.managerComments !== null ? (
                            <Badge variant={request.status === 'REJECTED' && request.managerComments ? 'destructive' : 'outline'} className="text-xs">
                              {request.status === 'REJECTED' && request.managerComments ? 'Rejected' : 'Approved'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">HR:</span>
                          {request.status === 'REJECTED' ? (
                            <Badge variant="destructive" className="text-xs">Rejected</Badge>
                          ) : request.hrComments !== null ? (
                            <Badge variant="outline" className="text-xs">Approved</Badge>
                          ) : request.status === 'APPROVED' ? (
                            <Badge variant="outline" className="text-xs">Approved</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {request.actionComments && (
                      <div>
                        <span className="text-sm font-medium">Your Comments:</span>
                        <p className="text-sm text-muted-foreground mt-1">{request.actionComments}</p>
                      </div>
                    )}
                    
                    {actionDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        <span>Action taken on {format(new Date(actionDate), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {historyData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing {((currentFilters.page - 1) * 10) + 1} to {Math.min(currentFilters.page * 10, historyData.pagination.totalCount)} of {historyData.pagination.totalCount} results
          </div>
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentFilters.page - 1)}
              disabled={!historyData.pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {historyData.pagination.currentPage} of {historyData.pagination.totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentFilters.page + 1)}
              disabled={!historyData.pagination.hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}