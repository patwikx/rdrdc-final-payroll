"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  IconCalendarEvent,
  IconCheck,
  IconCircleMinus,
  IconClockHour4,
  IconClockPlay,
  IconEdit,
  IconFilterOff,
  IconHourglass,
  IconPlus,
  IconSearch,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  cancelOvertimeRequestAction,
  createOvertimeRequestAction,
  updateOvertimeRequestAction,
} from "@/modules/employee-portal/actions/overtime-request-actions"

type OvertimeRequestRow = {
  id: string
  requestNumber: string
  overtimeDate: string
  overtimeDateInput: string
  startTime: string
  endTime: string
  hours: number
  reason: string | null
  statusCode: string
  supervisorApproverName: string | null
  supervisorApprovedAt: string | null
  supervisorApprovalRemarks: string | null
  hrApproverName: string | null
  hrApprovedAt: string | null
  hrApprovalRemarks: string | null
  hrRejectedAt: string | null
  hrRejectionReason: string | null
}

type OvertimeRequestClientProps = {
  companyId: string
  requests: OvertimeRequestRow[]
}

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "CANCELLED") return "outline"
  return "secondary"
}

const statusLabel = (status: string): string => {
  if (status === "SUPERVISOR_APPROVED") return "Supervisor Approved"
  return status
}

const timeToMinutes = (value: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null
  const [hour, minute] = value.split(":").map((part) => Number(part))
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

const formatClock = (iso: string): string => {
  const date = new Date(iso)
  const hour24 = date.getUTCHours()
  const minute = date.getUTCMinutes()
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${hour12.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${period}`
}

const formatClockInput = (iso: string): string => {
  const date = new Date(iso)
  const hour = date.getUTCHours().toString().padStart(2, "0")
  const minute = date.getUTCMinutes().toString().padStart(2, "0")
  return `${hour}:${minute}`
}

const parseDateInput = (value: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map((part) => Number(part))
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return undefined
  return new Date(year, month - 1, day)
}

export function OvertimeRequestClient({ companyId, requests }: OvertimeRequestClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [overtimeDate, setOvertimeDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState("10")
  const [logSearch, setLogSearch] = useState("")
  const [logStatus, setLogStatus] = useState("ALL")
  const itemsPerPage = Number(pageSize)

  const requestedHours = useMemo(() => {
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    if (startMinutes === null || endMinutes === null) return null
    const diff = endMinutes - startMinutes
    if (diff <= 0) return null
    return diff / 60
  }, [startTime, endTime])

  const summary = useMemo(
    () =>
      requests.reduce(
        (acc, item) => {
          if (item.statusCode === "PENDING") acc.pending += 1
          if (item.statusCode === "APPROVED") {
            acc.approved += 1
            acc.approvedHours += item.hours
          }
          if (item.statusCode === "REJECTED") acc.rejected += 1
          return acc
        },
        { pending: 0, approved: 0, rejected: 0, approvedHours: 0 }
      ),
    [requests]
  )

  const filteredRequests = useMemo(() => {
    const query = logSearch.trim().toLowerCase()

    return requests.filter((request) => {
      if (logStatus !== "ALL" && request.statusCode !== logStatus) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        request.requestNumber,
        request.overtimeDate,
        request.reason ?? "",
        request.statusCode,
        statusLabel(request.statusCode),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [logSearch, logStatus, requests])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage)

  const resetForm = () => {
    setOvertimeDate(undefined)
    setStartTime("")
    setEndTime("")
    setReason("")
    setEditingRequestId(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (request: OvertimeRequestRow) => {
    setEditingRequestId(request.id)
    setOvertimeDate(parseDateInput(request.overtimeDateInput))
    setStartTime(formatClockInput(request.startTime))
    setEndTime(formatClockInput(request.endTime))
    setReason(request.reason ?? "")
    setDialogOpen(true)
  }

  const submit = () => {
    if (!overtimeDate || !startTime || !endTime) {
      toast.error("Please complete overtime date, start time, and end time.")
      return
    }

    if (requestedHours === null) {
      toast.error("End time must be later than start time.")
      return
    }

    startTransition(async () => {
      const result = editingRequestId
        ? await updateOvertimeRequestAction({
            companyId,
            requestId: editingRequestId,
            overtimeDate: format(overtimeDate, "yyyy-MM-dd"),
            startTime,
            endTime,
            reason,
          })
        : await createOvertimeRequestAction({
            companyId,
            overtimeDate: format(overtimeDate, "yyyy-MM-dd"),
            startTime,
            endTime,
            reason,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDialogOpen(false)
      resetForm()
      router.refresh()
    })
  }

  const cancel = (requestId: string) => {
    startTransition(async () => {
      const result = await cancelOvertimeRequestAction({ companyId, requestId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Employee Self-Service</p>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Overtime Requests</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Extra Hours</div>
          </div>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" className="rounded-lg bg-primary hover:bg-primary/90" onClick={openCreateDialog}>
              <IconPlus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent
            className="w-[95vw] max-w-[95vw] rounded-2xl border-border/60 shadow-none sm:!max-w-[450px]"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader className="mb-3 border-b border-border/60 pb-3">
              <DialogTitle className="text-base font-semibold">
                {editingRequestId ? "Edit Overtime Request" : "Submit Overtime Request"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingRequestId
                  ? "Update the details of your pending overtime request."
                  : "Fill in the details for your overtime request"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-xs text-foreground">Overtime Date <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start rounded-lg text-left", !overtimeDate && "text-muted-foreground")}>
                      <IconCalendarEvent className="mr-2 h-4 w-4" />
                      {overtimeDate ? format(overtimeDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                    <Calendar mode="single" selected={overtimeDate} onSelect={setOvertimeDate} captionLayout="dropdown" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <Label className="text-xs text-foreground">Start Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="rounded-lg text-sm" />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs text-foreground">End Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="rounded-lg text-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {requestedHours === null ? "--" : `${requestedHours.toFixed(2)} hours`}
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-foreground">Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter reason for overtime..."
                  className="min-h-[80px] resize-none rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">Cancel</Button>
                <Button type="button" onClick={submit} disabled={isPending} className="rounded-lg">
                  {isPending ? (editingRequestId ? "Updating..." : "Submitting...") : editingRequestId ? "Update Request" : "Submit"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <IconClockHour4 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">My Overtime Summary</h2>
          </div>

          {(() => {
            const stats = [
              { label: "Approved Hours", value: `${summary.approvedHours.toFixed(1)} HRS`, icon: IconClockPlay },
              { label: "Pending", value: String(summary.pending), icon: IconHourglass },
              { label: "Approved", value: String(summary.approved), icon: IconCheck },
              { label: "Rejected", value: String(summary.rejected), icon: IconX },
            ]

            return (
              <>
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/60 bg-card p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-lg font-semibold text-foreground">{stat.value}</span>
                    </div>
                  ))}
                </div>

                <div className="hidden grid-cols-1 gap-3 sm:grid md:grid-cols-2 lg:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-2xl font-semibold text-foreground">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <IconClockHour4 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Request Log</h2>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 py-14 text-center">
              <p className="text-sm font-semibold text-foreground">No History</p>
              <p className="text-sm text-muted-foreground">You haven&apos;t made any overtime requests yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
              <div className="flex flex-col gap-2 border-b border-border/60 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-[360px] sm:flex-none">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(event) => {
                      setLogSearch(event.target.value)
                      setCurrentPage(1)
                      setExpandedRequestId(null)
                    }}
                    placeholder="Search request #, reason, status"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={logStatus}
                  onValueChange={(value) => {
                    setLogStatus(value)
                    setCurrentPage(1)
                    setExpandedRequestId(null)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="SUPERVISOR_APPROVED">Supervisor Approved</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLogSearch("")
                    setLogStatus("ALL")
                    setCurrentPage(1)
                    setExpandedRequestId(null)
                  }}
                >
                  <IconFilterOff className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No overtime requests match the current filters.
                </div>
              ) : null}

              {filteredRequests.length > 0 ? (
                <>
                  <div className="space-y-2 p-3 md:hidden">
                    {paginatedRequests.map((request) => {
                      const isExpanded = expandedRequestId === request.id
                      return (
                        <div
                          key={request.id}
                          className={cn(
                            "rounded-xl border border-border/60 bg-background transition-colors",
                            isExpanded && "border-primary/40 bg-primary/10"
                          )}
                        >
                          <button
                            type="button"
                            className="w-full p-3 text-left"
                            onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground">Request #</p>
                                <p className="truncate text-sm font-medium text-foreground">{request.requestNumber}</p>
                              </div>
                              <Badge variant={statusVariant(request.statusCode)} className="shrink-0 text-xs font-normal">
                                {statusLabel(request.statusCode)}
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                              <div>
                                <p className="text-[11px] text-muted-foreground">OT Date</p>
                                <p className="text-foreground">{request.overtimeDate}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Hours</p>
                                <p className="text-foreground">{request.hours} HRS</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[11px] text-muted-foreground">Time</p>
                                <p className="text-foreground">{formatClock(request.startTime)} to {formatClock(request.endTime)}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[11px] text-muted-foreground">Reason</p>
                                <p className="line-clamp-2 text-foreground">{request.reason || "No reason provided"}</p>
                              </div>
                            </div>
                          </button>

                          {request.statusCode === "PENDING" ? (
                            <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2" onClick={(event) => event.stopPropagation()}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 flex-1 rounded-lg text-xs"
                                onClick={() => openEditDialog(request)}
                                disabled={isPending}
                              >
                                <IconEdit className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 flex-1 rounded-lg text-xs"
                                    disabled={isPending}
                                  >
                                    <IconCircleMinus className="mr-1.5 h-3.5 w-3.5" />
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-base font-semibold">Confirm Cancellation</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm">
                                      Are you sure you want to cancel this overtime request?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-lg">Keep Request</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancel(request.id)}
                                      className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, Cancel
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : null}

                          {isExpanded && (request.supervisorApproverName || request.hrApproverName || request.statusCode !== "PENDING") ? (
                            <div className="border-t border-border/60 bg-muted/30 px-3 py-3">
                              <p className="mb-2 text-xs text-muted-foreground">Approval Status</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
                                  {request.supervisorApprovedAt ? <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" /> : request.statusCode === "PENDING" ? <IconClockHour4 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" /> : <IconUser className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">Supervisor</p>
                                    {request.supervisorApproverName ? <p className="mt-1 text-sm text-muted-foreground">{request.supervisorApproverName}</p> : null}
                                    {request.supervisorApprovedAt ? <p className="mt-1 text-xs text-green-600">Approved {request.supervisorApprovedAt}</p> : null}
                                    {request.supervisorApprovalRemarks ? <p className="mt-1 text-xs italic text-muted-foreground">&quot;{request.supervisorApprovalRemarks}&quot;</p> : null}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
                                  {request.hrApprovedAt ? <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" /> : request.hrRejectedAt ? <IconX className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" /> : request.statusCode === "SUPERVISOR_APPROVED" ? <IconClockHour4 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" /> : <IconUser className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">HR</p>
                                    {request.hrApproverName ? <p className="mt-1 text-sm text-muted-foreground">{request.hrApproverName}</p> : null}
                                    {request.hrApprovedAt ? <p className="mt-1 text-xs text-green-600">Approved {request.hrApprovedAt}</p> : null}
                                    {request.hrApprovalRemarks ? <p className="mt-1 text-xs italic text-muted-foreground">&quot;{request.hrApprovalRemarks}&quot;</p> : null}
                                    {request.hrRejectedAt ? <p className="mt-1 text-xs text-destructive">Rejected {request.hrRejectedAt}</p> : null}
                                    {request.hrRejectionReason ? <p className="mt-1 text-xs italic text-destructive">Reason: &quot;{request.hrRejectionReason}&quot;</p> : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 md:grid">
                    <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                    <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">OT Date</p>
                    <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                    <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
                    <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                    <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                  </div>
                  <div className="hidden md:block">
                    {paginatedRequests.map((request) => {
                      const isExpanded = expandedRequestId === request.id
                      return (
                        <div key={request.id} className={cn("group border-b border-border/60 last:border-b-0 transition-colors", isExpanded && "bg-primary/10")}>
                          <div className="hidden cursor-pointer grid-cols-12 items-center gap-3 px-3 py-4 md:grid" onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}>
                            <div className="col-span-2 text-xs text-foreground">{request.requestNumber}</div>
                            <div className="col-span-2 text-xs text-foreground">{request.overtimeDate}</div>
                            <div className="col-span-2 text-xs text-foreground leading-tight">
                              <div>{formatClock(request.startTime)}</div>
                              <div className="text-xs text-muted-foreground">to {formatClock(request.endTime)}</div>
                            </div>
                            <div className="col-span-1 text-xs text-foreground">{request.hours} HRS</div>
                            <div className="col-span-2 text-xs text-foreground line-clamp-2">{request.reason || "No reason provided"}</div>
                            <div className="col-span-2">
                              <Badge variant={statusVariant(request.statusCode)} className="w-full justify-center text-xs font-normal">{statusLabel(request.statusCode)}</Badge>
                            </div>
                            <div className="col-span-1 flex justify-end" onClick={(event) => event.stopPropagation()}>
                              {request.statusCode === "PENDING" ? (
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg px-2 text-xs"
                                        onClick={() => openEditDialog(request)}
                                        disabled={isPending}
                                      >
                                        <IconEdit className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={6}>
                                      Edit Request
                                    </TooltipContent>
                                  </Tooltip>

                                  <AlertDialog>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-8 rounded-lg px-2 text-xs"
                                            disabled={isPending}
                                          >
                                            <IconCircleMinus className="h-3.5 w-3.5" />
                                          </Button>
                                        </AlertDialogTrigger>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" sideOffset={6}>
                                        Cancel Request
                                      </TooltipContent>
                                    </Tooltip>
                                    <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-base font-semibold">Confirm Cancellation</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm">
                                          Are you sure you want to cancel this overtime request?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-lg">Keep Request</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => cancel(request.id)}
                                          className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Yes, Cancel
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {isExpanded && (request.supervisorApproverName || request.hrApproverName || request.statusCode !== "PENDING") ? (
                            <div className="hidden border-t border-border/60 bg-muted/30 px-4 py-3 md:block">
                              <p className="mb-2 text-xs text-muted-foreground">Approval Status</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
                                  {request.supervisorApprovedAt ? <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" /> : request.statusCode === "PENDING" ? <IconClockHour4 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" /> : <IconUser className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">Supervisor</p>
                                    {request.supervisorApproverName ? <p className="mt-1 text-sm text-muted-foreground">{request.supervisorApproverName}</p> : null}
                                    {request.supervisorApprovedAt ? <p className="mt-1 text-xs text-green-600">Approved {request.supervisorApprovedAt}</p> : null}
                                    {request.supervisorApprovalRemarks ? <p className="mt-1 text-xs italic text-muted-foreground">&quot;{request.supervisorApprovalRemarks}&quot;</p> : null}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3">
                                  {request.hrApprovedAt ? <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" /> : request.hrRejectedAt ? <IconX className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" /> : request.statusCode === "SUPERVISOR_APPROVED" ? <IconClockHour4 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" /> : <IconUser className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">HR</p>
                                    {request.hrApproverName ? <p className="mt-1 text-sm text-muted-foreground">{request.hrApproverName}</p> : null}
                                    {request.hrApprovedAt ? <p className="mt-1 text-xs text-green-600">Approved {request.hrApprovedAt}</p> : null}
                                    {request.hrApprovalRemarks ? <p className="mt-1 text-xs italic text-muted-foreground">&quot;{request.hrApprovalRemarks}&quot;</p> : null}
                                    {request.hrRejectedAt ? <p className="mt-1 text-xs text-destructive">Rejected {request.hrRejectedAt}</p> : null}
                                    {request.hrRejectionReason ? <p className="mt-1 text-xs italic text-destructive">Reason: &quot;{request.hrRejectionReason}&quot;</p> : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        Page {safeCurrentPage} of {totalPages} • {filteredRequests.length} records
                      </p>
                      <Select
                        value={pageSize}
                        onValueChange={(value) => {
                          setPageSize(value)
                          setCurrentPage(1)
                          setExpandedRequestId(null)
                        }}
                      >
                        <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 / page</SelectItem>
                          <SelectItem value="20">20 / page</SelectItem>
                          <SelectItem value="30">30 / page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => { setCurrentPage(safeCurrentPage - 1); setExpandedRequestId(null) }}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => { setCurrentPage(safeCurrentPage + 1); setExpandedRequestId(null) }}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
