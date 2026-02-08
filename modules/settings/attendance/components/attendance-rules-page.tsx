"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { IconCalendarEvent, IconCheck, IconRefresh, IconTrash, IconTimelineEvent } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { deleteWorkScheduleAction } from "@/modules/settings/attendance/actions/delete-work-schedule-action"
import { updateAttendanceRulesAction } from "@/modules/settings/attendance/actions/update-attendance-rules-action"
import {
  ATTENDANCE_SCHEDULE_TYPE_OPTIONS,
  WORK_SCHEDULE_DAY_OPTIONS,
  type AttendanceRulesInput,
} from "@/modules/settings/attendance/schemas/attendance-rules-schema"

type AttendanceRulesPageProps = {
  companyName: string
  initialData: AttendanceRulesInput
  schedules: Array<{
    id: string
    code: string
    name: string
    scheduleTypeCode: AttendanceRulesInput["scheduleTypeCode"]
    workStartTime: string
    workEndTime: string
    isActive: boolean
  }>
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const formatDisplayDate = (value: string): string => {
  if (!value) return ""
  const parsed = new Date(`${value}T00:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return ""

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const toPhDateInputValue = (date: Date | undefined): string => {
  if (!date) return ""

  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })

  return formatter.format(date)
}

const getDefaultWorkingTimes = (rows: AttendanceRulesInput["daySchedules"]) => {
  const firstConfigured = rows.find((row) => row.isWorkingDay && row.timeIn && row.timeOut)
  return {
    timeIn: firstConfigured?.timeIn ?? "08:00",
    timeOut: firstConfigured?.timeOut ?? "17:00",
  }
}

export function AttendanceRulesPage({ companyName, initialData, schedules }: AttendanceRulesPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [form, setForm] = useState<AttendanceRulesInput>(initialData)
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  useEffect(() => {
    setForm(initialData)
  }, [initialData])

  const updateField = <K extends keyof AttendanceRulesInput>(key: K, value: AttendanceRulesInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const updateDayScheduleRow = <K extends keyof AttendanceRulesInput["daySchedules"][number]>(
    dayOfWeek: AttendanceRulesInput["daySchedules"][number]["dayOfWeek"],
    key: K,
    value: AttendanceRulesInput["daySchedules"][number][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      daySchedules: previous.daySchedules.map((row) => {
        if (row.dayOfWeek !== dayOfWeek) {
          return row
        }

        if (key === "isWorkingDay") {
          const isWorkingDay = value as boolean
          const defaults = getDefaultWorkingTimes(previous.daySchedules)
          return {
            ...row,
            isWorkingDay,
            timeIn: isWorkingDay ? row.timeIn ?? defaults.timeIn : undefined,
            timeOut: isWorkingDay ? row.timeOut ?? defaults.timeOut : undefined,
          }
        }

        return {
          ...row,
          [key]: value,
        }
      }),
    }))
  }

  const handleReset = () => {
    setForm(initialData)
    toast.info("Work schedule form reset.")
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateAttendanceRulesAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const handleOpenSchedule = (scheduleId: string) => {
    const search = new URLSearchParams(window.location.search)
    search.set("scheduleId", scheduleId)
    router.push(`${pathname}?${search.toString()}`)
  }

  const clearSelectedSchedule = () => {
    const search = new URLSearchParams(window.location.search)
    search.delete("scheduleId")
    const query = search.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const handleNewSchedule = () => {
    clearSelectedSchedule()
  }

  const handleDeleteSchedule = (scheduleId: string) => {
    startTransition(async () => {
      const result = await deleteWorkScheduleAction({
        companyId: form.companyId,
        workScheduleId: scheduleId,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)

      const search = new URLSearchParams(window.location.search)
      const selected = search.get("scheduleId")
      if (selected === scheduleId) {
        search.delete("scheduleId")
        const query = search.toString()
        router.push(query ? `${pathname}?${query}` : pathname)
        return
      }

      router.refresh()
    })
  }

  const filteredSchedules = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return schedules.filter((schedule) => {
      const passesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && schedule.isActive) ||
        (statusFilter === "INACTIVE" && !schedule.isActive)

      if (!passesStatus) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return (
        schedule.code.toLowerCase().includes(normalizedQuery) ||
        schedule.name.toLowerCase().includes(normalizedQuery) ||
        schedule.scheduleTypeCode.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [schedules, searchQuery, statusFilter])

  const layoutClass = "grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"
  const listCardClass = "rounded-xl border border-border/70 bg-card/80 shadow-sm"
  const editorWrapperClass = "flex flex-col gap-4"
  const editorCardClass = "rounded-xl border border-border/70 bg-card/80 shadow-sm"
  const identityGridClass = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
  const policyGridClass = "grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
  const matrixTableClass = "w-full text-xs"

  return (
    <main suppressHydrationWarning className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-xl border border-border/70 bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"><IconTimelineEvent className="size-5" /> {companyName} Work Schedules</h1>
            <p className="text-xs text-muted-foreground">Manage multiple schedules and configure per-day time in and time out rules.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              <IconCheck className="size-4" />
              {isPending ? "Saving..." : "Save Work Schedule"}
            </Button>
          </div>
        </div>
      </header>

      <section className={layoutClass}>
        <aside>
          <Card className={listCardClass}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Schedules</CardTitle>
                  <CardDescription>Pick a schedule from the sidebar list.</CardDescription>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleNewSchedule} disabled={isPending}>
                  + New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pr-1">
              <div className="mb-2 grid gap-2">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search schedules"
                  className="h-8"
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}>
                  <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="max-h-[60vh] lg:max-h-[calc(100vh-260px)]">
                <div className="space-y-2 pr-2">
                  {filteredSchedules.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">
                      No schedules found.
                    </p>
                  ) : (
                    filteredSchedules.map((schedule) => {
                      const isSelected = schedule.id === form.workScheduleId
                      return (
                        <div
                          key={schedule.id}
                          role="button"
                          tabIndex={isPending ? -1 : 0}
                          onClick={() => {
                            if (isPending) return
                            if (isSelected) {
                              clearSelectedSchedule()
                              return
                            }

                            handleOpenSchedule(schedule.id)
                          }}
                          onKeyDown={(event) => {
                            if (isPending) return
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              if (isSelected) {
                                clearSelectedSchedule()
                                return
                              }

                              handleOpenSchedule(schedule.id)
                            }
                          }}
                          className={`w-full rounded-md border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border/60 bg-background hover:bg-muted/40"
                          } ${isPending ? "pointer-events-none opacity-60" : ""}`}
                          aria-disabled={isPending}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isSelected}
                                onPointerDown={(event) => {
                                  event.stopPropagation()
                                }}
                                onClick={(event) => {
                                  event.stopPropagation()
                                }}
                                onCheckedChange={(checked) => {
                                  if (isPending) return
                                  if (checked) {
                                    handleOpenSchedule(schedule.id)
                                    return
                                  }

                                  clearSelectedSchedule()
                                }}
                              />
                              <p className="font-medium">{schedule.name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{schedule.isActive ? "Active" : "Inactive"}</span>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-6"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  handleDeleteSchedule(schedule.id)
                                }}
                                disabled={isPending}
                                aria-label={`Delete ${schedule.name}`}
                              >
                                <IconTrash className="size-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{schedule.code} • {schedule.scheduleTypeCode.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-muted-foreground">{schedule.workStartTime} - {schedule.workEndTime}</p>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <div className={editorWrapperClass}>
          <Card className={editorCardClass}>
        <CardHeader>
          <CardTitle>Schedule Identity</CardTitle>
          <CardDescription>Define the schedule profile metadata and company effectivity.</CardDescription>
        </CardHeader>
        <CardContent className={identityGridClass}>
          <Field label="Schedule Code" required>
            <Input value={form.code} onChange={(event) => updateField("code", event.target.value)} />
          </Field>
          <Field label="Schedule Name" required>
            <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </Field>
          <Field label="Schedule Type" required>
            <Select
              value={form.scheduleTypeCode}
              onValueChange={(value) =>
                updateField("scheduleTypeCode", value as (typeof ATTENDANCE_SCHEDULE_TYPE_OPTIONS)[number])
              }
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDANCE_SCHEDULE_TYPE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Schedule Active">
            <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3">
              <span className="text-[11px] text-muted-foreground">Enable this work schedule</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", checked)} />
            </div>
          </Field>
          <Field label="Effective From" required>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span>{form.effectiveFrom ? formatDisplayDate(form.effectiveFrom) : "Select date"}</span>
                  <IconCalendarEvent className="size-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar
                  mode="single"
                  selected={form.effectiveFrom ? new Date(`${form.effectiveFrom}T00:00:00+08:00`) : undefined}
                  onSelect={(date) => updateField("effectiveFrom", toPhDateInputValue(date))}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field label="Effective To">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span>{form.effectiveTo ? formatDisplayDate(form.effectiveTo) : "No end date"}</span>
                  <IconCalendarEvent className="size-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar
                  mode="single"
                  selected={form.effectiveTo ? new Date(`${form.effectiveTo}T00:00:00+08:00`) : undefined}
                  onSelect={(date) => updateField("effectiveTo", toPhDateInputValue(date) || undefined)}
                />
              </PopoverContent>
            </Popover>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Description">
              <Textarea
                className="h-16"
                value={form.description ?? ""}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className={editorCardClass}>
        <CardHeader>
          <CardTitle>Per-Day Time Matrix</CardTitle>
          <CardDescription>
            Configure each day directly. Global policy values are kept here for break, grace period, and required hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={policyGridClass}>
          <Field label="Break Start">
            <Input type="time" value={form.breakStartTime ?? ""} onChange={(event) => updateField("breakStartTime", event.target.value || undefined)} />
          </Field>
          <Field label="Break End">
            <Input type="time" value={form.breakEndTime ?? ""} onChange={(event) => updateField("breakEndTime", event.target.value || undefined)} />
          </Field>
          <Field label="Break Duration (mins)" required>
            <Input
              type="number"
              min={0}
              value={form.breakDurationMins}
              onChange={(event) => updateField("breakDurationMins", Number(event.target.value))}
            />
          </Field>
          <Field label="Grace Period (mins)" required>
            <Input
              type="number"
              min={0}
              value={form.gracePeriodMins}
              onChange={(event) => updateField("gracePeriodMins", Number(event.target.value))}
            />
          </Field>
          <Field label="Required Hours / Day" required>
            <Input
              type="number"
              min={1}
              step="0.5"
              value={form.requiredHoursPerDay}
              onChange={(event) => updateField("requiredHoursPerDay", Number(event.target.value))}
            />
          </Field>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className={matrixTableClass}>
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Day</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Working</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time In</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time Out</th>
                </tr>
              </thead>
              <tbody>
                {WORK_SCHEDULE_DAY_OPTIONS.map((day) => {
                  const row = form.daySchedules.find((item) => item.dayOfWeek === day)
                  if (!row) return null

                  return (
                    <tr key={day} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">{day}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={row.isWorkingDay}
                            onCheckedChange={(value) =>
                              updateDayScheduleRow(day, "isWorkingDay", Boolean(value))
                            }
                          />
                          <span className="text-muted-foreground">{row.isWorkingDay ? "Working" : "Rest"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="time"
                          value={row.timeIn ?? ""}
                          onChange={(event) => updateDayScheduleRow(day, "timeIn", event.target.value || undefined)}
                          disabled={!row.isWorkingDay}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="time"
                          value={row.timeOut ?? ""}
                          onChange={(event) => updateDayScheduleRow(day, "timeOut", event.target.value || undefined)}
                          disabled={!row.isWorkingDay}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}
