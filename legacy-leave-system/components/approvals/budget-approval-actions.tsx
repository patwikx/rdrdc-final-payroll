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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, DollarSign } from "lucide-react";
import { approveBudget } from "@/lib/actions/mrs-actions/material-request-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MaterialRequestItem {
  id: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface PendingBudgetRequest {
  id: string;
  docNo: string;
  series: string;
  type: string;
  purpose: string | null;
  dateRequired: Date;
  total: number;
  createdAt: Date;
  requestedBy: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture: string | null;
  };
  items: MaterialRequestItem[];
  budgetApprovalStatus: string | null;
  isWithinBudget: boolean | null;
  budgetRemarks: string | null;
}

interface BudgetApprovalActionsProps {
  request: PendingBudgetRequest;
  businessUnitId: string;
  isMobile?: boolean;
}

export function BudgetApprovalActions({ 
  request, 
  businessUnitId, 
  isMobile = false 
}: BudgetApprovalActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isWithinBudget, setIsWithinBudget] = useState(true);
  const [remarks, setRemarks] = useState("");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveBudget({
        requestId: request.id,
        isWithinBudget,
        remarks: remarks.trim() || undefined,
      });
      
      if (!result.success) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        setDialogOpen(false);
        setIsWithinBudget(true);
        setRemarks("");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process budget approval");
    } finally {
      setIsApproving(false);
    }
  };

  const handleViewDetails = () => {
    router.push(`/${businessUnitId}/material-requests/${request.id}`);
  };

  if (isMobile) {
    return (
      <div className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="flex-1"
              disabled={isApproving}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {isApproving ? "Processing..." : "Review Budget"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Budget Approval</DialogTitle>
              <DialogDescription>
                Review budget for {request.requestedBy.name}'s material request ({request.docNo})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                <div className="text-2xl font-bold">₱{request.total.toLocaleString()}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="within-budget-mobile">Within Budget</Label>
                  <div className="text-sm text-muted-foreground">
                    Is this request within the allocated budget?
                  </div>
                </div>
                <Switch
                  id="within-budget-mobile"
                  checked={isWithinBudget}
                  onCheckedChange={setIsWithinBudget}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks-mobile">Remarks (Optional)</Label>
                <Textarea
                  id="remarks-mobile"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any comments about the budget review..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setIsWithinBudget(true);
                  setRemarks("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? "Processing..." : "Submit"}
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
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            disabled={isApproving}
          >
            <DollarSign className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget Approval</DialogTitle>
            <DialogDescription>
              Review budget for {request.requestedBy.name}'s material request ({request.docNo})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
              <div className="text-2xl font-bold">₱{request.total.toLocaleString()}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="within-budget-desktop">Within Budget</Label>
                <div className="text-sm text-muted-foreground">
                  Is this request within the allocated budget?
                </div>
              </div>
              <Switch
                id="within-budget-desktop"
                checked={isWithinBudget}
                onCheckedChange={setIsWithinBudget}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks-desktop">Remarks (Optional)</Label>
              <Textarea
                id="remarks-desktop"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any comments about the budget review..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setIsWithinBudget(true);
                setRemarks("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
            >
              {isApproving ? "Processing..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
