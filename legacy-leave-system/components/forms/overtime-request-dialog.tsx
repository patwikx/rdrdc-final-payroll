"use client";

import { useState } from "react";
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
import { Clock, Plus, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitOvertimeRequest } from "@/lib/actions/request-actions";
import { useMediaQuery } from "@/hooks/use-media-query";

interface OvertimeRequestDialogProps {
  children?: React.ReactNode;
}

function OvertimeRequestForm({ onClose }: { onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");


  const handleSubmit = async (formData: FormData) => {
    if (!selectedDate || !startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate that end time is after start time
    if (startTime >= endTime) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSubmitting(true);
    
    // Combine date and time for both start and end (same date)
    const dateStr = selectedDate.toISOString().split('T')[0];
    const startDateTime = `${dateStr}T${startTime}`;
    const endDateTime = `${dateStr}T${endTime}`;
    
    formData.set("startTime", startDateTime);
    formData.set("endTime", endDateTime);
    
    const result = await submitOvertimeRequest(formData);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      onClose();
    }
    
    setIsSubmitting(false);
  };

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Date Selection */}
      <div className="space-y-2">
        <Label>Overtime Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full h-12 justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : "Pick overtime date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Time Period</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-12"
              required
            />
          </div>
        </div>
        {startTime && endTime && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Clock className="inline h-4 w-4 mr-2" />
            Duration: {startTime} - {endTime}
            {startTime >= endTime && (
              <span className="text-destructive ml-2">⚠ End time must be after start time</span>
            )}
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Overtime</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="Please provide a reason for your overtime request..."
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
        <Button 
          type="submit" 
          disabled={isSubmitting || !selectedDate || !startTime || !endTime || startTime >= endTime}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Submit Request
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function OvertimeRequestDialog({ children }: OvertimeRequestDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Submit Overtime Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[100vw] sm:w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Submit Overtime Request</DialogTitle>
          <DialogDescription>
            Fill out the form below to submit your overtime request for approval.
          </DialogDescription>
        </DialogHeader>
        <OvertimeRequestForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}