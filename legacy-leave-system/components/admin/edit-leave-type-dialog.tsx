"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Edit, AlertTriangle } from "lucide-react";
import { updateLeaveType } from "@/lib/actions/leave-type-actions";
import { toast } from "sonner";

interface EditLeaveTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessUnitId: string;
  leaveType: {
    id: string;
    name: string;
    defaultAllocatedDays: number;
  };
}

export function EditLeaveTypeDialog({ 
  open, 
  onOpenChange, 
  businessUnitId,
  leaveType
}: EditLeaveTypeDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    defaultAllocatedDays: ""
  });

  // Initialize form data when dialog opens or leaveType changes
  useEffect(() => {
    if (open && leaveType) {
      setFormData({
        name: leaveType.name,
        defaultAllocatedDays: leaveType.defaultAllocatedDays.toString()
      });
    }
  }, [open, leaveType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Leave type name is required");
      return;
    }
    
    const allocatedDays = parseFloat(formData.defaultAllocatedDays);
    if (isNaN(allocatedDays) || allocatedDays < 0) {
      toast.error("Please enter a valid number of allocated days");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await updateLeaveType(
        businessUnitId,
        leaveType.id,
        formData.name.trim(),
        allocatedDays
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        onOpenChange(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update leave type");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Leave Type
          </DialogTitle>
          <DialogDescription>
            Update the leave type details. Changes to default allocated days will not affect existing balances.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Leave Type Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g., Vacation, Sick Leave, Personal Time"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-defaultAllocatedDays">Default Allocated Days</Label>
            <Input
              id="edit-defaultAllocatedDays"
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g., 15"
              value={formData.defaultAllocatedDays}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultAllocatedDays: e.target.value }))}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Default allocation for new users and future replenishments
            </p>
          </div>

          {/* Warning Box */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Important Note
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Changes to default allocated days will only apply to new users and future leave balance replenishments. Existing user balances will not be modified.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Leave Type
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}