"use client";

import { useState } from "react";
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
import { Loader2, Calendar, Users } from "lucide-react";
import { createLeaveType } from "@/lib/actions/leave-type-actions";
import { toast } from "sonner";

interface CreateLeaveTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessUnitId: string;
}

export function CreateLeaveTypeDialog({ 
  open, 
  onOpenChange, 
  businessUnitId 
}: CreateLeaveTypeDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    defaultAllocatedDays: ""
  });

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
      const result = await createLeaveType(
        businessUnitId,
        formData.name.trim(),
        allocatedDays
      );
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setFormData({ name: "", defaultAllocatedDays: "" });
        onOpenChange(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to create leave type");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setFormData({ name: "", defaultAllocatedDays: "" });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Leave Type
          </DialogTitle>
          <DialogDescription>
            Create a new leave type. This will automatically create leave balances for all users in the business unit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Leave Type Name</Label>
            <Input
              id="name"
              placeholder="e.g., Vacation, Sick Leave, Personal Time"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultAllocatedDays">Default Allocated Days</Label>
            <Input
              id="defaultAllocatedDays"
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
              Number of days allocated to each employee for this leave type
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Automatic Balance Creation
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Creating this leave type will automatically add leave balances for all users in the business unit for the current year.
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
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Leave Type
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}