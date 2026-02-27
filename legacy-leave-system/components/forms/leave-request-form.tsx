"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Loader2, 
  Briefcase, 
  Heart, 
  Clock, 
  AlertTriangle,
  Sun,
  Sunset,
  Clock8,
  ChevronDownIcon,
  AlertCircle,
  Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitLeaveRequest } from "@/lib/actions/request-actions";
import Link from "next/link";

interface LeaveType {
  id: string;
  name: string;
}

interface LeaveRequestFormProps {
  leaveTypes: LeaveType[];
  businessUnitId: string;
}

function getLeaveTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sick')) return Heart;
  if (lowerName.includes('vacation')) return Sun;
  if (lowerName.includes('cto')) return Clock;
  if (lowerName.includes('mandatory')) return AlertTriangle;
  return Briefcase;
}



export function LeaveRequestForm({ leaveTypes, businessUnitId }: LeaveRequestFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [selectedSession, setSelectedSession] = useState("FULL_DAY");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);

  // Helper function to check if vacation leave is selected
  const isVacationLeave = () => {
    if (!selectedLeaveType) return false;
    const selectedType = leaveTypes.find(type => type.id === selectedLeaveType);
    return selectedType?.name.toLowerCase().includes('vacation') || false;
  };

  // Helper function to check if the selected leave type allows past dates
  const allowsPastDates = () => {
    if (!selectedLeaveType) return false;
    const selectedType = leaveTypes.find(type => type.id === selectedLeaveType);
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
      // Set to a very old date to effectively disable the restriction
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

  // Helper function to check if the selected dates represent a single day
  const isSingleDay = () => {
    if (!startDate || !endDate) return false;
    return startDate.getTime() === endDate.getTime();
  };

  // Helper function to calculate total leave days
  const calculateLeaveDays = () => {
    if (!startDate || !endDate) return 0;
    
    // Calculate the difference in days
    const timeDifference = endDate.getTime() - startDate.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
    
    // Apply session multiplier
    const sessionMultiplier = selectedSession === "FULL_DAY" ? 1 : 0.5;
    
    return daysDifference * sessionMultiplier;
  };

  const handleStartDateCalendarSelect = (date: Date | undefined) => {
    setStartDate(date);
    setStartDatePopoverOpen(false);
    
    // If selecting multi-day range, reset to full day
    if (date && endDate && date.getTime() !== endDate.getTime()) {
      setSelectedSession("FULL_DAY");
    }
  };

  const handleEndDateCalendarSelect = (date: Date | undefined) => {
    setEndDate(date);
    setEndDatePopoverOpen(false);
    
    // If selecting multi-day range, reset to full day
    if (date && startDate && date.getTime() !== startDate.getTime()) {
      setSelectedSession("FULL_DAY");
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (!startDate || !endDate || !selectedLeaveType) {
      toast.error("Please fill in all required fields");
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
    
    // Add selected values to form data
    formData.set("leaveTypeId", selectedLeaveType);
    formData.set("session", selectedSession);
    // Format dates without timezone conversion to avoid date shifting
    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    formData.set("startDate", formatDateLocal(startDate));
    formData.set("endDate", formatDateLocal(endDate));
    
    const result = await submitLeaveRequest(formData);
    
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
          {/* Leave Type Selection */}
          <div className="space-y-3">
            <Label>Leave Type</Label>
            <Select 
              value={selectedLeaveType} 
              onValueChange={(value) => {
                const previousType = leaveTypes.find(type => type.id === selectedLeaveType);
                const newType = leaveTypes.find(type => type.id === value);
                
                // If switching to vacation leave, clear dates that might be invalid
                if (newType?.name.toLowerCase().includes('vacation') && 
                    !previousType?.name.toLowerCase().includes('vacation')) {
                  const minDate = new Date();
                  minDate.setDate(minDate.getDate() + 3);
                  
                  // Clear dates if they're within the 3-day window
                  if (startDate && startDate < minDate) {
                    setStartDate(undefined);
                  }
                  if (endDate && endDate < minDate) {
                    setEndDate(undefined);
                  }
                }
                
                setSelectedLeaveType(value);
              }} 
              required
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select leave type..." />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => {
                  const Icon = getLeaveTypeIcon(type.name);
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{type.name} LEAVE</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Vacation Leave Notice */}
            {selectedLeaveType && leaveTypes.find(type => type.id === selectedLeaveType)?.name.toLowerCase().includes('vacation') && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Vacation Leave Policy</p>
                  <p className="text-amber-800 dark:text-amber-200">
                    All vacation leaves must be filed 3 days before the start of your leave. 
                    Please ensure you submit your request with adequate notice.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="start-date-picker" className="px-1">Start Date</Label>
              <Popover open={startDatePopoverOpen} onOpenChange={setStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    id="start-date-picker"
                    className={cn(
                      "w-full h-12 justify-between font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    {startDate ? startDate.toLocaleDateString() : "Select start date"}
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    captionLayout="dropdown"
                    onSelect={handleStartDateCalendarSelect}
                    disabled={(date) => date < getMinimumDate()}
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 10}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              <Label htmlFor="end-date-picker" className="px-1">End Date</Label>
              <Popover open={endDatePopoverOpen} onOpenChange={setEndDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    id="end-date-picker"
                    className={cn(
                      "w-full h-12 justify-between font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    {endDate ? endDate.toLocaleDateString() : "Select end date"}
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    captionLayout="dropdown"
                    onSelect={handleEndDateCalendarSelect}
                    disabled={(date) => date < (startDate || getMinimumDate())}
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 10}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Session Selection */}
          <div className="space-y-3">
            <Label>Session</Label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant={selectedSession === "FULL_DAY" ? "default" : "outline"}
                className="h-16 flex-col gap-2"
                onClick={() => setSelectedSession("FULL_DAY")}
              >
                <Clock8 className="h-5 w-5" />
                <span className="text-sm">Full Day</span>
              </Button>
              <Button
                type="button"
                variant={selectedSession === "MORNING" ? "default" : "outline"}
                className={cn(
                  "h-16 flex-col gap-2",
                  !isSingleDay() && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => isSingleDay() && setSelectedSession("MORNING")}
                disabled={!isSingleDay()}
              >
                <Sun className="h-5 w-5" />
                <span className="text-sm">Morning</span>
              </Button>
              <Button
                type="button"
                variant={selectedSession === "AFTERNOON" ? "default" : "outline"}
                className={cn(
                  "h-16 flex-col gap-2",
                  !isSingleDay() && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => isSingleDay() && setSelectedSession("AFTERNOON")}
                disabled={!isSingleDay()}
              >
                <Sunset className="h-5 w-5" />
                <span className="text-sm">Afternoon</span>
              </Button>
            </div>

            {/* Multi-day notice */}
            {startDate && endDate && !isSingleDay() && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                Morning and afternoon sessions are only available for single-day leave requests.
              </div>
            )}

            {/* Leave Days Calculation */}
            {startDate && endDate && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <CalendarIcon className="inline h-4 w-4 mr-2" />
                <span className="font-medium">Total Leave Days: </span>
                <span className="font-semibold text-foreground">
                  {calculateLeaveDays()} {calculateLeaveDays() === 1 ? 'day' : 'days'}
                </span>
                {selectedSession !== "FULL_DAY" && (
                  <span className="text-xs ml-2 text-muted-foreground">
                    ({selectedSession.toLowerCase()} session = 0.5 days)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-3">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Please provide a reason for your leave request..."
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
            <Button type="submit" disabled={isSubmitting || !selectedLeaveType || !startDate || !endDate}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
    </form>
  );
}