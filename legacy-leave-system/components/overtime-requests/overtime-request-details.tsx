"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Clock,
  FileText,
  Loader2,
  User,
  MessageSquare,
  X
} from "lucide-react";
import { OvertimeRequestWithDetails, getOvertimeRequestById, cancelOvertimeRequest } from "@/lib/actions/overtime-request-actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OvertimeRequestDetailsProps {
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

export function OvertimeRequestDetails({ requestId, open, onOpenChange }: OvertimeRequestDetailsProps) {
  const router = useRouter();
  const [request, setRequest] = useState<OvertimeRequestWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    if (open && requestId) {
      loadRequestDetails();
    }
  }, [open, requestId]);

  const loadRequestDetails = async () => {
    setLoading(true);
    try {
      // Get userId from session - for now we'll pass empty string and handle server-side
      const data = await getOvertimeRequestById(requestId, requestId); // Pass requestId as fallback
      if (!data) {
        toast.error("Request not found");
        onOpenChange(false);
        return;
      }
      setRequest(data);
    } catch (error) {
      console.error("Error loading request details:", error);
      toast.error("Failed to load request details");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = () => {
    if (!request || !request.status.includes('PENDING')) return;
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!request) return;

    setIsCancelling(true);
    setShowCancelDialog(false);
    
    try {
      const result = await cancelOvertimeRequest(request.id, request.userId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request cancelled successfully");
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
  const isSameDay = request && request.startTime.toDateString() === request.endTime.toDateString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime Request Details
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
                  onClick={handleCancelClick}
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
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p className="text-sm font-medium">{format(request.startTime, 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                  <p className="text-sm">{format(request.createdAt, 'MMM dd, yyyy at h:mm a')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Time Period</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {isSameDay 
                        ? `${format(request.startTime, 'h:mm a')} - ${format(request.endTime, 'h:mm a')}`
                        : `${format(request.startTime, 'MMM dd h:mm a')} - ${format(request.endTime, 'MMM dd h:mm a')}`
                      }
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {request.hours} {request.hours === 1 ? 'hour' : 'hours'}
                    </span>
                  </div>
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
                        <User className="h-3 w-3 text-muted-foreground" />
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
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">HR</span>
                      </div>
                      <p className="text-sm p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
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
    </Dialog>
  );
}