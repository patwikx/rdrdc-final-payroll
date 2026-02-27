"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Building,
  FileText,
  CheckCircle,
  XCircle,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/actions/approval-actions";
import { format } from "date-fns";

interface LeaveRequestForApproval {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  session: string;
  days: number;
  createdAt: Date;
  updatedAt: Date;
  managerActionBy: string | null;
  managerActionAt: Date | null;
  managerComments: string | null;
  hrActionBy: string | null;
  hrActionAt: Date | null;
  hrComments: string | null;
  user: {
    id: string;
    name: string;
    employeeId: string;
    email: string | null;
    role: string;
    approver: {
      id: string;
      name: string;
      employeeId: string;
    } | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
  leaveType: {
    id: string;
    name: string;
  };
}

interface CurrentUser {
  id: string;
  role: string;
  name: string;
}

interface LeaveApprovalDetailsProps {
  leaveRequest: LeaveRequestForApproval;
  businessUnitId: string;
  currentUser: CurrentUser;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "PENDING_MANAGER":
      return "secondary";
    case "PENDING_HR":
      return "default";
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "CANCELLED":
      return "outline";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING_MANAGER":
      return "Pending Manager Approval";
    case "PENDING_HR":
      return "Pending HR Approval";
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

function getSessionLabel(session: string) {
  switch (session) {
    case "FULL_DAY":
      return "Full Day";
    case "MORNING":
      return "Morning";
    case "AFTERNOON":
      return "Afternoon";
    default:
      return session;
  }
}

export function LeaveApprovalDetails({ 
  leaveRequest, 
  businessUnitId, 
  currentUser 
}: LeaveApprovalDetailsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [comments, setComments] = useState("");

  // Determine if current user can take action on this request
  const canApprove = () => {
    if (currentUser.role === "ADMIN") return true;
    if (currentUser.role === "HR" && (leaveRequest.status === "PENDING_HR" || leaveRequest.status === "PENDING_MANAGER")) return true;
    if (currentUser.role === "MANAGER" && leaveRequest.status === "PENDING_MANAGER" && leaveRequest.user.approver?.id === currentUser.id) return true;
    return false;
  };

  const handleApprove = async () => {
    setIsLoading(true);
    
    try {
      const result = await approveLeaveRequest(leaveRequest.id, businessUnitId, comments.trim());

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request approved successfully");
        setApproveDialogOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to approve leave request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await rejectLeaveRequest(leaveRequest.id, businessUnitId, comments.trim());

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Leave request rejected");
        setRejectDialogOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to reject leave request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => router.push(`/${businessUnitId}/approvals/leave/pending`)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Pending Approvals
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Leave Request Details</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve or reject this leave request
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(leaveRequest.status)}>
          {getStatusLabel(leaveRequest.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Request Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="font-medium">{leaveRequest.user.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                  <p className="font-medium">{leaveRequest.user.employeeId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <p className="font-medium">{leaveRequest.user.role}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                  <p className="font-medium">{leaveRequest.user.department?.name || "—"}</p>
                </div>
                {leaveRequest.user.email && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="font-medium">{leaveRequest.user.email}</p>
                  </div>
                )}
                {leaveRequest.user.approver && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Manager</Label>
                    <p className="font-medium">
                      {leaveRequest.user.approver.name} ({leaveRequest.user.approver.employeeId})
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leave Request Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Request Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Leave Type</Label>
                  <p className="font-medium">{leaveRequest.leaveType.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Session</Label>
                  <p className="font-medium">{getSessionLabel(leaveRequest.session)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                  <p className="font-medium">{format(leaveRequest.startDate, "PPP")}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                  <p className="font-medium">{format(leaveRequest.endDate, "PPP")}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                  <p className="font-medium">{leaveRequest.days} day{leaveRequest.days !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{format(leaveRequest.createdAt, "PPP 'at' p")}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Reason</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{leaveRequest.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Approval History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manager Action */}
              {leaveRequest.managerActionAt && (
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Manager Action</span>
                    <span className="text-xs text-muted-foreground">
                      {format(leaveRequest.managerActionAt, "PPP 'at' p")}
                    </span>
                  </div>
                  {leaveRequest.managerComments && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {leaveRequest.managerComments}
                    </p>
                  )}
                </div>
              )}

              {/* HR Action */}
              {leaveRequest.hrActionAt && (
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">HR Action</span>
                    <span className="text-xs text-muted-foreground">
                      {format(leaveRequest.hrActionAt, "PPP 'at' p")}
                    </span>
                  </div>
                  {leaveRequest.hrComments && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {leaveRequest.hrComments}
                    </p>
                  )}
                </div>
              )}

              {/* No actions yet */}
              {!leaveRequest.managerActionAt && !leaveRequest.hrActionAt && (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No approval actions taken yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={getStatusBadgeVariant(leaveRequest.status)} className="text-xs">
                  {getStatusLabel(leaveRequest.status)}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{leaveRequest.days} day{leaveRequest.days !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Leave Type:</span>
                <span className="font-medium">{leaveRequest.leaveType.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Session:</span>
                <span className="font-medium">{getSessionLabel(leaveRequest.session)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {canApprove() && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Approve */}
                <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={isLoading}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Approve Leave Request</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to approve this leave request for {leaveRequest.user.name}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="approve-comments">Comments (Optional)</Label>
                      <Textarea
                        id="approve-comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Add any comments about this approval..."
                        rows={3}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setComments("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleApprove} disabled={isLoading}>
                        {isLoading ? "Approving..." : "Approve"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Reject */}
                <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isLoading}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to reject this leave request for {leaveRequest.user.name}?
                        Please provide a reason for rejection.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="reject-comments">
                        Reason for Rejection <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="reject-comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Please explain why this request is being rejected..."
                        rows={3}
                        required
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setComments("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleReject} 
                        disabled={isLoading || !comments.trim()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isLoading ? "Rejecting..." : "Reject"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          {/* Cannot approve message */}
          {!canApprove() && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {leaveRequest.status === "APPROVED" || leaveRequest.status === "REJECTED" 
                      ? "This request has already been processed"
                      : "You don't have permission to approve this request"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}