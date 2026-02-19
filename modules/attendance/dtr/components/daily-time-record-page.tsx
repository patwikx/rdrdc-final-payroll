"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconClockHour4,
  IconDownload,
  IconEdit,
  IconFilter,
  IconSearch,
  IconUsers,
  IconUserScan,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { exportDtrCsvAction } from "@/modules/attendance/dtr/actions/export-dtr-csv-action"
import { updateDtrRecordAction } from "@/modules/attendance/dtr/actions/update-dtr-record-action"
import { stripDtrInternalTokens } from "@/modules/attendance/dtr/utils/wall-clock"
import type { DtrLogRow } from "@/modules/attendance/dtr/utils/get-dtr-logs-view-model"

type DailyTimeRecordPageProps = {
  companyId: string
  companyName: string
  filters: {
    startDate: string
    endDate: string
  }
  summary: {
    activeEmployees: number
    presentToday: number
    absentToday: number
    recordsInRange: number
    pendingApprovals: number
    withLate: number
    withUndertime: number
    missingLogsEstimate: number
  }
  rows: DtrLogRow[]
  loadError?: string
}

const statusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "PRESENT") return "default"
  if (status === "ABSENT" || status === "AWOL") return "destructive"
  if (status === "ON_LEAVE" || status === "REST_DAY" || status === "HOLIDAY") return "secondary"
  return "outline"
}

const approvalBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "PENDING") return "secondary"
  return "outline"
}

const toNumericLabel = (value: number, fractionDigits = 2): string => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function DailyTimeRecordPage({
  companyId,
  companyName,
  filters,
  summary,
  rows,
  loadError,
}: DailyTimeRecordPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [startDate, setStartDate] = useState(filters.startDate)
  const [endDate, setEndDate] = useState(filters.endDate)
  const [editingRow, setEditingRow] = useState<DtrLogRow | null>(null)
  const [editStatus, setEditStatus] = useState<string>("PRESENT")
  const [editTimeIn, setEditTimeIn] = useState("")
  const [editTimeOut, setEditTimeOut] = useState("")
  const [editRemarks, setEditRemarks] = useState("")

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.attendanceStatus !== statusFilter) {
        return false
      }

      if (!normalized) {
        return true
      }

      return (
        row.employeeName.toLowerCase().includes(normalized) ||
        row.employeeNumber.toLowerCase().includes(normalized) ||
        row.department.toLowerCase().includes(normalized) ||
        row.position.toLowerCase().includes(normalized) ||
        row.attendanceDate.toLowerCase().includes(normalized)
      )
    })
  }, [query, rows, statusFilter])

  const openEditDialog = (row: DtrLogRow) => {
    setEditingRow(row)
    setEditStatus(row.attendanceStatus)
    setEditTimeIn(row.timeInValue)
    setEditTimeOut(row.timeOutValue)
    setEditRemarks(stripDtrInternalTokens(row.remarks))
  }

  const handleExportCsv = () => {
    startTransition(async () => {
      if (!startDate || !endDate) {
        toast.error("Please select a start and end date before exporting.")
        return
      }

      const result = await exportDtrCsvAction({
        companyId,
        startDate,
        endDate,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const blob = new Blob([result.content], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("DTR CSV exported.")
    })
  }

  const handleSaveCorrection = () => {
    if (!editingRow) return

    startTransition(async () => {
      const result = await updateDtrRecordAction({
        companyId,
        dtrId: editingRow.id,
        employeeId: editingRow.employeeId,
        attendanceDate: editingRow.attendanceDateValue,
        attendanceStatus: editStatus as "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "REST_DAY" | "SUSPENDED" | "AWOL",
        actualTimeIn: editTimeIn,
        actualTimeOut: editTimeOut,
        remarks: editRemarks,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setEditingRow(null)
      router.refresh()
    })
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconUserScan className="size-5" /> {companyName} Daily Time Record</h1>
            <p className="text-xs text-muted-foreground">
              Date range: {filters.startDate} to {filters.endDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} disabled={isPending}>
              <IconDownload className="size-4" />
              Export CSV
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="?">
                <IconCalendarEvent className="size-4" />
                Last 30 Days
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Employees"
          value={String(summary.activeEmployees)}
          hint={`${summary.presentToday} present today`}
          icon={<IconUsers className="size-4" />}
        />
        <MetricCard
          label="Records in Range"
          value={String(summary.recordsInRange)}
          hint={`${summary.missingLogsEstimate} missing log estimate`}
          icon={<IconClockHour4 className="size-4" />}
        />
        <MetricCard
          label="Attendance Exceptions"
          value={String(summary.withLate + summary.withUndertime + summary.absentToday)}
          hint={`${summary.withLate} late, ${summary.withUndertime} undertime`}
          icon={<IconAlertTriangle className="size-4" />}
        />
        <MetricCard
          label="For Approval"
          value={String(summary.pendingApprovals)}
          hint="Pending DTR approvals"
          icon={<IconFilter className="size-4" />}
        />
      </section>

      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>DTR Logs</CardTitle>
            <CardDescription>Attendance records copied with reference DTR range/filter behavior.</CardDescription>
          </div>
          <form className="grid gap-2 md:grid-cols-[180px_180px_auto]" method="get">
            <Input name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Input name="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            <Button type="submit" variant="outline">
              Apply Date Range
            </Button>
          </form>
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search employee, department, position"
                className="pl-7"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                <SelectItem value="REST_DAY">Rest Day</SelectItem>
                <SelectItem value="HOLIDAY">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[1180px] text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Position</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time In</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time Out</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hours</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Late</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">UT</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">OT</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">ND</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Attendance</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Approval</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={14}>
                      No DTR records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-border/50">
                      <td className="px-3 py-2 text-foreground">{row.attendanceDate}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{row.employeeName}</div>
                        <div className="text-[11px] text-muted-foreground">{row.employeeNumber}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.department}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.position}</td>
                      <td className="px-3 py-2">{row.timeIn}</td>
                      <td className="px-3 py-2">{row.timeOut}</td>
                      <td className="px-3 py-2">{toNumericLabel(row.hoursWorked)}</td>
                      <td className="px-3 py-2">{row.tardinessMins}</td>
                      <td className="px-3 py-2">{row.undertimeMins}</td>
                      <td className="px-3 py-2">{toNumericLabel(row.overtimeHours)}</td>
                      <td className="px-3 py-2">{toNumericLabel(row.nightDiffHours)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(row.attendanceStatus)}>{row.attendanceStatus.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={approvalBadgeVariant(row.approvalStatus)}>{row.approvalStatus}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" type="button" onClick={() => openEditDialog(row)}>
                          <IconEdit className="size-3.5" />
                          Correct
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingRow)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRow(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>DTR Correction</DialogTitle>
            <DialogDescription>
              {editingRow
                ? `${editingRow.employeeName} - ${editingRow.attendanceDate}`
                : "Update attendance status and attendance times."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Attendance Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">PRESENT</SelectItem>
                  <SelectItem value="ABSENT">ABSENT</SelectItem>
                  <SelectItem value="ON_LEAVE">ON LEAVE</SelectItem>
                  <SelectItem value="HOLIDAY">HOLIDAY</SelectItem>
                  <SelectItem value="REST_DAY">REST DAY</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="AWOL">AWOL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time In</Label>
              <Input type="time" value={editTimeIn} onChange={(event) => setEditTimeIn(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time Out</Label>
              <Input type="time" value={editTimeOut} onChange={(event) => setEditTimeOut(event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                value={editRemarks}
                onChange={(event) => setEditRemarks(event.target.value)}
                placeholder="Add reason for correction"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingRow(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveCorrection} disabled={isPending}>
              {isPending ? "Saving..." : "Save Correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
}) {
  return (
    <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
      <CardContent className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-full border border-border/60 bg-muted/30 p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  )
}
