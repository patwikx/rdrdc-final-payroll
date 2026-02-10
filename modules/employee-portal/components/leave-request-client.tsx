"use client"

import { useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  IconAlertTriangle,
  IconBeach,
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconHeartbeat,
  IconMedal,
  IconPlus,
  IconUser,
  type Icon,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { cancelLeaveRequestAction, createLeaveRequestAction } from "@/modules/employee-portal/actions/leave-request-actions"

type LeaveRequestRow = {
  id: string
  requestNumber: string
  isHalfDay: boolean
  halfDayPeriod: string | null
  startDate: string
  endDate: string
  numberOfDays: number
  reason: string | null
  statusCode: string
  leaveTypeName: string
  supervisorApproverName: string | null
  supervisorApprovedAt: string | null
  supervisorApprovalRemarks: string | null
  hrApproverName: string | null
  hrApprovedAt: string | null
  hrApprovalRemarks: string | null
  hrRejectedAt: string | null
  hrRejectionReason: string | null
  approverName: string | null
  rejectionReason: string | null
}

type LeaveTypeOption = {
  id: string
  code: string
  name: string
  isPaid: boolean
  requiresApproval: boolean
}

type LeaveBalanceItem = {
  id: string
  leaveTypeId: string
  leaveTypeName: string
  currentBalance: number
  availableBalance: number
  creditsEarned: number
  creditsUsed: number
}

type LeaveRequestClientProps = {
  companyId: string
  leaveTypes: LeaveTypeOption[]
  leaveBalances: LeaveBalanceItem[]
  requests: LeaveRequestRow[]
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

const hiddenLeaveTypeCodes = new Set(["MATERNITY", "PATERNITY", "BEREAVEMENT", "SOLO_PARENT", "EMERGENCY"])
const leaveBalanceCardNames = new Set([
  "vacation leave",
  "sick leave",
  "mandatory leave",
  "compensatory time off",
  "compensary time off",
  "cto",
])
const formatDays = (value: number): string => (Number.isInteger(value) ? `${value}` : value.toFixed(1))
const isSameCalendarDay = (left: Date, right: Date): boolean => left.toDateString() === right.toDateString()

const getLeaveTypeIcon = (name: string): Icon => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes("vacation")) return IconBeach
  if (lowerName.includes("sick")) return IconHeartbeat
  if (lowerName.includes("emergency")) return IconAlertTriangle
  if (lowerName.includes("maternity") || lowerName.includes("paternity") || lowerName.includes("parental")) return IconUser
  if (lowerName.includes("service") || lowerName.includes("incentive")) return IconMedal
  if (lowerName.includes("bereavement")) return IconCalendarEvent
  return IconClockHour4
}

export function LeaveRequestClient({ companyId, leaveTypes, leaveBalances, requests }: LeaveRequestClientProps) {
  const [isPending, startTransition] = useTransition()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState<"AM" | "PM" | "">("")
  const [reason, setReason] = useState("")

  const leaveBalanceMap = useMemo(() => new Map(leaveBalances.map((item) => [item.leaveTypeId, item])), [leaveBalances])
  const leaveTypeCards = useMemo(
    () =>
      leaveTypes.filter(
        (type) => !hiddenLeaveTypeCodes.has(type.code) && leaveBalanceCardNames.has(type.name.trim().toLowerCase())
      ),
    [leaveTypes]
  )

  const selectedLeaveType = useMemo(() => leaveTypes.find((item) => item.id === leaveTypeId) ?? null, [leaveTypeId, leaveTypes])
  const requiresAdvanceFiling = Boolean(selectedLeaveType?.name.toLowerCase().includes("vacation"))
  const hasMultiDaySelection = Boolean(startDate && endDate && !isSameCalendarDay(startDate, endDate))

  const minimumDate = useMemo(() => {
    if (!requiresAdvanceFiling) return undefined
    const d = new Date()
    d.setDate(d.getDate() + 3)
    d.setHours(0, 0, 0, 0)
    return d
  }, [requiresAdvanceFiling])

  const submit = () => {
    const resolvedEndDate = isHalfDay ? startDate : endDate

    if (!leaveTypeId || !startDate || !resolvedEndDate) {
      toast.error("Please complete leave type, start date, and end date.")
      return
    }

    if (isHalfDay && !halfDayPeriod) {
      toast.error("Please choose AM or PM for half-day requests.")
      return
    }

    startTransition(async () => {
      const result = await createLeaveRequestAction({
        companyId,
        leaveTypeId,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(resolvedEndDate, "yyyy-MM-dd"),
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod || undefined : undefined,
        reason,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDialogOpen(false)
      setLeaveTypeId("")
      setStartDate(undefined)
      setEndDate(undefined)
      setIsHalfDay(false)
      setHalfDayPeriod("")
      setReason("")
      window.location.reload()
    })
  }

  const cancel = (requestId: string) => {
    startTransition(async () => {
      const result = await cancelLeaveRequestAction({ companyId, requestId })
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
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Leave Management</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Time Off</div>
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
              <DialogTitle className="text-base font-semibold">Submit Leave Request</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Fill in the details for your leave request</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-[-15px]">
              {selectedLeaveType ? (
                <div className={cn("rounded-lg border bg-muted/30 px-3 py-2", requiresAdvanceFiling ? "border-orange-600/30" : "border-border/60")}>
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle className={cn("h-3.5 w-3.5", requiresAdvanceFiling ? "text-orange-600" : "text-primary")} />
                    <p className="text-xs font-medium text-foreground">
                      {requiresAdvanceFiling ? "Advance Filing Required" : "Flexible Filing"}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {requiresAdvanceFiling ? "- 3-day minimum notice" : "- past or future dates allowed"}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <Label className="text-xs text-foreground">Leave Type <span className="text-destructive">*</span></Label>
                <Select value={leaveTypeId} onValueChange={(value) => { setLeaveTypeId(value); setStartDate(undefined); setEndDate(undefined) }}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border/60">
                    {leaveTypes.map((type) => {
                      const balance = leaveBalanceMap.get(type.id)
                      const LeaveTypeIcon = getLeaveTypeIcon(type.name)
                      return (
                        <SelectItem key={type.id} value={type.id} className="text-sm">
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="flex min-w-0 items-center gap-2">
                              <LeaveTypeIcon className="h-3.5 w-3.5 text-primary/70" />
                              <span className="truncate">{type.name}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {balance ? `Current ${formatDays(balance.currentBalance)} | Available ${formatDays(balance.availableBalance)}` : "No balance"}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-xs text-foreground">Start Date <span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" disabled={!leaveTypeId} className={cn("w-full justify-start rounded-lg text-left", !startDate && "text-muted-foreground")}>
                        <IconCalendarEvent className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date)
                          if (!date) return

                          if (endDate && endDate > date) {
                            setEndDate(undefined)
                          }

                          if (endDate && !isSameCalendarDay(date, endDate)) {
                            setIsHalfDay(false)
                            setHalfDayPeriod("")
                          }
                        }}
                        disabled={(date) => (minimumDate ? date < minimumDate : false)}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-foreground">End Date <span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" disabled={!leaveTypeId} className={cn("w-full justify-start rounded-lg text-left", !endDate && "text-muted-foreground")}>
                        <IconCalendarEvent className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date)
                          if (!date || !startDate) return

                          if (!isSameCalendarDay(startDate, date)) {
                            setIsHalfDay(false)
                            setHalfDayPeriod("")
                          }
                        }}
                        disabled={(date) => {
                          if (minimumDate && date < minimumDate) return true
                          if (startDate && date < startDate) return true
                          return false
                        }}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex h-9 w-full min-w-0 items-center space-x-3 rounded-lg border border-border/60 bg-background px-3 py-0 text-sm leading-none">
                  <Checkbox
                    id="is-half-day"
                    checked={isHalfDay}
                    disabled={hasMultiDaySelection}
                    onCheckedChange={(checked) => {
                      const next = checked === true
                      setIsHalfDay(next)

                      if (!next) {
                        setHalfDayPeriod("")
                      }

                      if (next && startDate && endDate && !isSameCalendarDay(startDate, endDate)) {
                        setEndDate(startDate)
                      }
                    }}
                    className="border-border/60"
                  />
                  <Label htmlFor="is-half-day" className="cursor-pointer text-xs text-foreground">Half Day Request</Label>
                </div>

                {isHalfDay ? (
                  <div className="min-w-0">
                    <Select value={halfDayPeriod} onValueChange={(value: "AM" | "PM") => setHalfDayPeriod(value)}>
                      <SelectTrigger className="h-9 w-full rounded-lg text-sm">
                        <SelectValue placeholder="Select half-day period" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/60">
                        <SelectItem value="AM" className="min-h-9 text-sm">
                          <span className="flex items-center gap-2">
                            <IconClockHour4 className="h-4 w-4 text-muted-foreground" />
                            Morning (AM)
                          </span>
                        </SelectItem>
                        <SelectItem value="PM" className="min-h-9 text-sm">
                          <span className="flex items-center gap-2">
                            <IconClockHour4 className="h-4 w-4 text-muted-foreground" />
                            Afternoon (PM)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label className="text-xs text-foreground">Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Enter reason for leave..."
                  className="min-h-[90px] resize-none rounded-lg text-sm"
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
            <h2 className="text-sm font-semibold text-foreground">My Leave Balances</h2>
          </div>

          {leaveTypeCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 py-8 text-center text-sm text-muted-foreground">
              No leave types configured.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {leaveTypeCards.map((leaveType) => {
                const balance = leaveBalanceMap.get(leaveType.id)
                const currentBalance = balance?.currentBalance ?? 0
                const availableBalance = balance?.availableBalance ?? 0
                const LeaveTypeIcon = getLeaveTypeIcon(leaveType.name)

                return (
                <div key={leaveType.id} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground" title={leaveType.name}>{leaveType.name}</p>
                    <LeaveTypeIcon className="h-4 w-4 text-primary" />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">Current Available</p>
                    <div className="mt-1 flex items-end gap-1.5">
                      <span className="text-2xl font-semibold text-foreground">{formatDays(availableBalance)}</span>
                      <span className="pb-0.5 text-xs text-muted-foreground">days</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs">
                    <p className="text-muted-foreground">Starting Balance</p>
                    <p className="font-medium text-foreground">{formatDays(currentBalance)} days</p>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <IconClockHour4 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Request Log</h2>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 py-14 text-center">
              <p className="text-sm font-semibold text-foreground">No History</p>
              <p className="text-sm text-muted-foreground">You haven&apos;t made any leave requests yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="hidden grid-cols-12 items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 md:grid">
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Request #</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Leave Type</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date Range</p>
                <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Days</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
              </div>
              {requests.map((request) => (
                <div key={request.id} className="group border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                  <div className="hidden grid-cols-12 items-center gap-3 px-3 py-4 md:grid">
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-foreground">{request.requestNumber}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-foreground">{request.leaveTypeName}</p>
                      {request.isHalfDay ? <p className="mt-0.5 text-xs text-orange-600">Half Day ({request.halfDayPeriod})</p> : null}
                    </div>
                    <div className="col-span-2 text-sm text-foreground">{request.startDate} to {request.endDate}</div>
                    <div className="col-span-1"><span className="inline-block rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs text-foreground">{request.numberOfDays}</span></div>
                    <div className="col-span-2"><p className="line-clamp-2 text-xs text-muted-foreground">{request.reason || "-"}</p></div>
                    <div className="col-span-2">
                      <Badge variant={statusVariant(request.statusCode)} className="w-full justify-center rounded-full border px-2 py-1 text-xs shadow-none">
                        {statusLabel(request.statusCode)}
                      </Badge>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {request.statusCode === "PENDING" ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="rounded-lg">Cancel</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base font-semibold">Confirm Cancellation</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">Are you sure you want to cancel this request?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-lg">Keep Request</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancel(request.id)} className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Cancel</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <div className="text-right text-xs text-muted-foreground">
                          {request.approverName ? <p>Approver: {request.approverName}</p> : null}
                          {request.rejectionReason ? <p className="mt-1 text-destructive">Reason: {request.rejectionReason}</p> : null}
                        </div>
                      )}
                    </div>
                  </div>

                  {(request.supervisorApproverName || request.hrApproverName || request.statusCode !== "DRAFT") ? (
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
                          {request.hrApprovedAt ? <IconCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" /> : request.hrRejectedAt ? <IconAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" /> : request.statusCode === "SUPERVISOR_APPROVED" ? <IconClockHour4 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" /> : <IconUser className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
