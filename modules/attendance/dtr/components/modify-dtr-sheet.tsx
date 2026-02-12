"use client"

import { useState } from "react"
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
import { updateDtrRecordAction } from "@/modules/attendance/dtr/actions/update-dtr-record-action"
import { getEmployeeScheduleAction } from "@/modules/attendance/dtr/actions/get-employee-schedule-action"
import type { DtrLogItem } from "@/modules/attendance/dtr/types"
import { formatWallClockTime, isHalfDayRemarks } from "@/modules/attendance/dtr/utils/wall-clock"

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
  const [remarks, setRemarks] = useState(record.remarks ?? "")
  const [timeIn, setTimeIn] = useState(formatWallClockTime(record.actualTimeIn))
  const [timeOut, setTimeOut] = useState(formatWallClockTime(record.actualTimeOut))
  const [pickedDate, setPickedDate] = useState<Date | undefined>(new Date(record.attendanceDate))

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

    setLoading(true)
    const result = await updateDtrRecordAction({
      companyId,
      dtrId: record.id.startsWith("draft-") ? undefined : record.id,
      employeeId: record.employee.id,
      attendanceDate: format(pickedDate ?? new Date(record.attendanceDate), "yyyy-MM-dd"),
      attendanceStatus: status,
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
      <SheetContent className="w-full sm:max-w-md p-0 bg-background overflow-y-auto">
        <SheetHeader className="p-8 border-b border-border/60 bg-muted/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1 bg-primary" />
            <div>
              <SheetTitle className="text-xl">Modify Record</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Adjust time logs for {record.employee.firstName} {record.employee.lastName}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="p-8 pb-32 space-y-6">
          <div className="p-4 bg-primary/[0.02] border border-primary/10 space-y-1">
            <p className="text-sm text-primary flex items-center gap-2">
              <IconClockHour4 className="h-3 w-3" /> Record Context
            </p>
            <p className="text-sm text-foreground">
              Date: {format(new Date(record.attendanceDate), "PPPP")}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofill}
            disabled={loading}
            className="w-full border-primary/30 text-primary hover:bg-primary/5"
          >
            <IconCalendarEvent className="mr-2 h-3.5 w-3.5" />
            Autofill from Work Schedule
          </Button>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Attendance Status</label>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
              <SelectTrigger className="h-10">
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

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Attendance Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
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

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Day Fraction</label>
            <Select value={dayFraction} onValueChange={(value) => setDayFraction(value as "FULL" | "HALF")}>
              <SelectTrigger className="h-10">
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

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Actual Clock-In</label>
              <Input
                type="time"
                value={timeIn}
                onChange={(event) => setTimeIn(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Actual Clock-Out</label>
              <Input
                type="time"
                value={timeOut}
                onChange={(event) => setTimeOut(event.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Adjustment Justification</label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="min-h-[100px] resize-none"
              placeholder="Enter reason for manual override..."
            />
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <Button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full gap-2"
            >
              {loading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 bg-muted/30 border-t border-border/40 flex items-center gap-3">
          <IconAlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm text-muted-foreground leading-tight">
            Manual adjustments are logged for auditing and will bypass biometric validation.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
