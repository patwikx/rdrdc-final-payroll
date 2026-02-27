"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar,
  Clock,
  Eye,
  Heart,
  Sun,
  AlertTriangle,
  Briefcase,
  X
} from "lucide-react";
import { LeaveRequestWithDetails } from "@/lib/actions/leave-request-actions";
import { format } from "date-fns";
import { useState } from "react";
import { cancelLeaveRequest } from "@/lib/actions/leave-request-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LeaveRequestCardProps {
  request: LeaveRequestWithDetails;
  onViewDetails: () => void;
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

export function LeaveRequestCard({ request, onViewDetails }: LeaveRequestCardProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const Icon = getLeaveTypeIcon(request.leaveType.name);

  const canCancel = request.status.includes('PENDING');
  const isMultiDay = request.startDate.getTime() !== request.endDate.getTime();

  const handleCancel = async () => {
    if (!canCancel) return;

    setIsCancelling(true);
    try {
      const result = await cancelLeaveRequest(request.id, ''); // userId will be handled server-side
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh(); // Refresh the page to show updated data
      }
    } catch (error) {
      toast.error("Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">{request.leaveType.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Submitted {format(request.createdAt, 'MMM dd, yyyy')}
                </p>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {isMultiDay 
                    ? `${format(request.startDate, 'MMM dd')} - ${format(request.endDate, 'MMM dd, yyyy')}`
                    : format(request.startDate, 'MMM dd, yyyy')
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{getSessionDisplay(request.session)}</span>
              </div>
              <div className="font-medium">
                {request.days} {request.days === 1 ? 'day' : 'days'}
              </div>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {request.reason}
            </p>

            {/* Comments */}
            {(request.managerComments || request.hrComments) && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {request.managerComments && (
                  <p><strong>Manager:</strong> {request.managerComments}</p>
                )}
                {request.hrComments && (
                  <p><strong>HR:</strong> {request.hrComments}</p>
                )}
              </div>
            )}
          </div>

          {/* Status and Actions */}
          <div className="flex flex-col items-end gap-3">
            <Badge variant={getStatusVariant(request.status)}>
              {formatRequestStatus(request.status)}
            </Badge>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewDetails}
              >
                <Eye className="h-4 w-4 mr-2" />
                Details
              </Button>

              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  <X className="h-4 w-4 mr-2" />
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}