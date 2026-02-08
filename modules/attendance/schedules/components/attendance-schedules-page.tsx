"use client"

import { useMemo, useState } from "react"
import { IconCalendarTime, IconClock, IconSearch } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { AttendanceScheduleCard } from "@/modules/attendance/schedules/utils/get-attendance-schedules-view-model"

type AttendanceSchedulesPageProps = {
  companyName: string
  schedules: AttendanceScheduleCard[]
  loadError?: string
}

export function AttendanceSchedulesPage({ companyName, schedules, loadError }: AttendanceSchedulesPageProps) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return schedules

    return schedules.filter((schedule) => {
      return (
        schedule.name.toLowerCase().includes(normalized) ||
        schedule.code.toLowerCase().includes(normalized) ||
        schedule.scheduleType.toLowerCase().includes(normalized)
      )
    })
  }, [query, schedules])

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconCalendarTime className="size-5" /> {companyName} Shifts and Schedules</h1>
        <p className="text-xs text-muted-foreground">Reference layout adapted for company work schedules and day-level time windows.</p>
      </header>

      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Schedule Library</CardTitle>
          <CardDescription>Review active and inactive schedules assigned to employees.</CardDescription>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, name, or schedule type"
              className="pl-7"
            />
          </div>
          {loadError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <section className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
            <CardContent className="px-4 py-6 text-center text-sm text-muted-foreground">No schedules found.</CardContent>
          </Card>
        ) : (
          filtered.map((schedule) => (
            <Card key={schedule.id} className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{schedule.name}</CardTitle>
                    <CardDescription>
                      {schedule.code} - {schedule.scheduleType.replace(/_/g, " ")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={schedule.isActive ? "default" : "outline"}>{schedule.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <IconClock className="size-3.5" />
                      {schedule.requiredHoursPerDay.toFixed(2)} hrs/day
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Break: {schedule.breakDurationMins} mins</span>
                  <span>Grace: {schedule.gracePeriodMins} mins</span>
                  <span>Effective: {schedule.effectiveFrom} to {schedule.effectiveTo}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Day</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time In</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.dayPreview.map((day) => (
                        <tr key={`${schedule.id}-${day.day}`} className="border-t border-border/50">
                          <td className="px-3 py-2 font-medium text-foreground">{day.day}</td>
                          <td className="px-3 py-2 text-muted-foreground">{day.isWorkingDay ? "Working" : "Rest"}</td>
                          <td className="px-3 py-2">{day.timeIn}</td>
                          <td className="px-3 py-2">{day.timeOut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  )
}
