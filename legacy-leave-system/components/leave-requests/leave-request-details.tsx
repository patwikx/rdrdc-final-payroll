"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar,
  Clock,
  FileText,
  Loader2,
  User,
  MessageSquare,
  X,
  Heart
} from "lucide-react";
import { LeaveRequestWithDetails, getLeaveRequestById, cancelLeaveRequest } from "@/lib/actions/leave-request-actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LeaveRequestDetailsProps {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      <Badge variant="outline" className="text-xs">
        Approved
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className="text-xs border-red-200 text-red-700 bg-red-50"
    >
      Rejected
    </Badge>
  );
}

export function LeaveRequestDetails({ requestId, open, onOpenChange }: LeaveRequestDetailsProps) {
  const router = useRouter();
  const [request, setRequest] = useState<LeaveRequestWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (open && requestId) {
      loadRequestDetails();
    }
  }, [open, requestId]);

  const loadRequestDetails = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequestById(requestId, ''); // userId will be handled server-side
      setRequest(data);
    } catch (error) {
      console.error("Error loading request details:", error);
      toast.error("Failed to load request details");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!request || !request.status.includes('PENDING')) return;

    setIsCancelling(true);
    try {
      const result = await cancelLeaveRequest(request.id, '');
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        onOpenChange(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  if (!request && !loading) {
    return null;
  }

  const canCancel = request?.status.includes('PENDING');
  const isMultiDay = request && request.startDate.getTime() !== request.endDate.getTime();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leave Request Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading details...</span>
          </div>
        ) : request ? (
          <div className="space-y-6">
            {/* Status and Actions */}
            <div className="flex items-center justify-between">
              <Badge variant={getStatusVariant(request.status)} className="text-sm">
                {formatRequestStatus(request.status)}
              </Badge>
              
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  <X className="h-4 w-4 mr-2" />
                  {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                </Button>
              )}
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Leave Type</label>
                  <p className="text-sm font-medium">{request.leaveType.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                  <p className="text-sm">{format(request.createdAt, 'MMM dd, yyyy at h:mm a')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date Range</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {isMultiDay 
                        ? `${format(request.startDate, 'MMM dd')} - ${format(request.endDate, 'MMM dd, yyyy')}`
                        : format(request.startDate, 'MMM dd, yyyy')
                      }
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Session & Duration</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{getSessionDisplay(request.session)}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-medium">
                      {request.days} {request.days === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Approval Status */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Approval Status</label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Manager</span>
                  </div>
                  {(() => {
                    if (request.managerComments !== null) {
                      const status = request.status === 'REJECTED' && request.managerComments ? 'REJECTED' : 'APPROVED';
                      return getApprovalStatusBadge(status as 'APPROVED' | 'REJECTED');
                    }
                    return getApprovalStatusBadge('PENDING');
                  })()}
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">HR</span>
                  </div>
                  {(() => {
                    if (request.hrComments !== null) {
                      const status = request.status === 'REJECTED' && request.hrComments ? 'REJECTED' : 'APPROVED';
                      return getApprovalStatusBadge(status as 'APPROVED' | 'REJECTED');
                    } else if (request.status === 'APPROVED') {
                      return getApprovalStatusBadge('APPROVED');
                    }
                    return getApprovalStatusBadge('PENDING');
                  })()}
                </div>
              </div>
            </div>

            <Separator />

            {/* Reason */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Reason</label>
              <p className="text-sm mt-1 p-3 bg-muted/50 rounded-lg">{request.reason}</p>
            </div>

            {/* Comments */}
            {(request.managerComments || request.hrComments) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments
                  </h4>
                  
                  {request.managerComments && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-blue-600" />
                        <span className="text-xs font-medium text-muted-foreground">Manager</span>
                      </div>
                      <p className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        {request.managerComments}
                      </p>
                    </div>
                  )}

                  {request.hrComments && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Heart className="h-3 w-3 text-purple-600" />
                        <span className="text-xs font-medium text-muted-foreground">HR</span>
                      </div>
                      <p className="text-sm p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        {request.hrComments}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Request not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}