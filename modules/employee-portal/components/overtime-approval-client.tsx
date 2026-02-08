"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import {
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconFilterOff,
  IconListCheck,
  IconSearch,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  approveOvertimeByHrAction,
  approveOvertimeBySupervisorAction,
  rejectOvertimeByHrAction,
} from "@/modules/employee-portal/actions/approval-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type OvertimeApprovalRow = {
  id: string
  requestNumber: string
  overtimeDate: string
  hours: number
  reason: string | null
  statusCode: string
  employeeName: string
  employeeNumber: string
  ctoConversionPreview: boolean
}

type OvertimeApprovalClientProps = {
  companyId: string
  isHR: boolean
  rows: OvertimeApprovalRow[]
  historyRows: OvertimeApprovalHistoryRow[]
}

export type OvertimeApprovalHistoryRow = OvertimeApprovalRow & {
  decidedAtIso: string
  decidedAtLabel: string
}

const toLabel = (statusCode: string): string => {
  if (statusCode === "SUPERVISOR_APPROVED") return "Supervisor Approved"
  return statusCode.replace(/_/g, " ")
}

const toDateValue = (date?: Date): string => (date ? format(date, "yyyy-MM-dd") : "")
const fromDateValue = (value: string): Date | undefined => (value ? new Date(`${value}T00:00:00`) : undefined)

export function OvertimeApprovalClient({ companyId, isHR, rows, historyRows }: OvertimeApprovalClientProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState("ALL")
  const [historyFromDate, setHistoryFromDate] = useState("")
  const [historyToDate, setHistoryToDate] = useState("")
  const [isPending, startTransition] = useTransition()

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const stats = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => sum + row.hours, 0)
    const employeeCount = new Set(rows.map((row) => row.employeeNumber)).size
    return {
      totalRequests: rows.length,
      totalHours,
      employeeCount,
    }
  }, [rows])
  const filteredHistoryRows = useMemo(() => {
    const search = historySearch.trim().toLowerCase()
    return historyRows.filter((row) => {
      if (historyStatus !== "ALL" && row.statusCode !== historyStatus) return false
      if (historyFromDate && row.decidedAtIso.slice(0, 10) < historyFromDate) return false
      if (historyToDate && row.decidedAtIso.slice(0, 10) > historyToDate) return false
      if (!search) return true

      return (
        row.requestNumber.toLowerCase().includes(search) ||
        row.employeeName.toLowerCase().includes(search) ||
        row.employeeNumber.toLowerCase().includes(search) ||
        row.overtimeDate.toLowerCase().includes(search) ||
        (row.reason ?? "").toLowerCase().includes(search)
      )
    })
  }, [historyFromDate, historyRows, historySearch, historyStatus, historyToDate])
  const hasActiveHistoryFilters = historySearch.trim().length > 0 || historyStatus !== "ALL" || Boolean(historyFromDate) || Boolean(historyToDate)

  const openDecision = (rowId: string, type: "approve" | "reject") => {
    setSelectedId(rowId)
    setActionType(type)
    setRemarks("")
    setOpen(true)
  }

  const submit = () => {
    if (!selectedId) return

    startTransition(async () => {
      const response = isHR
        ? actionType === "approve"
          ? await approveOvertimeByHrAction({ companyId, requestId: selectedId, remarks })
          : await rejectOvertimeByHrAction({ companyId, requestId: selectedId, remarks })
        : await approveOvertimeBySupervisorAction({ companyId, requestId: selectedId, remarks })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Request Management</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Overtime Approvals</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {isHR ? "HR Final Approval" : "Supervisor Queue"}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Requests In Queue", value: String(stats.totalRequests), icon: IconListCheck },
            { label: "Total OT Hours", value: `${stats.totalHours.toFixed(2)} hrs`, icon: IconClockHour4 },
            { label: "Employees", value: String(stats.employeeCount), icon: IconUserCircle },
            { label: "Approval Stage", value: isHR ? "HR Final" : "Supervisor", icon: IconClockHour4 },
          ].map((stat) => (
            <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-2xl font-semibold text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">No requests pending your approval.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-4 last:border-b-0 hover:bg-muted/20">
                <div className="col-span-2">
                  <p className="text-sm font-medium text-foreground">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.employeeNumber}</p>
                </div>
                <div className="col-span-2 text-sm text-foreground">{row.overtimeDate}</div>
                <div className="col-span-1">
                  <p className="text-sm text-foreground">{row.hours.toFixed(2)}h</p>
                  {isHR && row.ctoConversionPreview ? (
                    <Badge className="mt-1 bg-primary text-primary-foreground">CTO 1:1</Badge>
                  ) : null}
                </div>
                <div className="col-span-3 text-xs text-muted-foreground line-clamp-2">{row.reason ?? "-"}</div>
                <div className="col-span-2">
                  <Badge variant={row.statusCode === "PENDING" ? "secondary" : "default"} className="w-full justify-center rounded-full text-xs">
                    {toLabel(row.statusCode)}
                  </Badge>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  {isHR ? (
                    <Button variant="outline" size="icon-sm" className="rounded-lg" onClick={() => openDecision(row.id, "reject")}>
                      <IconX className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button size="icon-sm" className="rounded-lg bg-green-600 hover:bg-green-700" onClick={() => openDecision(row.id, "approve")}>
                    <IconCheck className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Approval History</h2>
            <span className="text-xs text-muted-foreground">{filteredHistoryRows.length} records</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search employee/request..." value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} className="rounded-lg pl-8" />
            </div>
            <Select value={historyStatus} onValueChange={setHistoryStatus}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="SUPERVISOR_APPROVED">Supervisor Approved</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyFromDate && "text-muted-foreground")}>
                  <IconCalendarEvent className="mr-2 h-4 w-4" />
                  {historyFromDate ? format(fromDateValue(historyFromDate) as Date, "PPP") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDateValue(historyFromDate)}
                  onSelect={(date) => {
                    const nextFrom = toDateValue(date)
                    setHistoryFromDate(nextFrom)
                    if (historyToDate && nextFrom && historyToDate < nextFrom) {
                      setHistoryToDate("")
                    }
                  }}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !historyToDate && "text-muted-foreground")}>
                  <IconCalendarEvent className="mr-2 h-4 w-4" />
                  {historyToDate ? format(fromDateValue(historyToDate) as Date, "PPP") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDateValue(historyToDate)}
                  onSelect={(date) => setHistoryToDate(toDateValue(date))}
                  disabled={(date) => {
                    if (!historyFromDate) return false
                    return date < new Date(`${historyFromDate}T00:00:00`)
                  }}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-lg"
              onClick={() => {
                setHistorySearch("")
                setHistoryStatus("ALL")
                setHistoryFromDate("")
                setHistoryToDate("")
              }}
              disabled={!hasActiveHistoryFilters}
            >
              <IconFilterOff className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>

          {filteredHistoryRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No approval history found for the selected filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              {filteredHistoryRows.map((row) => (
                <div key={`history-${row.id}`} className="grid grid-cols-12 items-center gap-3 border-b border-border/60 px-3 py-4 last:border-b-0 hover:bg-muted/20">
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-foreground">{row.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{row.employeeNumber}</p>
                  </div>
                  <div className="col-span-2 text-sm text-foreground">{row.overtimeDate}</div>
                  <div className="col-span-1">
                    <p className="text-sm text-foreground">{row.hours.toFixed(2)}h</p>
                    {isHR && row.ctoConversionPreview ? (
                      <Badge className="mt-1 bg-primary text-primary-foreground">CTO 1:1</Badge>
                    ) : null}
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground line-clamp-2">{row.reason ?? "-"}</div>
                  <div className="col-span-2 space-y-1">
                    <Badge variant={row.statusCode === "REJECTED" ? "destructive" : "default"} className="w-full justify-center rounded-full text-xs">
                      {toLabel(row.statusCode)}
                    </Badge>
                    <p className="text-center text-[11px] text-muted-foreground">{row.decidedAtLabel}</p>
                  </div>
                  <div className="col-span-3 text-right text-xs text-muted-foreground">{row.requestNumber}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-border/60 shadow-none">
          <DialogHeader className="mb-3 border-b border-border/60 pb-3">
            <DialogTitle className="text-base font-semibold">
              {actionType === "approve" ? "Approve" : "Reject"} Overtime Request
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selected?.requestNumber} - {selected?.employeeName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="mt-1 text-sm font-medium text-foreground">{selected?.overtimeDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours</p>
                <p className="mt-1 text-sm font-medium text-foreground">{selected?.hours.toFixed(2)} Hours</p>
                {isHR && selected?.ctoConversionPreview ? (
                  <Badge className="mt-2 bg-primary text-primary-foreground">Will convert to CTO leave (1:1)</Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-foreground">
                {actionType === "approve" ? "Approval Remarks (Optional)" : "Rejection Reason"}
              </Label>
              <Textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="min-h-[100px] rounded-lg text-sm"
                placeholder={actionType === "approve" ? "Add remarks..." : "Provide rejection reason..."}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
              <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
              <Button
                className={cn("rounded-lg", actionType === "reject" && "bg-destructive hover:bg-destructive/90")}
                onClick={submit}
                disabled={isPending || (actionType === "reject" && !remarks.trim())}
              >
                {isPending ? <IconClockHour4 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {actionType === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
