"use client"

import {
  IconCalendarEvent,
  IconClockHour4,
  IconFileText,
  IconProgressAlert,
  IconRosetteDiscountCheck,
  IconTag,
  IconUser,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { LeaveCalendarEntry } from "@/modules/attendance/leaves/utils/get-leave-calendar-view-model"

type LeaveCalendarDetailsPanelProps = {
  selectedDateKey: string
  selectedDateLeaves: LeaveCalendarEntry[]
}

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "PENDING" || status === "SUPERVISOR_APPROVED") return "secondary"
  return "outline"
}

const statusLabel = (status: string): string => {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const statusBadgeClass = (status: string): string => {
  if (status === "APPROVED") return "border-none bg-blue-600 text-white"
  if (status === "REJECTED") return "border-none bg-red-600 text-white"
  if (status === "SUPERVISOR_APPROVED") return "border-none bg-emerald-600 text-white"
  if (status === "PENDING") return "border-none bg-muted text-foreground"
  return ""
}

const statusAccentClass = (status: string): string => {
  if (status === "APPROVED") return "border-l-blue-600"
  if (status === "REJECTED") return "border-l-red-600"
  if (status === "SUPERVISOR_APPROVED") return "border-l-emerald-600"
  if (status === "PENDING") return "border-l-muted-foreground"
  return "border-l-border"
}

const statusIcon = (status: string) => {
  if (status === "APPROVED") {
    return <IconRosetteDiscountCheck className="size-3.5 text-white" />
  }
  if (status === "REJECTED") {
    return <IconX className="size-3.5 text-white" />
  }
  if (status === "SUPERVISOR_APPROVED") {
    return <IconRosetteDiscountCheck className="size-3.5 text-white" />
  }
  if (status === "PENDING") {
    return <IconClockHour4 className="size-3.5 text-foreground/70" />
  }
  return <IconProgressAlert className="size-3.5 text-muted-foreground" />
}

export function LeaveCalendarDetailsPanel({ selectedDateKey, selectedDateLeaves }: LeaveCalendarDetailsPanelProps) {
  if (selectedDateLeaves.length === 0) {
    return (
      <div className="border border-border/60 bg-muted/15 px-3 py-4">
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <IconCalendarEvent className="size-3.5" />
          No Submitted Leaves
        </p>
        <p className="mt-1 text-sm text-muted-foreground">No leave requests were submitted for this date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {selectedDateLeaves.map((leave) => (
        <article
          key={`${leave.id}-${selectedDateKey}`}
          className={cn("space-y-2 border border-border/60 border-l-2 bg-background px-3 py-3", statusAccentClass(leave.status))}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">{leave.employeeName}</p>
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <IconUser className="size-3.5" />
                {leave.employeeNumber}
              </p>
            </div>
            <Badge
              variant={badgeVariant(leave.status)}
              className={cn("h-5 px-2 text-[10px] font-medium uppercase tracking-wide", statusBadgeClass(leave.status))}
            >
              <span className="mr-1">{statusIcon(leave.status)}</span>
              {statusLabel(leave.status)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-5 gap-1 px-2 text-[10px] font-medium">
              <IconTag className="size-3" />
              {leave.leaveType}
            </Badge>
            <Badge variant="outline" className="h-5 px-2 text-[10px] font-medium">
              {leave.isHalfDay ? `Half-day (${leave.halfDayPeriod ?? "N/A"})` : "Whole day"}
            </Badge>
          </div>

          <div className="space-y-1 border border-border/50 bg-muted/10 px-2.5 py-2">
            <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconFileText className="size-3.5" />
              Reason
            </p>
            <p className="text-sm text-foreground line-clamp-2">{leave.reason?.trim() ? leave.reason : "No reason provided."}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
