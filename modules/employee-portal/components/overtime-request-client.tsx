"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconClockPlay,
  IconHourglass,
  IconPlus,
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { cancelOvertimeRequestAction, createOvertimeRequestAction } from "@/modules/employee-portal/actions/overtime-request-actions"

type OvertimeRequestRow = {
  id: string
  requestNumber: string
  overtimeDate: string
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

export function OvertimeRequestClient({ companyId, requests }: OvertimeRequestClientProps) {
  const [isPending, startTransition] = useTransition()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [overtimeDate, setOvertimeDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

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
      const result = await createOvertimeRequestAction({
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
      setOvertimeDate(undefined)
      setStartTime("")
      setEndTime("")
      setReason("")
      window.location.reload()
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
      window.location.reload()
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-lg bg-primary hover:bg-primary/90">
              <IconPlus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[95vw] rounded-2xl border-border/60 shadow-none sm:!max-w-[450px]">
            <DialogHeader className="mb-3 border-b border-border/60 pb-3">
              <DialogTitle className="text-base font-semibold">Submit Overtime Request</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Fill in the details for your overtime request</DialogDescription>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">Cancel</Button>
                <Button onClick={submit} disabled={isPending} className="rounded-lg">
                  {isPending ? "Submitting..." : "Submit"}
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Approved Hours", value: `${summary.approvedHours.toFixed(1)} HRS`, icon: IconClockPlay },
              { label: "Pending", value: String(summary.pending), icon: IconHourglass },
              { label: "Approved", value: String(summary.approved), icon: IconCheck },
              { label: "Rejected", value: String(summary.rejected), icon: IconX },
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
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="grid grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2">
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">OT Date</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Time</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
              </div>
              {(() => {
                const totalPages = Math.ceil(requests.length / ITEMS_PER_PAGE)
                const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
                const paginatedRequests = requests.slice(startIndex, startIndex + ITEMS_PER_PAGE)
                return (
                  <>
                    {paginatedRequests.map((request) => {
                      const isExpanded = expandedRequestId === request.id
                      return (
                        <div key={request.id} className={cn("group border-b border-border/60 last:border-b-0 cursor-pointer transition-colors", isExpanded && "bg-primary/10")}>
                          <div className="grid grid-cols-12 items-center gap-3 px-3 py-4" onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}>
                            <div className="col-span-2 text-xs text-foreground">{request.requestNumber}</div>
                            <div className="col-span-2 text-sm text-foreground">{request.overtimeDate}</div>
                            <div className="col-span-2 text-sm text-foreground leading-tight">
                              <div>{formatClock(request.startTime)}</div>
                              <div className="text-muted-foreground text-xs">to {formatClock(request.endTime)}</div>
                            </div>
                            <div className="col-span-1 text-sm text-foreground">{request.hours} HRS</div>
                            <div className="col-span-2 text-xs text-foreground line-clamp-2">{request.reason || "No reason provided"}</div>
                            <div className="col-span-2">
                              <Badge variant={statusVariant(request.statusCode)} className="w-full justify-center rounded-full border px-2 py-1 text-xs shadow-none">{statusLabel(request.statusCode)}</Badge>
                            </div>
                            <div className="col-span-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
                              {request.statusCode === "PENDING" ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="rounded-lg">Cancel</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-base font-semibold">Confirm Cancellation</AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm">Are you sure you want to cancel this overtime request?</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-lg">Keep Request</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => cancel(request.id)} className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Cancel</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : null}
                            </div>
                          </div>

                          {isExpanded && (request.supervisorApproverName || request.hrApproverName || request.statusCode !== "PENDING") ? (
                            <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
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
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Page {currentPage} of {totalPages} • {requests.length} records
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={currentPage <= 1}
                            onClick={() => { setCurrentPage(currentPage - 1); setExpandedRequestId(null) }}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={currentPage >= totalPages}
                            onClick={() => { setCurrentPage(currentPage + 1); setExpandedRequestId(null) }}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
