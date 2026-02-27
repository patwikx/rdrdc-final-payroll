"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Search, 
  Clock, 
  Eye, 
  Plus,
  X,
  CheckCircle,
  XCircle,
  Clock3,
  Filter,
  User,
  Heart,
  MoreHorizontal
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
import { OvertimeRequestsResponse, OvertimeRequestWithDetails, cancelOvertimeRequest } from "@/lib/actions/overtime-request-actions";
import { OvertimeRequestDetails } from "@/components/overtime-requests/overtime-request-details";
import { toast } from "sonner";

interface OvertimeRequestsViewProps {
  overtimeRequestsData: OvertimeRequestsResponse;
  businessUnitId: string;
  currentFilters: {
    status?: string;
    page: number;
  };
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

function getApprovalStatusBadge(status: 'APPROVED' | 'REJECTED' | 'PENDING') {
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
  { value: 'PENDING_MANAGER', label: 'Pending Manager', icon: Clock3 },
  { value: 'PENDING_HR', label: 'Pending HR', icon: Clock3 },
  { value: 'APPROVED', label: 'Approved', icon: CheckCircle },
  { value: 'REJECTED', label: 'Rejected', icon: XCircle },
  { value: 'CANCELLED', label: 'Cancelled', icon: X }
];

export function OvertimeRequestsView({ 
  overtimeRequestsData, 
  businessUnitId,
  currentFilters 
}: OvertimeRequestsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requests] = useState<OvertimeRequestWithDetails[]>(overtimeRequestsData.requests);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<{ id: string; userId: string } | null>(null);

  const handleCancelClick = (requestId: string, userId: string) => {
    setRequestToCancel({ id: requestId, userId });
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!requestToCancel) return;

    setIsLoading(true);
    setShowCancelDialog(false);
    
    try {
      const result = await cancelOvertimeRequest(requestToCancel.id, requestToCancel.userId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request cancelled successfully");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to cancel overtime request");
    } finally {
      setIsLoading(false);
      setRequestToCancel(null);
    }
  };

  // Helper function to extract time from database without timezone conversion
  const extractTimeFromDateTime = (dateTime: Date | string): string => {
    // Create a date object
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    
    // Get UTC hours and minutes (which represent the actual stored time)
    const hour24 = date.getUTCHours();
    const minute = date.getUTCMinutes().toString().padStart(2, '0');
    
    // Convert to 12-hour format
    let hour12: number;
    let period: string;
    
    if (hour24 === 0) {
      hour12 = 12;
      period = "AM";
    } else if (hour24 < 12) {
      hour12 = hour24;
      period = "AM";
    } else if (hour24 === 12) {
      hour12 = 12;
      period = "PM";
    } else {
      hour12 = hour24 - 12;
      period = "PM";
    }
    
    return `${hour12}:${minute} ${period}`;
  };

  // Helper function to format date from database without timezone conversion
  const formatDateFromUTC = (dateTime: Date | string): string => {
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    const year = date.getUTCFullYear();
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = date.getUTCDate();
    return `${month} ${day.toString().padStart(2, '0')}, ${year}`;
  };

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/overtime-requests?${params.toString()}`);
  };

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
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
          <h1 className="text-2xl font-semibold tracking-tight">Overtime Requests</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all your overtime requests
          </p>
        </div>
        <Button asChild>
          <Link href={`/${businessUnitId}/overtime-requests/create`}>
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
            placeholder="Search by reason or status..."
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
            <SelectItem value="all-statuses">
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
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} overtime requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time Period</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No overtime requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const isSameDay = request.startTime.toDateString() === request.endTime.toDateString();
                
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatDateFromUTC(request.startTime)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSameDay 
                        ? `${extractTimeFromDateTime(request.startTime)} - ${extractTimeFromDateTime(request.endTime)}`
                        : `${formatDateFromUTC(request.startTime).split(',')[0]} ${extractTimeFromDateTime(request.startTime)} - ${formatDateFromUTC(request.endTime).split(',')[0]} ${extractTimeFromDateTime(request.endTime)}`
                      }
                    </TableCell>
                    <TableCell className="font-medium">
                      {request.hours} {request.hours === 1 ? 'hour' : 'hours'}
                    </TableCell>
                    <TableCell>{formatDateFromUTC(request.createdAt)}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        {(() => {
                          if (request.status === 'CANCELLED') {
                            return <span className="text-xs text-muted-foreground">N/A</span>;
                          } else if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED');
                          } else if (request.managerComments !== null) {
                            return getApprovalStatusBadge('APPROVED');
                          }
                          return getApprovalStatusBadge('PENDING');
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-purple-600" />
                        {(() => {
                          if (request.status === 'CANCELLED') {
                            return <span className="text-xs text-muted-foreground">N/A</span>;
                          } else if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED');
                          } else if (request.hrComments !== null || request.status === 'APPROVED') {
                            return getApprovalStatusBadge('APPROVED');
                          }
                          return getApprovalStatusBadge('PENDING');
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={isLoading}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setSelectedRequest(request.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {request.status.includes('PENDING') && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleCancelClick(request.id, request.userId)}
                              disabled={isLoading}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No overtime requests found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const isSameDay = request.startTime.toDateString() === request.endTime.toDateString();
            
            return (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {formatDateFromUTC(request.startTime)}
                      </CardTitle>
                    </div>
                    <Badge variant={getStatusVariant(request.status)}>
                      {formatRequestStatus(request.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time Period:</span>
                      <p className="font-medium">
                        {isSameDay 
                          ? `${extractTimeFromDateTime(request.startTime)} - ${extractTimeFromDateTime(request.endTime)}`
                          : `${formatDateFromUTC(request.startTime).split(',')[0]} ${extractTimeFromDateTime(request.startTime)} - ${formatDateFromUTC(request.endTime).split(',')[0]} ${extractTimeFromDateTime(request.endTime)}`
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="font-medium">{request.hours} {request.hours === 1 ? 'hour' : 'hours'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p className="font-medium">{formatDateFromUTC(request.createdAt)}</p>
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
                          if (request.status === 'CANCELLED') {
                            return <span className="text-xs text-muted-foreground">N/A</span>;
                          } else if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED');
                          } else if (request.managerComments !== null) {
                            return getApprovalStatusBadge('APPROVED');
                          }
                          return getApprovalStatusBadge('PENDING');
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="h-3 w-3 text-purple-600" />
                        <span className="text-xs font-medium">HR:</span>
                        {(() => {
                          if (request.status === 'CANCELLED') {
                            return <span className="text-xs text-muted-foreground">N/A</span>;
                          } else if (request.status === 'REJECTED') {
                            return getApprovalStatusBadge('REJECTED');
                          } else if (request.hrComments !== null || request.status === 'APPROVED') {
                            return getApprovalStatusBadge('APPROVED');
                          }
                          return getApprovalStatusBadge('PENDING');
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedRequest(request.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {request.status.includes('PENDING') && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCancelClick(request.id, request.userId)}
                        disabled={isLoading}
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
        <OvertimeRequestDetails
          requestId={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open: boolean) => !open && setSelectedRequest(null)}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Overtime Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this overtime request? This action cannot be undone and will reset all approval statuses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}