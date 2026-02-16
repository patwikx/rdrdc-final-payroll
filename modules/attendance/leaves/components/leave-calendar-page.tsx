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
import {
  IconBuilding,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClockHour4,
  IconLoader2,
  IconProgressAlert,
  IconRosetteDiscountCheck,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
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

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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
          <p className="text-sm text-muted-foreground">Review all submitted leave requests by calendar day.</p>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="relative overflow-hidden border border-border/60 bg-background">
            {isMonthPending ? <div className="absolute left-0 top-0 z-20 h-0.5 w-full bg-primary/70 animate-pulse" /> : null}
            <div className="space-y-3 border-b border-border/60 bg-muted/10 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight text-foreground">{format(baseMonth, "MMMM yyyy")}</p>
                    {isMonthPending ? (
                      <Badge variant="outline" className="h-5 gap-1 border-primary/30 bg-primary/5 px-1.5 text-[10px] font-medium text-primary">
                        <IconLoader2 className="size-3 animate-spin" />
                        Updating
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">Coverage: {range.startDate} to {range.endDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMonth(subMonths(baseMonth, 1))}
                    disabled={isMonthPending}
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    <IconChevronLeft className="size-3.5" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMonth(new Date())}
                    disabled={isMonthPending}
                    className="h-8 text-xs font-medium"
                  >
                    Current
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMonth(addMonths(baseMonth, 1))}
                    disabled={isMonthPending}
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    Next
                    <IconChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" /> With Leave Entries
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> No Leave
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/10">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-border/60 px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className={cn("grid grid-cols-7 transition-opacity", isMonthPending ? "pointer-events-none opacity-80" : "opacity-100")}>
              {calendarDays.map((day) => {
                const dayKey = toDateKey(day)
                const dayLeaveIds = leaveIdsByDate[dayKey] ?? []
                const inMonth = day.getMonth() === baseMonth.getMonth() && day.getFullYear() === baseMonth.getFullYear()
                const isSelected = selectedDateKey === dayKey

                if (!inMonth) {
                  return (
                    <div
                      key={day.toISOString()}
                      className="min-h-[128px] border-r border-b border-border/60 bg-muted/5"
                      aria-hidden="true"
                    />
                  )
                }

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "group min-h-[128px] border-r border-b border-border/60 bg-background p-2.5 text-left transition-colors hover:bg-muted/30",
                      isToday(day) && !isSelected ? "ring-1 ring-primary/40" : "",
                      isSelected ? "bg-primary text-primary-foreground ring-1 ring-primary hover:bg-primary/90" : ""
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                          isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                        )}
                      >
                        {format(day, "dd")}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          isSelected ? "text-primary-foreground/90" : dayLeaveIds.length > 0 ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {dayLeaveIds.length > 0 ? `${dayLeaveIds.length} ${dayLeaveIds.length === 1 ? "leave" : "leaves"}` : "No leave"}
                      </span>
                    </div>

                    {dayLeaveIds.length > 0 ? (
                      <div className="space-y-1">
                        {dayLeaveIds.slice(0, 3).map((leaveId) => {
                          const leave = leaveById.get(leaveId)
                          if (!leave) return null

                          return (
                            <div
                              key={`${leave.id}-${dayKey}`}
                              className={cn(
                                "truncate rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                              )}
                            >
                              {leave.employeeName}
                            </div>
                          )
                        })}
                        {dayLeaveIds.length > 3 ? (
                          <p className={cn("text-[10px]", isSelected ? "text-primary-foreground/85" : "text-muted-foreground")}>
                            +{dayLeaveIds.length - 3} more
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border border-border/60 bg-background">
            <div className="space-y-2 border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Submitted Leaves</h2>
                {selectedDateKey ? (
                  <Badge variant="outline" className="h-6 px-2 text-[11px]">
                    {selectedDateLeaves.length} {selectedDateLeaves.length === 1 ? "entry" : "entries"}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {effectiveSelectedDate ? `Date: ${format(effectiveSelectedDate, "PPP")}` : "Select a date to see submitted leaves."}
              </p>
              {loadError ? (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {loadError}
                </div>
              ) : null}
            </div>

            <ScrollArea className="h-[56vh] min-h-[300px] px-4 py-3 lg:h-[calc(100vh-320px)]">
              {!selectedDateKey ? (
                <div className="space-y-3">
                  <div className="border border-border/60 bg-muted/20 px-3 py-3">
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <IconCalendarEvent className="size-3.5" />
                      No Date Selected
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Pick a calendar day to inspect submitted leave requests.</p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <IconRosetteDiscountCheck className="size-3.5 text-emerald-600" /> Approved requests
                    </div>
                    <div className="flex items-center gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <IconClockHour4 className="size-3.5 text-amber-600" /> Pending and supervisor-approved
                    </div>
                    <div className="flex items-center gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <IconX className="size-3.5 text-red-600" /> Rejected requests
                    </div>
                    <div className="flex items-center gap-2 border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <IconProgressAlert className="size-3.5 text-primary" /> Reason and half-day context when available
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pr-2">
                  <LeaveCalendarDetailsPanel selectedDateKey={selectedDateKey} selectedDateLeaves={selectedDateLeaves} />
                </div>
              )}
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </aside>
        </div>
      </div>
    </main>
  )
}
