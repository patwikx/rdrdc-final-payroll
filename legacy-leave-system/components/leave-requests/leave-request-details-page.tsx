"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar,
  Clock,
  FileText,
  User,
  MessageSquare,
  X,
  Heart,
  ArrowLeft
} from "lucide-react";
import { LeaveRequestWithDetails, cancelLeaveRequest } from "@/lib/actions/leave-request-actions";
import { EditLeaveRequestForm } from "./edit-leave-request-form";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveRequestDetailsPageProps {
  request: LeaveRequestWithDetails;
  leaveTypes: LeaveType[];
  businessUnitId: string;
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
      return 'Pending Manager';
    case 'PENDING_HR':
      return 'Pending HR';
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

export function LeaveRequestDetailsPage({ request, leaveTypes, businessUnitId }: LeaveRequestDetailsPageProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!request.status.includes('PENDING')) return;

    setIsCancelling(true);
    try {
      const result = await cancelLeaveRequest(request.id, businessUnitId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.push(`/${businessUnitId}/leave-requests`);
      }
    } catch (error) {
      toast.error("Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = request.status.includes('PENDING');
  const canEdit = request.status.includes('PENDING') && !request.managerActionBy;
  const isMultiDay = request.startDate.getTime() !== request.endDate.getTime();

  const handleEditSuccess = () => {
    // Refresh the page to show updated data
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leave Request Details</h1>
            <p className="text-sm text-muted-foreground">
              {request.leaveType.name} • Submitted {format(request.createdAt, 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canEdit && (
            <EditLeaveRequestForm
              request={request}
              leaveTypes={leaveTypes}
              businessUnitId={businessUnitId}
              onSuccess={handleEditSuccess}
            />
          )}
          
          {canCancel && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              <X className="h-4 w-4 mr-2" />
              {isCancelling ? 'Cancelling...' : 'Cancel Request'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Request Information
                </CardTitle>
                <Badge variant={getStatusVariant(request.status)}>
                  {formatRequestStatus(request.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-lg">{request.reason}</p>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          {(request.managerComments || request.hrComments) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.managerComments && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Manager</span>
                    </div>
                    <p className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      {request.managerComments}
                    </p>
                  </div>
                )}

                {request.hrComments && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">HR</span>
                    </div>
                    <p className="text-sm p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      {request.hrComments}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}