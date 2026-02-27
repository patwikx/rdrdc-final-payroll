"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2, 
  Briefcase, 
  Heart, 
  Clock, 
  Sun,
  Sunset,
  Clock8,
  Calendar as CalendarIcon,
  Edit,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateLeaveRequest } from "@/lib/actions/leave-request-actions";
import { format } from "date-fns";

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveRequestWithDetails {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  session: string;
  status: string;
  managerActionBy?: string | null;
  leaveType: {
    id: string;
    name: string;
  };
}

interface EditLeaveRequestFormProps {
  request: LeaveRequestWithDetails;
  leaveTypes: LeaveType[];
  businessUnitId: string;
  onSuccess: () => void;
}

function getLeaveTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('sick') || lowerName.includes('medical')) {
    return Heart;
  }
  if (lowerName.includes('vacation') || lowerName.includes('annual')) {
    return Briefcase;
  }
  return Clock;
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function EditLeaveRequestForm({ 
  request, 
  leaveTypes, 
  businessUnitId, 
  onSuccess 
}: EditLeaveRequestFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState(request.leaveType.id);
  const [startDate, setStartDate] = useState<Date>(new Date(request.startDate));
  const [endDate, setEndDate] = useState<Date>(new Date(request.endDate));
  const [session, setSession] = useState(request.session);
  const [reason, setReason] = useState(request.reason);

  // Check if request can be edited
  const canEdit = request.status.includes('PENDING') && !request.managerActionBy;

  // Helper function to check if vacation leave is selected
  const isVacationLeave = () => {
    if (!leaveTypeId) return false;
    const selectedType = leaveTypes.find(type => type.id === leaveTypeId);
    return selectedType?.name.toLowerCase().includes('vacation') || false;
  };

  // Helper function to check if the selected leave type allows past dates
  const allowsPastDates = () => {
    if (!leaveTypeId) return false;
    const selectedType = leaveTypes.find(type => type.id === leaveTypeId);
    if (!selectedType) return false;
    
    const lowerName = selectedType.name.toLowerCase();
    return lowerName.includes('emergency') || 
           lowerName.includes('cto') || 
           lowerName.includes('sick');
  };

  // Helper function to get minimum allowed date based on leave type
  const getMinimumDate = () => {
    const today = new Date();
    
    if (allowsPastDates()) {
      // For emergency, CTO, and sick leave, allow any past date (no restriction)
      return new Date(1900, 0, 1);
    }
    
    if (isVacationLeave()) {
      // For vacation leave, minimum date is 3 days from today
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + 3);
      return minDate;
    }
    
    // For other leave types, minimum date is today
    return today;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leaveTypeId || !startDate || !endDate || !session || !reason.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (startDate > endDate) {
      toast.error("End date must be after start date");
      return;
    }

    // Validate 3-day advance notice for vacation leave only
    if (isVacationLeave()) {
      const today = new Date();
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);
      
      if (startDate < threeDaysFromNow) {
        toast.error("Vacation leave must be filed at least 3 days in advance");
        return;
      }
    }

    // For non-emergency/CTO/sick leave types, validate that dates are not in the past
    if (!allowsPastDates() && !isVacationLeave()) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
      
      if (startDate < today) {
        toast.error("Leave dates cannot be in the past");
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      const result = await updateLeaveRequest(request.id, {
        leaveTypeId,
        startDate: formatDateLocal(startDate),
        endDate: formatDateLocal(endDate),
        session,
        reason: reason.trim()
      });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Leave request updated successfully");
        setIsOpen(false);
        onSuccess();
      }
    } catch (error) {
      toast.error("Failed to update leave request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setLeaveTypeId(request.leaveType.id);
    setStartDate(new Date(request.startDate));
    setEndDate(new Date(request.endDate));
    setSession(request.session);
    setReason(request.reason);
    setIsOpen(false);
  };

  if (!canEdit) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Leave Request</DialogTitle>
          <DialogDescription>
            Make changes to your leave request. You can only edit requests that haven't been processed by a manager.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Leave Type */}
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type *</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => {
                  const IconComponent = getLeaveTypeIcon(type.name);
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <span>{type.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        if (date > endDate) {
                          setEndDate(date);
                        }
                      }
                    }}
                    disabled={(date) => date < getMinimumDate()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => date < (startDate || getMinimumDate())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Session */}
          <div className="space-y-2">
            <Label htmlFor="session">Session *</Label>
            <Select value={session} onValueChange={setSession}>
              <SelectTrigger>
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DAY">
                  <div className="flex items-center gap-2">
                    <Clock8 className="h-4 w-4" />
                    <span>Full Day</span>
                  </div>
                </SelectItem>
                <SelectItem value="MORNING">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <span>Morning (0.5 day)</span>
                  </div>
                </SelectItem>
                <SelectItem value="AFTERNOON">
                  <div className="flex items-center gap-2">
                    <Sunset className="h-4 w-4" />
                    <span>Afternoon (0.5 day)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}