"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Clock, Loader2, ChevronDownIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitOvertimeRequest } from "@/lib/actions/request-actions";
import Link from "next/link";

interface OvertimeRequestFormProps {
  businessUnitId: string;
}

export function OvertimeRequestForm({ businessUnitId }: OvertimeRequestFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const handleDateCalendarSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setDatePopoverOpen(false);
  };

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
    
    // Format date without timezone conversion to avoid date shifting
    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Combine date and time for both start and end (same date)
    const dateStr = formatDateLocal(selectedDate);
    const startDateTime = `${dateStr}T${startTime}`;
    const endDateTime = `${dateStr}T${endTime}`;
    
    formData.set("startTime", startDateTime);
    formData.set("endTime", endDateTime);
    
    const result = await submitOvertimeRequest(formData);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      router.push(`/${businessUnitId}`);
    }
    
    setIsSubmitting(false);
  };

  return (
    <form action={handleSubmit} className="space-y-6">
          {/* Policy Notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Policy Reminder</p>
              <p className="text-blue-800 dark:text-blue-200">
                All overtime work must be pre-approved by your manager as per company policy. 
                Please ensure you have received approval before working overtime hours.
              </p>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-3">
            <Label htmlFor="date-picker" className="px-1">Overtime Date</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  id="date-picker"
                  className={cn(
                    "w-full h-12 justify-between font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  {selectedDate ? selectedDate.toLocaleDateString() : "Select date"}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  captionLayout="dropdown"
                  onSelect={handleDateCalendarSelect}
                  fromYear={new Date().getFullYear() - 1}
                  toYear={new Date().getFullYear() + 1}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Time Period</Label>
            <div className="flex gap-4">
              <div className="flex flex-col gap-3 flex-1">
                <Label className="text-sm px-1">Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-12 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-3 flex-1">
                <Label className="text-sm px-1">End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-12 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
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
          <div className="space-y-3">
            <Label htmlFor="reason">Reason for Overtime</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Please provide a reason for your overtime request..."
              required
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" asChild>
              <Link href={`/${businessUnitId}`}>Cancel</Link>
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