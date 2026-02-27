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
import { CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { 
  PendingMaterialRequest, 
  approveMaterialRequest, 
  rejectMaterialRequest 
} from "@/lib/actions/mrs-actions/material-request-approval-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MaterialRequestApprovalActionsProps {
  request: PendingMaterialRequest;
  businessUnitId: string;
  currentUserRole: string;
  isMobile?: boolean;
}

export function MaterialRequestApprovalActions({ 
  request, 
  businessUnitId, 
  currentUserRole, 
  isMobile = false 
}: MaterialRequestApprovalActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [rejectComments, setRejectComments] = useState("");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveMaterialRequest(
        request.id, 
        businessUnitId, 
        approveComments.trim() || undefined
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Material request approved successfully");
        setApproveDialogOpen(false);
        setApproveComments("");
        
        // If this is a final approval that triggers posting
        if (result.isPosting) {
          setIsPosting(true);
          // Show posting animation for 1.5 seconds, then refresh
          setTimeout(() => {
            setIsPosting(false);
            router.refresh();
          }, 1500);
        } else {
          router.refresh();
        }
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
      const result = await rejectMaterialRequest(
        request.id, 
        businessUnitId, 
        rejectComments.trim()
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Material request rejected successfully");
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

  const handleViewDetails = () => {
    router.push(`/${businessUnitId}/material-requests/${request.id}`);
  };

  if (isMobile) {
    return (
      <div className="flex gap-2">
        <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="flex-1"
              disabled={isApproving || isPosting}
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isApproving ? "Approving..." : "Approve"}
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Material Request</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve {request.requestedBy.name}'s material request ({request.docNo})?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approve-comments-mobile">Comments (Optional)</Label>
              <Textarea
                id="approve-comments-mobile"
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder="Add any comments about this approval..."
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
              <DialogTitle>Reject Material Request</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting {request.requestedBy.name}'s material request ({request.docNo}).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reject-comments" className="mb-1">Comments (Required)</Label>
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleViewDetails}
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            disabled={isApproving || isPosting}
          >
            {isPosting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Material Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {request.requestedBy.name}'s material request ({request.docNo})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-comments-desktop">Comments (Optional)</Label>
            <Textarea
              id="approve-comments-desktop"
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              placeholder="Add any comments about this approval..."
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
            <DialogTitle>Reject Material Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {request.requestedBy.name}'s material request ({request.docNo}).
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