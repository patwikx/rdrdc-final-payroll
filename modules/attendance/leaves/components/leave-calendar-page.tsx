"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconCalendarEvent } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LeaveCalendarEntry } from "@/modules/attendance/leaves/utils/get-leave-calendar-view-model"

type LeaveCalendarPageProps = {
  companyName: string
  selectedMonth: string
  range: {
    startDate: string
    endDate: string
  }
  leaves: LeaveCalendarEntry[]
  loadError?: string
}

const toDateKey = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "PENDING" || status === "SUPERVISOR_APPROVED") return "secondary"
  return "outline"
}

export function LeaveCalendarPage({ companyName, selectedMonth, range, leaves, loadError }: LeaveCalendarPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(`${range.startDate}T00:00:00Z`))

  const baseMonth = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
      const [year, month] = selectedMonth.split("-").map((part) => Number(part))
      return new Date(Date.UTC(year, month - 1, 1))
    }
    return new Date()
  }, [selectedMonth])

  const monthStart = startOfMonth(baseMonth)
  const monthEnd = endOfMonth(baseMonth)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  })

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntry[]>()
    for (const leave of leaves) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      const cursor = new Date(start)
      while (cursor <= end) {
        const key = toDateKey(cursor)
        const existing = map.get(key) ?? []
        existing.push(leave)
        map.set(key, existing)
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
    return map
  }, [leaves])

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null
  const selectedDateLeaves = selectedDateKey ? leavesByDate.get(selectedDateKey) ?? [] : []

  const setMonth = (monthDate: Date) => {
    const nextMonth = format(monthDate, "yyyy-MM")
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", nextMonth)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h1 className="inline-flex items-center gap-2 text-xl text-foreground"><IconCalendarEvent className="size-5" /> {companyName} Leave Calendar</h1>
        <p className="text-sm text-muted-foreground">Shows all submitted leave requests, including pending submissions.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm overflow-hidden">
          <CardHeader className="space-y-3 border-b border-border/60 bg-muted/10">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                onClick={() => setMonth(subMonths(baseMonth, 1))}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Previous
              </Button>
              <div className="text-center">
                <p className="text-sm text-foreground">{format(baseMonth, "MMMM yyyy")}</p>
                <p className="text-xs text-muted-foreground">Coverage: {range.startDate} to {range.endDate}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setMonth(addMonths(baseMonth, 1))}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Next
              </Button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> With Leaves</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> No Leaves</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/10">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs text-muted-foreground border-r border-border/60 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = toDateKey(day)
                const dayLeaves = leavesByDate.get(dayKey) ?? []
                const inMonth = day.getUTCMonth() === baseMonth.getUTCMonth()
                const isSelected = selectedDate ? toDateKey(selectedDate) === dayKey : false

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={[
                      "min-h-[120px] border-r border-b border-border/60 p-2 text-left transition-colors",
                      "hover:bg-primary/10",
                      inMonth ? "bg-background" : "bg-muted/10 text-muted-foreground",
                      isToday(day) ? "bg-primary/5" : "",
                      isSelected ? "bg-primary text-primary-foreground ring-1 ring-primary hover:bg-primary/90" : "",
                    ].join(" ")}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={isSelected ? "text-xs text-primary-foreground" : "text-xs text-foreground"}>{format(day, "dd")}</span>
                      {dayLeaves.length > 0 ? (
                        <Badge
                          variant={isSelected ? "outline" : "secondary"}
                          className={isSelected ? "h-4 px-1 text-[10px] border-primary-foreground/40 text-primary-foreground bg-primary-foreground/20" : "h-4 px-1 text-[10px]"}
                        >
                          {dayLeaves.length}
                        </Badge>
                      ) : null}
                    </div>

                    {dayLeaves.length > 0 ? (
                      <div className="space-y-1">
                        {dayLeaves.slice(0, 2).map((leave) => (
                          <div
                            key={`${leave.id}-${dayKey}`}
                            className={[
                              "rounded px-1.5 py-0.5 text-[10px] truncate",
                              isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary",
                            ].join(" ")}
                          >
                            {leave.employeeName}
                          </div>
                        ))}
                        {dayLeaves.length > 2 ? (
                          <p className={isSelected ? "text-[10px] text-primary-foreground/90" : "text-[10px] text-muted-foreground"}>+{dayLeaves.length - 2} more</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className={isSelected ? "text-[10px] text-primary-foreground/90" : "text-[10px] text-muted-foreground"}>No leave</p>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Submitted Leaves</CardTitle>
            <CardDescription>
              {selectedDate ? `Date: ${format(selectedDate, "PPP")}` : "Select a date to see submitted leaves."}
            </CardDescription>
            {loadError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {loadError}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {selectedDateLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted leaves for this date.</p>
            ) : (
              <div className="space-y-2">
                {selectedDateLeaves.map((leave) => (
                  <div key={`${leave.id}-${selectedDateKey}`} className="rounded-md border border-border/60 p-3">
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
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
