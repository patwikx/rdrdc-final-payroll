"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AttendanceStatus } from "@prisma/client"
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconClockHour4,
  IconDeviceFloppy,
  IconLoader2,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { getEmployeeLeaveBalancesAction } from "@/modules/attendance/dtr/actions/get-employee-leave-balances-action"
import { updateDtrRecordAction } from "@/modules/attendance/dtr/actions/update-dtr-record-action"
import { getEmployeeScheduleAction } from "@/modules/attendance/dtr/actions/get-employee-schedule-action"
import type { DtrLogItem } from "@/modules/attendance/dtr/types"
import { formatWallClockTime, isHalfDayRemarks, stripDtrInternalTokens } from "@/modules/attendance/dtr/utils/wall-clock"

type ModifyDtrSheetProps = {
  companyId: string
  record: DtrLogItem | null
  isOpen: boolean
  onClose: () => void
}

const STATUS_OPTIONS = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.ON_LEAVE,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.REST_DAY,
  AttendanceStatus.SUSPENDED,
  AttendanceStatus.AWOL,
] as const

const DAY_FRACTION_OPTIONS = [
  { value: "FULL", label: "Full Day" },
  { value: "HALF", label: "Half Day" },
] as const

type LeaveOption = {
  leaveTypeId: string
  name: string
  code: string
  currentBalance: number
  availableBalance: number
}

type LeaveLookupState = {
  key: string
  year: number | null
  leaveOptions: LeaveOption[]
  error: string | null
}

const EMPTY_LEAVE_OPTIONS: LeaveOption[] = []

const toLeaveDays = (dayFraction: "FULL" | "HALF"): number => (dayFraction === "HALF" ? 0.5 : 1)

const formatLeaveDays = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`
  }

  return value.toFixed(2).replace(/\.?0+$/, "")
}

const leaveBalanceLabel = (option: LeaveOption | null): string =>
  `${formatLeaveDays(option?.availableBalance ?? 0)} day(s)`

export function ModifyDtrSheet({ companyId, record, isOpen, onClose }: ModifyDtrSheetProps) {
  if (!record) return null

  return (
    <ModifyDtrSheetForm
      key={`${record.id}-${record.attendanceDate}`}
      companyId={companyId}
      record={record}
      isOpen={isOpen}
      onClose={onClose}
    />
  )
}

function ModifyDtrSheetForm({
  companyId,
  record,
  isOpen,
  onClose,
}: {
  companyId: string
  record: DtrLogItem
  isOpen: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AttendanceStatus>(record.attendanceStatus)
  const [dayFraction, setDayFraction] = useState<"FULL" | "HALF">(isHalfDayRemarks(record.remarks) ? "HALF" : "FULL")
  const [remarks, setRemarks] = useState(stripDtrInternalTokens(record.remarks))
  const [timeIn, setTimeIn] = useState(formatWallClockTime(record.actualTimeIn))
  const [timeOut, setTimeOut] = useState(formatWallClockTime(record.actualTimeOut))
  const [pickedDate, setPickedDate] = useState<Date | undefined>(new Date(record.attendanceDate))
  const [leaveLookupState, setLeaveLookupState] = useState<LeaveLookupState>({
    key: "",
    year: null,
    leaveOptions: [],
    error: null,
  })
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("")

  const attendanceDateValue = format(pickedDate ?? new Date(record.attendanceDate), "yyyy-MM-dd")
  const leaveLookupKey = `${record.id}:${attendanceDateValue}`
  const isLeaveOptionsLoading = isOpen && leaveLookupState.key !== leaveLookupKey
  const leaveOptions = leaveLookupState.key === leaveLookupKey ? leaveLookupState.leaveOptions : EMPTY_LEAVE_OPTIONS
  const leaveYear = leaveLookupState.key === leaveLookupKey ? leaveLookupState.year : null
  const leaveOptionsError = leaveLookupState.key === leaveLookupKey ? leaveLookupState.error : null
  const requiredLeaveDays = toLeaveDays(dayFraction)
  const selectedLeaveOption = useMemo(
    () => leaveOptions.find((item) => item.leaveTypeId === selectedLeaveTypeId) ?? null,
    [leaveOptions, selectedLeaveTypeId]
  )

  useEffect(() => {
    if (!isOpen) return

    let active = true

    void getEmployeeLeaveBalancesAction({
      companyId,
      employeeId: record.employee.id,
      attendanceDate: attendanceDateValue,
      dtrId: record.id.startsWith("draft-") ? undefined : record.id,
    }).then((result) => {
      if (!active) return

      if (!result.ok) {
        setLeaveLookupState({
          key: leaveLookupKey,
          year: null,
          leaveOptions: [],
          error: result.error,
        })
        return
      }

      setLeaveLookupState({
        key: leaveLookupKey,
        year: result.data.year,
        leaveOptions: result.data.leaveOptions,
        error: null,
      })
      setSelectedLeaveTypeId((current) => {
        if (current && result.data.leaveOptions.some((item) => item.leaveTypeId === current)) {
          return current
        }

        const activeManualLeaveTypeId = result.data.activeManualLeave?.leaveTypeId
        if (activeManualLeaveTypeId && result.data.leaveOptions.some((item) => item.leaveTypeId === activeManualLeaveTypeId)) {
          return activeManualLeaveTypeId
        }

        return result.data.leaveOptions[0]?.leaveTypeId ?? ""
      })
    })

    return () => {
      active = false
    }
  }, [attendanceDateValue, companyId, isOpen, leaveLookupKey, record.employee.id, record.id])

  const handleAutofill = async () => {
    if (!record || !pickedDate) return

    setLoading(true)
    const result = await getEmployeeScheduleAction({
      companyId,
      employeeId: record.employee.id,
      attendanceDate: format(pickedDate, "yyyy-MM-dd"),
    })
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setTimeIn(result.data.timeIn)
    setTimeOut(result.data.timeOut)
    setRemarks(`Auto-filled from ${result.data.name} schedule`)
    toast.success("Timings populated from schedule")
  }

  const handleSubmit = async () => {
    if (!record) return

    if (status === AttendanceStatus.ON_LEAVE) {
      if (isLeaveOptionsLoading) {
        toast.error("Leave balances are still loading. Please wait a moment.")
        return
      }

      if (!selectedLeaveTypeId) {
        toast.error("Please select a leave type for ON_LEAVE status.")
        return
      }

      if (selectedLeaveOption && selectedLeaveOption.availableBalance < requiredLeaveDays) {
        toast.error(
          `Insufficient balance for ${selectedLeaveOption.name}. Available: ${formatLeaveDays(selectedLeaveOption.availableBalance)} day(s).`
        )
        return
      }
    }

    setLoading(true)
    const result = await updateDtrRecordAction({
      companyId,
      dtrId: record.id.startsWith("draft-") ? undefined : record.id,
      employeeId: record.employee.id,
      attendanceDate: attendanceDateValue,
      attendanceStatus: status,
      leaveTypeId: status === AttendanceStatus.ON_LEAVE ? selectedLeaveTypeId : undefined,
      dayFraction,
      actualTimeIn: timeIn,
      actualTimeOut: timeOut,
      remarks,
    })
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(result.message)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className="flex h-full w-full flex-col overflow-hidden bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 bg-muted/5 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1 bg-primary" />
            <div>
              <SheetTitle className="text-lg">Modify Record</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground sm:text-sm">
                Adjust time logs for {record.employee.firstName} {record.employee.lastName}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="space-y-1 border border-primary/10 bg-primary/[0.02] p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-primary sm:text-sm">
              <IconClockHour4 className="h-3 w-3" /> Record Context
            </p>
            <p className="text-xs text-foreground sm:text-sm">
              Date: {format(new Date(record.attendanceDate), "PPPP")}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofill}
            disabled={loading}
            className="h-8 w-full border-primary/30 text-xs text-primary hover:bg-primary/5 sm:h-9 sm:text-sm"
          >
            <IconCalendarEvent className="mr-2 h-3.5 w-3.5" />
            Autofill from Work Schedule
          </Button>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground sm:text-sm">Attendance Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between text-xs sm:h-10 sm:text-sm">
                  <span>{pickedDate ? format(pickedDate, "yyyy-MM-dd") : "Set date"}</span>
                  <IconCalendarEvent className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                <Calendar
                  mode="single"
                  selected={pickedDate}
                  onSelect={(date) => setPickedDate(date)}
                  className="rounded-md"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground sm:text-sm">Attendance Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
                <SelectTrigger className="h-9 w-full sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground sm:text-sm">Day Fraction</label>
              <Select value={dayFraction} onValueChange={(value) => setDayFraction(value as "FULL" | "HALF")}>
                <SelectTrigger className="h-9 w-full sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_FRACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>

          {status === AttendanceStatus.ON_LEAVE ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground sm:text-sm">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={selectedLeaveTypeId}
                    onValueChange={setSelectedLeaveTypeId}
                    disabled={isLeaveOptionsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={isLeaveOptionsLoading ? "Loading leave balances..." : "Select leave type"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveOptions.map((option) => (
                        <SelectItem key={option.leaveTypeId} value={option.leaveTypeId}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground sm:text-sm">Leave Balance</label>
                  <Input
                    readOnly
                    value={leaveBalanceLabel(selectedLeaveOption)}
                    className="w-full"
                  />
                </div>
              </div>
              {isLeaveOptionsLoading ? (
                <p className="text-xs text-muted-foreground">Loading leave balances...</p>
              ) : null}
              {!isLeaveOptionsLoading && !leaveOptionsError && leaveOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No leave balances found for {leaveYear ?? "the selected"} year.
                </p>
              ) : null}
              {leaveOptionsError ? (
                <p className="text-xs text-destructive">{leaveOptionsError}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground sm:text-sm">Actual Clock-In</label>
              <Input
                type="time"
                value={timeIn}
                onChange={(event) => setTimeIn(event.target.value)}
                className="h-9 sm:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground sm:text-sm">Actual Clock-Out</label>
              <Input
                type="time"
                value={timeOut}
                onChange={(event) => setTimeOut(event.target.value)}
                className="h-9 sm:h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground sm:text-sm">Adjustment Justification</label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="min-h-[88px] resize-none sm:min-h-[96px]"
              placeholder="Enter reason for manual override..."
            />
          </div>

          <div className="space-y-2 border-t border-border/40 pt-3">
            <Button
              type="button"
              disabled={loading || (status === AttendanceStatus.ON_LEAVE && isLeaveOptionsLoading)}
              onClick={handleSubmit}
              className="h-9 w-full gap-2 sm:h-10"
            >
              {loading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 w-full sm:h-10"
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-50/40 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/10">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs leading-tight text-muted-foreground sm:text-sm">
              Manual adjustments are logged for auditing and will bypass biometric validation.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
