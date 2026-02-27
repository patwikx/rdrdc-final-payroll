import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, Calendar, Clock, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { 
  RecentLeaveRequest, 
  RecentOvertimeRequest 
} from "@/lib/actions/dashboard-actions";

interface PendingApprovalsProps {
  leaveRequests: RecentLeaveRequest[];
  overtimeRequests: RecentOvertimeRequest[];
  businessUnitId: string;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

export function PendingApprovals({ 
  leaveRequests, 
  overtimeRequests, 
  businessUnitId 
}: PendingApprovalsProps) {
  const totalPending = leaveRequests.length + overtimeRequests.length;

  if (totalPending === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Pending Approvals ({totalPending})
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessUnitId}/approvals`}>
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Leave Requests */}
        {leaveRequests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Leave Requests ({leaveRequests.length})</span>
            </div>
            {leaveRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{request.user.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {request.user.employeeId}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {request.leaveType.name} • {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    {request.status === "PENDING_MANAGER" ? "Manager Review" : "HR Review"}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${businessUnitId}/approvals/leave/${request.id}`}>
                      Review
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending Overtime Requests */}
        {overtimeRequests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Overtime Requests ({overtimeRequests.length})</span>
            </div>
            {overtimeRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{request.user.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {request.user.employeeId}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {formatDateTime(request.startTime)} - {formatDateTime(request.endTime)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {request.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                    {request.status === "PENDING_MANAGER" ? "Manager Review" : "HR Review"}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${businessUnitId}/approvals/overtime/${request.id}`}>
                      Review
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}