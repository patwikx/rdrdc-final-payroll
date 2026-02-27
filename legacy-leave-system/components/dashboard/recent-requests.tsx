import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { 
  RecentLeaveRequest, 
  RecentOvertimeRequest 
} from "@/lib/actions/dashboard-actions";

interface RecentRequestsProps {
  leaveRequests: RecentLeaveRequest[];
  overtimeRequests: RecentOvertimeRequest[];
  businessUnitId: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING_MANAGER":
    case "PENDING_HR":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "APPROVED":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  }
}

function formatStatus(status: string) {
  switch (status) {
    case "PENDING_MANAGER":
      return "Pending Approver";
    case "PENDING_HR":
      return "Pending HR";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
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

export function RecentRequests({ 
  leaveRequests, 
  overtimeRequests, 
  businessUnitId 
}: RecentRequestsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Recent Leave Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Leave Requests
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${businessUnitId}/leave-requests`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {leaveRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent leave requests
            </p>
          ) : (
            leaveRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                <Badge className={getStatusColor(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Overtime Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Overtime Requests
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${businessUnitId}/overtime-requests`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {overtimeRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent overtime requests
            </p>
          ) : (
            overtimeRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                <Badge className={getStatusColor(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}