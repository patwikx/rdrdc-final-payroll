"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimePicker12HProps {
  value?: string; // 24-hour format "HH:MM"
  onChange: (value: string) => void; // Returns 24-hour format "HH:MM"
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimePicker12H({ 
  value, 
  onChange, 
  placeholder = "Select time",
  className,
  disabled = false
}: TimePicker12HProps) {
  const [hour12, setHour12] = useState<string>("");
  const [minute, setMinute] = useState<string>("");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  // Convert 24-hour format to 12-hour format
  const convert24To12 = (time24: string) => {
    if (!time24 || !time24.includes(':')) return { hour: "", minute: "", period: "AM" as const };
    
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const minute = minutes;
    
    let hour12: number;
    let period: "AM" | "PM";
    
    if (hour24 === 0) {
      hour12 = 12;
      period = "AM";
    } else if (hour24 < 12) {
      hour12 = hour24;
      period = "AM";
    } else if (hour24 === 12) {
      hour12 = 12;
      period = "PM";
    } else {
      hour12 = hour24 - 12;
      period = "PM";
    }
    
    return {
      hour: hour12.toString(),
      minute,
      period
    };
  };

  // Convert 12-hour format to 24-hour format
  const convert12To24 = (hour12: string, minute: string, period: "AM" | "PM"): string => {
    if (!hour12 || !minute) return "";
    
    let hour24 = parseInt(hour12, 10);
    
    if (period === "AM") {
      if (hour24 === 12) hour24 = 0;
    } else {
      if (hour24 !== 12) hour24 += 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
  };

  // Initialize from value
  useEffect(() => {
    if (value) {
      const { hour, minute: min, period: per } = convert24To12(value);
      setHour12(hour);
      setMinute(min);
      setPeriod(per);
    }
  }, [value]);

  // Update parent when internal state changes
  useEffect(() => {
    if (hour12 && minute) {
      const time24 = convert12To24(hour12, minute, period);
      if (time24 !== value) {
        onChange(time24);
      }
    }
  }, [hour12, minute, period, onChange, value]);

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className={cn("flex gap-2 items-center", className)}>
      {/* Hour */}
      <Select value={hour12} onValueChange={setHour12} disabled={disabled}>
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Hr" />
        </SelectTrigger>
        <SelectContent>
          {hours.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground">:</span>

      {/* Minute */}
      <Select value={minute} onValueChange={setMinute} disabled={disabled}>
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {minutes.map((min) => (
            <SelectItem key={min} value={min}>
              {min}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM/PM */}
      <Select value={period} onValueChange={(value: "AM" | "PM") => setPeriod(value)} disabled={disabled}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}