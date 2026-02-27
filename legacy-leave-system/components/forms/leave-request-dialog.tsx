"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Loader2, 
  Briefcase, 
  Heart, 
  Clock, 
  AlertTriangle,
  Sun,
  Sunset,
  Clock8
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitLeaveRequest, getLeaveTypes } from "@/lib/actions/request-actions";
import { useMediaQuery } from "@/hooks/use-media-query";

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveRequestDialogProps {
  children?: React.ReactNode;
}

function getLeaveTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sick')) return Heart;
  if (lowerName.includes('vacation')) return Sun;
  if (lowerName.includes('cto')) return Clock;
  if (lowerName.includes('mandatory')) return AlertTriangle;
  return Briefcase;
}

function getLeaveTypeDescription(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sick')) return "For medical appointments and illness";
  if (lowerName.includes('vacation')) return "For personal time off and holidays";
  if (lowerName.includes('cto')) return "Compensatory time off";
  if (lowerName.includes('mandatory')) return "Required company leave";
  return "General leave request";
}

function LeaveRequestForm({ onClose }: { onClose: () => void }) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [selectedSession, setSelectedSession] = useState("FULL_DAY");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();


  useEffect(() => {
    async function fetchLeaveTypes() {
      const types = await getLeaveTypes();
      setLeaveTypes(types);
    }
    fetchLeaveTypes();
  }, []);

  const handleSubmit = async (formData: FormData) => {
    if (!startDate || !endDate || !selectedLeaveType) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    // Add selected values to form data
    formData.set("leaveTypeId", selectedLeaveType);
    formData.set("session", selectedSession);
    formData.set("startDate", startDate.toISOString().split('T')[0]);
    formData.set("endDate", endDate.toISOString().split('T')[0]);
    
    const result = await submitLeaveRequest(formData);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      onClose();
    }
    
    setIsSubmitting(false);
  };

  const selectedLeaveTypeData = leaveTypes.find(type => type.id === selectedLeaveType);
  const LeaveIcon = selectedLeaveTypeData ? getLeaveTypeIcon(selectedLeaveTypeData.name) : Briefcase;

  return (
    <form action={handleSubmit} className="space-y-6 p-4 sm:p-0">
      {/* Leave Type Selection */}
      <div className="space-y-3">
        <Label>Leave Type</Label>
        <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType} required>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select leave type..." />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((type) => {
              const Icon = getLeaveTypeIcon(type.name);
              return (
                <SelectItem key={type.id} value={type.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {getLeaveTypeDescription(type.name)}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedLeaveTypeData && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <LeaveIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {getLeaveTypeDescription(selectedLeaveTypeData.name)}
            </span>
          </div>
        )}
      </div>

      {/* Date Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Pick start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "Pick end date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => date < (startDate || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Session Selection */}
      <div className="space-y-2">
        <Label>Session</Label>
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            type="button"
            variant={selectedSession === "FULL_DAY" ? "default" : "outline"}
            className="h-12 flex-col gap-1 text-xs min-w-0"
            onClick={() => setSelectedSession("FULL_DAY")}
          >
            <Clock8 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Full Day</span>
          </Button>
          <Button
            type="button"
            variant={selectedSession === "MORNING" ? "default" : "outline"}
            className="h-12 flex-col gap-1 text-xs min-w-0"
            onClick={() => setSelectedSession("MORNING")}
          >
            <Sun className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Morning</span>
          </Button>
          <Button
            type="button"
            variant={selectedSession === "AFTERNOON" ? "default" : "outline"}
            className="h-12 flex-col gap-1 text-xs min-w-0"
            onClick={() => setSelectedSession("AFTERNOON")}
          >
            <Sunset className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Afternoon</span>
          </Button>
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="Please provide a reason for your leave request..."
          required
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !selectedLeaveType || !startDate || !endDate}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Submit Request
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function LeaveRequestDialog({ children }: LeaveRequestDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Submit Leave Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[100vw] sm:w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Submit Leave Request</DialogTitle>
          <DialogDescription>
            Fill out the form below to submit your leave request for approval.
          </DialogDescription>
        </DialogHeader>
        <LeaveRequestForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}