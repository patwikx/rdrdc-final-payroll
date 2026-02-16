"use client"

import { Badge } from "@/components/ui/badge"
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

export function LeaveCalendarDetailsPanel({ selectedDateKey, selectedDateLeaves }: LeaveCalendarDetailsPanelProps) {
  if (selectedDateLeaves.length === 0) {
    return <p className="text-sm text-muted-foreground">No submitted leaves for this date.</p>
  }

  return (
    <div>
      {selectedDateLeaves.map((leave) => (
        <div key={`${leave.id}-${selectedDateKey}`} className="border-b border-border/60 py-3 last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-foreground">{leave.employeeName}</p>
            <Badge variant={badgeVariant(leave.status)}>{leave.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{leave.employeeNumber} - {leave.leaveType}</p>
          {leave.isHalfDay ? (
            <p className="text-xs text-muted-foreground">Half-day ({leave.halfDayPeriod ?? "N/A"})</p>
          ) : null}
          {leave.reason ? <p className="mt-1 text-xs text-muted-foreground">{leave.reason}</p> : null}
        </div>
      ))}
    </div>
  )
}
