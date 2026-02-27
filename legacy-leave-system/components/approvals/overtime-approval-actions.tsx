"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle } from "lucide-react";
import { PendingOvertimeRequest, approveOvertimeRequest, rejectOvertimeRequest } from "@/lib/actions/approval-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface OvertimeApprovalActionsProps {
  request: PendingOvertimeRequest;
  businessUnitId: string;
  currentUserRole: string;
  isMobile?: boolean;
}

export function OvertimeApprovalActions({ request, businessUnitId, currentUserRole, isMobile = false }: OvertimeApprovalActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [rejectComments, setRejectComments] = useState("");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveOvertimeRequest(
        request.id, 
        businessUnitId, 
        approveComments.trim() || undefined
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request approved successfully");
        setApproveDialogOpen(false);
        setApproveComments("");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve request");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComments.trim()) {
      toast.error("Comments are required when rejecting a request");
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectOvertimeRequest(
        request.id, 
        businessUnitId, 
        rejectComments.trim()
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Overtime request rejected successfully");
        setRejectDialogOpen(false);
        setRejectComments("");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
    } finally {
      setIsRejecting(false);
    }
  };

  if (isMobile) {
    return (
      <div className="flex gap-2">
        <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="flex-1"
              disabled={isApproving}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isApproving ? "Approving..." : "Approve"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Overtime Request</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve {request.user.name}'s overtime request?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approve-comments-mobile">
                {currentUserRole === "HR" ? "HR Remarks/Comments (Optional)" : "Comments (Optional)"}
              </Label>
              <Textarea
                id="approve-comments-mobile"
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder={currentUserRole === "HR" ? "Add any HR remarks about this approval..." : "Add any comments about this approval..."}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setApproveComments("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
                {isApproving ? "Approving..." : "Approve"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Overtime Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting {request.user.name}'s overtime request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reject-comments">Comments (Required)</Label>
                <Textarea
                  id="reject-comments"
                  value={rejectComments}
                  onChange={(e) => setRejectComments(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectComments("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting || !rejectComments.trim()}
              >
                {isRejecting ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            disabled={isApproving}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Overtime Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {request.user.name}'s overtime request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-comments-desktop">
              {currentUserRole === "HR" ? "HR Remarks/Comments (Optional)" : "Comments (Optional)"}
            </Label>
            <Textarea
              id="approve-comments-desktop"
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              placeholder={currentUserRole === "HR" ? "Add any HR remarks about this approval..." : "Add any comments about this approval..."}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApproveComments("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
              {isApproving ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Overtime Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {request.user.name}'s overtime request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-comments">Comments (Required)</Label>
              <Textarea
                id="reject-comments"
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectComments("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectComments.trim()}
            >
              {isRejecting ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}