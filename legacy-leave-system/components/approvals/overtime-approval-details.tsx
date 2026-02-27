"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
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
import { approveOvertimeRequest, rejectOvertimeRequest } from "@/lib/actions/approval-actions";
import { format } from "date-fns";

interface OvertimeRequestForApproval {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: string;
  hours: number;
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
}

interface OvertimeApprovalDetailsProps {
  overtimeRequest: OvertimeRequestForApproval;
  businessUnitId: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "PENDING_MANAGER":
    case "PENDING_HR":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_MANAGER":
      return "Pending Manager Approval";
    case "PENDING_HR":
      return "Pending HR Approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export function OvertimeApprovalDetails({ 
  overtimeRequest, 
  businessUnitId, 
  currentUser 
}: OvertimeApprovalDetailsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionComments, setRejectionComments] = useState("");

  // Check if current user can approve this request
  function canApprove(): boolean {
    if (currentUser.role === "ADMIN") return true;
    if (currentUser.role === "HR" && (overtimeRequest.status === "PENDING_HR" || overtimeRequest.status === "PENDING_MANAGER")) return true;
    if (currentUser.role === "MANAGER" && overtimeRequest.status === "PENDING_MANAGER" && overtimeRequest.user.approver?.id === currentUser.id) return true;
    return false;
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveOvertimeRequest(
        overtimeRequest.id, 
        businessUnitId, 
        approvalComments.trim() || undefined
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request approved successfully");
        router.push(`/${businessUnitId}/approvals/overtime/pending`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to approve overtime request");
      console.error("Approval error:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionComments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectOvertimeRequest(
        overtimeRequest.id, 
        businessUnitId, 
        rejectionComments.trim()
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request rejected successfully");
        router.push(`/${businessUnitId}/approvals/overtime/pending`);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to reject overtime request");
      console.error("Rejection error:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push(`/${businessUnitId}/approvals/overtime/pending`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pending
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overtime Request Details</h1>
            <p className="text-sm text-muted-foreground">
              Review and approve overtime request
            </p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(overtimeRequest.status)}>
          {getStatusLabel(overtimeRequest.status)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Request Details */}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-sm font-medium">{overtimeRequest.user.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                  <p className="text-sm font-medium">{overtimeRequest.user.employeeId}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm">{overtimeRequest.user.email || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                  <p className="text-sm">{overtimeRequest.user.department?.name || "Not assigned"}</p>
                </div>
                {overtimeRequest.user.approver && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Manager</Label>
                    <p className="text-sm">{overtimeRequest.user.approver.name} ({overtimeRequest.user.approver.employeeId})</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overtime Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Overtime Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Start Time</Label>
                  <p className="text-sm font-medium">
                    {format(new Date(overtimeRequest.startTime), "MMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">End Time</Label>
                  <p className="text-sm font-medium">
                    {format(new Date(overtimeRequest.endTime), "MMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                  <p className="text-sm font-medium">{overtimeRequest.hours} hours</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                  <p className="text-sm">
                    {format(new Date(overtimeRequest.createdAt), "MMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Reason</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-md">
                  <p className="text-sm">{overtimeRequest.reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval History */}
          {(overtimeRequest.managerActionBy || overtimeRequest.hrActionBy) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Approval History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {overtimeRequest.managerActionBy && (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Manager Approval</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Approved on {format(new Date(overtimeRequest.managerActionAt!), "MMM dd, yyyy 'at' HH:mm")}
                    </p>
                    {overtimeRequest.managerComments && (
                      <p className="text-sm">{overtimeRequest.managerComments}</p>
                    )}
                  </div>
                )}
                
                {overtimeRequest.hrActionBy && (
                  <div className="border-l-4 border-green-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">HR Approval</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Approved on {format(new Date(overtimeRequest.hrActionAt!), "MMM dd, yyyy 'at' HH:mm")}
                    </p>
                    {overtimeRequest.hrComments && (
                      <p className="text-sm">{overtimeRequest.hrComments}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          {canApprove() && overtimeRequest.status !== "APPROVED" && overtimeRequest.status !== "REJECTED" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Approval Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Approve Section */}
                <div className="space-y-3">
                  <Label htmlFor="approval-comments">Comments (Optional)</Label>
                  <Textarea
                    id="approval-comments"
                    placeholder="Add any comments for approval..."
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    rows={3}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full gap-2" disabled={isApproving || isRejecting}>
                        <CheckCircle className="h-4 w-4" />
                        {isApproving ? "Approving..." : "Approve Request"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Approve Overtime Request</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to approve this overtime request for {overtimeRequest.user.name}?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove}>
                          Approve Request
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                {/* Reject Section */}
                <div className="space-y-3">
                  <Label htmlFor="rejection-comments">Rejection Reason *</Label>
                  <Textarea
                    id="rejection-comments"
                    placeholder="Please provide a reason for rejection..."
                    value={rejectionComments}
                    onChange={(e) => setRejectionComments(e.target.value)}
                    rows={3}
                    required
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="w-full gap-2" 
                        disabled={isApproving || isRejecting || !rejectionComments.trim()}
                      >
                        <XCircle className="h-4 w-4" />
                        {isRejecting ? "Rejecting..." : "Reject Request"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reject Overtime Request</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to reject this overtime request for {overtimeRequest.user.name}?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleReject}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Reject Request
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Request Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Employee</span>
                <span className="text-sm font-medium">{overtimeRequest.user.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-medium">{overtimeRequest.hours} hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium">
                  {format(new Date(overtimeRequest.startTime), "MMM dd, yyyy")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={getStatusBadgeVariant(overtimeRequest.status)} className="text-xs">
                  {getStatusLabel(overtimeRequest.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {!canApprove() && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">You don't have permission to approve this request.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}