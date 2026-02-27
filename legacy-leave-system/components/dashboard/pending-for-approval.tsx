import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Calendar, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { 
  RecentLeaveRequest, 
  RecentOvertimeRequest 
} from "@/lib/actions/dashboard-actions";

interface PendingForApprovalProps {
  leaveRequests: RecentLeaveRequest[];
  overtimeRequests: RecentOvertimeRequest[];
  businessUnitId: string;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function PendingForApproval({ 
  leaveRequests, 
  overtimeRequests, 
  businessUnitId 
}: PendingForApprovalProps) {
  const totalPending = leaveRequests.length + overtimeRequests.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Pending for My Approval
          {totalPending > 0 && (
            <Badge variant="destructive" className="ml-2">
              {totalPending}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessUnitId}/approvals/leave/pending`}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalPending === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              No pending approvals
            </p>
            <p className="text-xs text-muted-foreground">
              All requests have been processed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Leave Requests */}
            {leaveRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{request.user.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {request.user.employeeId}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {request.leaveType.name} • {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${businessUnitId}/approvals/leave/pending/${request.id}`}>
                    Review
                  </Link>
                </Button>
              </div>
            ))}

            {/* Overtime Requests */}
            {overtimeRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{request.user.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {request.user.employeeId}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(request.startTime)} - {formatDateTime(request.endTime)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${businessUnitId}/approvals/overtime/pending/${request.id}`}>
                    Review
                  </Link>
                </Button>
              </div>
            ))}

            {/* Show more indicator if there are additional requests */}
            {totalPending > 6 && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${businessUnitId}/approvals`}>
                    +{totalPending - 6} more requests
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}