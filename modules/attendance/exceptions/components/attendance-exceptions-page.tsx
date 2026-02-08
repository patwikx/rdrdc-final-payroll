"use client"

import { useMemo, useState, type ReactNode } from "react"
import { IconAlertTriangle, IconClockHour4, IconHourglassHigh, IconSearch, IconShieldX } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { AttendanceExceptionRow } from "@/modules/attendance/exceptions/utils/get-attendance-exceptions-view-model"

type AttendanceExceptionsPageProps = {
  companyName: string
  filters: {
    startDate: string
    endDate: string
  }
  summary: {
    totalExceptions: number
    absences: number
    withLate: number
    withUndertime: number
    pendingApprovals: number
  }
  rows: AttendanceExceptionRow[]
  loadError?: string
}

const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "ABSENT") return "destructive"
  if (status === "PRESENT") return "default"
  if (status === "ON_LEAVE" || status === "REST_DAY" || status === "HOLIDAY") return "secondary"
  return "outline"
}

export function AttendanceExceptionsPage({ companyName, filters, summary, rows, loadError }: AttendanceExceptionsPageProps) {
  const [query, setQuery] = useState("")

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows

    return rows.filter((row) => {
      return (
        row.employeeName.toLowerCase().includes(normalized) ||
        row.employeeNumber.toLowerCase().includes(normalized) ||
        row.issue.toLowerCase().includes(normalized) ||
        row.attendanceDate.toLowerCase().includes(normalized)
      )
    })
  }, [query, rows])

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconShieldX className="size-5" /> {companyName} Attendance Exceptions</h1>
        <p className="text-xs text-muted-foreground">
          Coverage: {filters.startDate} to {filters.endDate}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Exceptions" value={String(summary.totalExceptions)} icon={<IconAlertTriangle className="size-4" />} />
        <MetricCard label="Absences" value={String(summary.absences)} icon={<IconHourglassHigh className="size-4" />} />
        <MetricCard label="Late / Undertime" value={`${summary.withLate} / ${summary.withUndertime}`} icon={<IconClockHour4 className="size-4" />} />
        <MetricCard label="Pending Approvals" value={String(summary.pendingApprovals)} icon={<IconAlertTriangle className="size-4" />} />
      </section>

      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Exception Queue</CardTitle>
          <CardDescription>Use this list to prioritize corrections and approvals.</CardDescription>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee or issue"
              className="pl-7"
            />
          </div>
          {loadError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[780px] text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Issue</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Attendance</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Approval</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                      No attendance exceptions found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-border/50">
                      <td className="px-3 py-2">{row.attendanceDate}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">{row.employeeNumber}</div>
                      </td>
                      <td className="px-3 py-2 text-foreground">{row.issue}</td>
                      <td className="px-3 py-2">
                        <Badge variant={badgeVariant(row.attendanceStatus)}>{row.attendanceStatus.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={row.approvalStatus === "PENDING" ? "secondary" : "outline"}>{row.approvalStatus}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
      <CardContent className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="rounded-full border border-border/60 bg-muted/30 p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  )
}
