"use client"

import dynamic from "next/dynamic"
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
import { useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconBuilding, IconCalendarEvent } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { LeaveCalendarEntry } from "@/modules/attendance/leaves/utils/get-leave-calendar-view-model"

const LeaveCalendarDetailsPanel = dynamic(
  () =>
    import("@/modules/attendance/leaves/components/leave-calendar-details-panel").then(
      (module) => module.LeaveCalendarDetailsPanel
    ),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading leave details...</p>,
  }
)

type LeaveCalendarPageProps = {
  companyName: string
  selectedMonth: string
  range: {
    startDate: string
    endDate: string
  }
  leaves: LeaveCalendarEntry[]
  leaveIdsByDate: Record<string, string[]>
  loadError?: string
}

const toDateKey = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)

export function LeaveCalendarPage({ companyName, selectedMonth, range, leaves, leaveIdsByDate, loadError }: LeaveCalendarPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMonthPending, startMonthTransition] = useTransition()

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => undefined)

  const baseMonth = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
      const [year, month] = selectedMonth.split("-").map((part) => Number(part))
      return new Date(year, month - 1, 1)
    }

    const fallback = new Date()
    fallback.setDate(1)
    return fallback
  }, [selectedMonth])

  const monthStart = startOfMonth(baseMonth)
  const monthEnd = endOfMonth(baseMonth)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  })

  const leaveById = useMemo(() => {
    return new Map(leaves.map((leave) => [leave.id, leave]))
  }, [leaves])

  const effectiveSelectedDate =
    selectedDate &&
    selectedDate.getMonth() === baseMonth.getMonth() &&
    selectedDate.getFullYear() === baseMonth.getFullYear()
      ? selectedDate
      : undefined
  const selectedDateKey = effectiveSelectedDate ? toDateKey(effectiveSelectedDate) : null
  const selectedDateLeaves = useMemo(() => {
    if (!selectedDateKey) {
      return []
    }

    const leaveIds = leaveIdsByDate[selectedDateKey] ?? []
    return leaveIds.map((leaveId) => leaveById.get(leaveId)).filter((leave): leave is LeaveCalendarEntry => Boolean(leave))
  }, [leaveById, leaveIdsByDate, selectedDateKey])

  const setMonth = (monthDate: Date) => {
    const nextMonth = format(monthDate, "yyyy-MM")
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", nextMonth)
    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    if (nextUrl !== currentUrl) {
      startMonthTransition(() => {
        router.replace(nextUrl, { scroll: false })
      })
    }
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Human Resources</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconCalendarEvent className="size-6 text-primary" /> Leave Calendar
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuilding className="mr-1 size-3.5" />
              {companyName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Shows all submitted leave requests, including pending submissions.</p>
        </div>
      </header>

      <div className="grid border-b border-border/60 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden lg:border-r lg:border-border/60">
          <div className="space-y-3 border-b border-border/60 bg-muted/10 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                onClick={() => setMonth(subMonths(baseMonth, 1))}
                disabled={isMonthPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Previous
              </Button>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{format(baseMonth, "MMMM yyyy")}</p>
                <p className="text-xs text-muted-foreground">Coverage: {range.startDate} to {range.endDate}</p>
                {isMonthPending ? <p className="text-[11px] text-muted-foreground">Loading month...</p> : null}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setMonth(addMonths(baseMonth, 1))}
                disabled={isMonthPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Next
              </Button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> With Leaves</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> No Leaves</div>
            </div>
          </div>
          <div className="p-0">
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/10">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="border-r border-border/60 px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = toDateKey(day)
                const dayLeaveIds = leaveIdsByDate[dayKey] ?? []
                const inMonth = day.getMonth() === baseMonth.getMonth() && day.getFullYear() === baseMonth.getFullYear()
                const isSelected = selectedDateKey === dayKey

                if (!inMonth) {
                  return (
                    <div
                      key={day.toISOString()}
                      className="min-h-[120px] border-r border-b border-border/60 bg-muted/10"
                      aria-hidden="true"
                    />
                  )
                }

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={[
                      "min-h-[120px] border-r border-b border-border/60 p-2 text-left transition-colors",
                      "hover:bg-muted/40",
                      "bg-background",
                      isToday(day) ? "ring-1 ring-primary/40" : "",
                      isSelected ? "bg-primary text-primary-foreground ring-1 ring-primary hover:bg-primary/90" : "",
                    ].join(" ")}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={
                          isSelected
                            ? "inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary-foreground/20 px-1 text-[11px] font-medium text-primary-foreground"
                            : "text-[11px] font-medium text-foreground"
                        }
                      >
                        {format(day, "dd")}
                      </span>
                      {dayLeaveIds.length > 0 ? (
                        <span className={isSelected ? "text-[10px] text-primary-foreground/90" : "text-[10px] text-muted-foreground"}>
                          {dayLeaveIds.length} {dayLeaveIds.length === 1 ? "leave" : "leaves"}
                        </span>
                      ) : null}
                    </div>

                    {dayLeaveIds.length > 0 ? (
                      <div className="space-y-1">
                        {dayLeaveIds.slice(0, 2).map((leaveId) => {
                          const leave = leaveById.get(leaveId)
                          if (!leave) return null

                          return (
                            <div
                              key={`${leave.id}-${dayKey}`}
                              className={[
                                "rounded px-1.5 py-0.5 text-[10px] truncate",
                                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary",
                              ].join(" ")}
                            >
                              {leave.employeeName}
                            </div>
                          )
                        })}
                        {dayLeaveIds.length > 2 ? (
                          <p className={isSelected ? "text-[10px] text-primary-foreground/90" : "text-[10px] text-muted-foreground"}>+{dayLeaveIds.length - 2} more</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className={isSelected ? "text-[10px] text-primary-foreground/90" : "text-[10px] text-muted-foreground"}>No leave</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside>
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Submitted Leaves</h2>
            <p className="text-sm text-muted-foreground">
              {effectiveSelectedDate ? `Date: ${format(effectiveSelectedDate, "PPP")}` : "Select a date to see submitted leaves."}
            </p>
            {loadError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {loadError}
              </div>
            ) : null}
          </div>
          <div className="px-4 py-3">
            {!selectedDateKey ? (
              <p className="text-sm text-muted-foreground">Select a date to load submitted leaves.</p>
            ) : (
              <LeaveCalendarDetailsPanel selectedDateKey={selectedDateKey} selectedDateLeaves={selectedDateLeaves} />
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
