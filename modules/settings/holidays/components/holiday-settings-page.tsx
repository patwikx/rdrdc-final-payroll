"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconEdit,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { deleteHolidayAction } from "@/modules/settings/holidays/actions/delete-holiday-action"
import { upsertHolidayAction } from "@/modules/settings/holidays/actions/upsert-holiday-action"
import {
  HOLIDAY_APPLICABILITY_OPTIONS,
  HOLIDAY_TYPE_OPTIONS,
  type HolidaySettingsInput,
} from "@/modules/settings/holidays/schemas/holiday-settings-schema"
import type { HolidaySettingsRow } from "@/modules/settings/holidays/utils/get-holidays-settings-view-model"

type HolidaySettingsPageProps = {
  companyId: string
  companyName: string
  selectedYear: number
  availableYears: number[]
  holidays: HolidaySettingsRow[]
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const holidayTypeLabels: Record<HolidaySettingsInput["holidayTypeCode"], string> = {
  REGULAR: "Regular",
  SPECIAL_NON_WORKING: "Special Non-Working",
  SPECIAL_WORKING: "Special Working",
  LOCAL: "Local",
  COMPANY: "Company",
  ONE_TIME: "One-Time",
}

const applicabilityLabels: Record<HolidaySettingsInput["applicability"], string> = {
  NATIONWIDE: "Nationwide",
  REGIONAL: "Regional",
  COMPANY: "Company",
}

const toHolidayDateDisplay = (value: string): string => {
  const parsed = parsePhDateInputToPhDate(value)
  if (!parsed) {
    return "Select date"
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const buildDefaultForm = (companyId: string, selectedYear: number): HolidaySettingsInput => ({
  companyId,
  holidayDate: `${String(selectedYear)}-01-01`,
  name: "",
  description: undefined,
  holidayTypeCode: "REGULAR",
  payMultiplier: 2,
  applicability: "NATIONWIDE",
  region: undefined,
  isActive: true,
})

const getEditDisabledReason = (row: HolidaySettingsRow): string | null => {
  if (row.isPast) {
    return "Passed holidays can no longer be edited."
  }

  return null
}

export function HolidaySettingsPage({
  companyId,
  companyName,
  selectedYear,
  availableYears,
  holidays,
}: HolidaySettingsPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [form, setForm] = useState<HolidaySettingsInput>(buildDefaultForm(companyId, selectedYear))
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setForm(buildDefaultForm(companyId, selectedYear))
  }, [companyId, selectedYear])

  const isEditing = Boolean(form.holidayId)
  const editingRow = useMemo(() => holidays.find((row) => row.id === form.holidayId) ?? null, [form.holidayId, holidays])
  const isEditingPastHoliday = Boolean(editingRow?.isPast)
  const selectedHolidayId = form.holidayId ?? null

  const updateField = <K extends keyof HolidaySettingsInput>(key: K, value: HolidaySettingsInput[K]) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const handleYearChange = (value: string) => {
    if (value === "__new__") {
      const nextYear = (availableYears.at(-1) ?? selectedYear) + 1
      const search = new URLSearchParams(window.location.search)
      search.set("year", String(nextYear))
      router.push(`${pathname}?${search.toString()}`)
      return
    }

    const nextYear = Number(value)
    if (Number.isNaN(nextYear)) {
      return
    }

    const search = new URLSearchParams(window.location.search)
    search.set("year", String(nextYear))
    router.push(`${pathname}?${search.toString()}`)
  }

  const handleResetForm = () => {
    setForm(buildDefaultForm(companyId, selectedYear))
    toast.info("Holiday form reset.")
  }

  const handleSave = () => {
    if (isEditingPastHoliday) {
      toast.error("Passed holidays can no longer be edited.")
      return
    }

    startTransition(async () => {
      const result = await upsertHolidayAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setForm(buildDefaultForm(companyId, selectedYear))
      router.refresh()
    })
  }

  const handleEdit = (row: HolidaySettingsRow) => {
    const disabledReason = getEditDisabledReason(row)
    if (disabledReason) {
      toast.error(disabledReason)
      return
    }

    setForm({
      companyId,
      holidayId: row.id,
      holidayDate: row.holidayDate,
      name: row.name,
      description: row.description ?? undefined,
      holidayTypeCode: row.holidayTypeCode,
      payMultiplier: row.payMultiplier,
      applicability: row.applicability,
      region: row.region ?? undefined,
      isActive: row.isActive,
    })
  }

  const handleDelete = (row: HolidaySettingsRow) => {
    const confirmed = window.confirm(`Delete holiday \"${row.name}\"?`)
    if (!confirmed) {
      return
    }

    startTransition(async () => {
      const result = await deleteHolidayAction({
        companyId,
        holidayId: row.id,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      if (form.holidayId === row.id) {
        setForm(buildDefaultForm(companyId, selectedYear))
      }
      router.refresh()
    })
  }

  const filteredHolidays = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return holidays.filter((holiday) => {
      const statusPasses =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && holiday.isActive) ||
        (statusFilter === "INACTIVE" && !holiday.isActive)

      if (!statusPasses) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return (
        holiday.name.toLowerCase().includes(normalizedQuery) ||
        holiday.holidayDate.includes(normalizedQuery) ||
        holidayTypeLabels[holiday.holidayTypeCode].toLowerCase().includes(normalizedQuery) ||
        applicabilityLabels[holiday.applicability].toLowerCase().includes(normalizedQuery)
      )
    })
  }, [holidays, searchQuery, statusFilter])

  const activeCount = holidays.filter((holiday) => holiday.isActive).length

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconCalendarEvent className="size-6 text-primary" />
                Holiday Calendar
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {companyName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Add and manage holiday entries for payroll and attendance computations by selected year.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border border-border/60 bg-background/90 p-2">
            <div className="w-[150px]">
              <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Badge variant="outline">{holidays.length} Holidays</Badge>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={handleResetForm} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset Form
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{isEditing ? "Edit Holiday" : "Add Holiday"}</h2>
              <p className="text-xs text-muted-foreground">
                {isEditing ? "Update existing holiday details." : "Create a new holiday entry for the selected year."}
              </p>
              {editingRow ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Editing: {editingRow.name} ({editingRow.holidayDateLabel})
                </p>
              ) : null}
            </div>
            {isEditing ? (
              <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={handleResetForm} disabled={isPending}>
                <IconPlus className="size-4" />
                New
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Holiday Date<Required /></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 w-full justify-start text-left font-normal">
                    <IconCalendarEvent className="mr-2 size-4" />
                    {toHolidayDateDisplay(form.holidayDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.holidayDate ? (parsePhDateInputToPhDate(form.holidayDate) ?? undefined) : undefined}
                    onSelect={(date) => {
                      updateField("holidayDate", toPhDateInputValue(date))
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">Holiday Name<Required /></Label>
              <Input
                id="holiday-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Independence Day"
                maxLength={120}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Holiday Type<Required /></Label>
                <Select
                  value={form.holidayTypeCode}
                  onValueChange={(value) => updateField("holidayTypeCode", value as HolidaySettingsInput["holidayTypeCode"])}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLIDAY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {holidayTypeLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-pay-multiplier">Pay Multiplier<Required /></Label>
                <Input
                  id="holiday-pay-multiplier"
                  type="number"
                  min={0.01}
                  max={4}
                  step="0.01"
                  value={String(form.payMultiplier)}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    if (!Number.isFinite(nextValue)) {
                      return
                    }

                    updateField("payMultiplier", nextValue)
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Applicability<Required /></Label>
                <Select
                  value={form.applicability}
                  onValueChange={(value) => {
                    const nextValue = value as HolidaySettingsInput["applicability"]
                    setForm((previous) => ({
                      ...previous,
                      applicability: nextValue,
                      region: nextValue === "REGIONAL" ? previous.region : undefined,
                    }))
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select applicability" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLIDAY_APPLICABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {applicabilityLabels[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-region">
                  Region
                  {form.applicability === "REGIONAL" ? <Required /> : null}
                </Label>
                <Input
                  id="holiday-region"
                  value={form.region ?? ""}
                  onChange={(event) => updateField("region", event.target.value || undefined)}
                  placeholder={form.applicability === "REGIONAL" ? "e.g. NCR" : "Not required"}
                  disabled={form.applicability !== "REGIONAL"}
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="holiday-description">Description</Label>
              <Textarea
                id="holiday-description"
                value={form.description ?? ""}
                onChange={(event) => updateField("description", event.target.value || undefined)}
                placeholder="Optional note for payroll/audit context"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border/60 px-3 py-2">
              <div>
                <Label htmlFor="holiday-is-active" className="text-sm">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">Only active holidays apply in payroll computations.</p>
              </div>
              <Switch id="holiday-is-active" checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", checked)} />
            </div>

            <Button type="button" className="h-9 w-full" onClick={handleSave} disabled={isPending || isEditingPastHoliday}>
              <IconCheck className="size-4" />
              {isPending ? "Saving..." : isEditing ? "Update Holiday" : "Save Holiday"}
            </Button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="overflow-hidden border border-border/60 bg-background">
            <div className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
              <div className="bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold text-foreground">{holidays.length}</p>
              </div>
              <div className="bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-lg font-semibold text-foreground">{activeCount}</p>
              </div>
              <div className="bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Passed</p>
                <p className="text-lg font-semibold text-foreground">{holidays.filter((holiday) => holiday.isPast).length}</p>
              </div>
              <div className="bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">Upcoming</p>
                <p className="text-lg font-semibold text-foreground">{holidays.filter((holiday) => !holiday.isPast).length}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden border border-border/60 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Holidays for {selectedYear}</h2>
                <p className="text-xs text-muted-foreground">
                  Click a holiday row to load it in the form. Passed holidays are read-only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-8 w-[220px] pl-8"
                    placeholder="Search holiday"
                  />
                </div>

                <div className="w-[120px]">
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <SelectTrigger className="h-8 w-full">
                      <IconFilter className="size-3.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[170px]">Type</TableHead>
                    <TableHead className="w-[120px]">Multiplier</TableHead>
                    <TableHead className="w-[140px]">Applicability</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHolidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                        No holidays found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHolidays.map((holiday) => (
                      <TableRow
                        key={holiday.id}
                        className={`cursor-pointer ${selectedHolidayId === holiday.id ? "bg-primary/10" : ""}`}
                        aria-selected={selectedHolidayId === holiday.id}
                        onClick={() => {
                          const disabledReason = getEditDisabledReason(holiday)
                          if (disabledReason) {
                            toast.error(disabledReason)
                            return
                          }

                          handleEdit(holiday)
                        }}
                      >
                        <TableCell className="text-xs text-foreground">{holiday.holidayDateLabel}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                            {holiday.description ? <p className="text-xs text-muted-foreground">{holiday.description}</p> : null}
                            {holiday.region ? <p className="text-xs text-muted-foreground">Region: {holiday.region}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{holidayTypeLabels[holiday.holidayTypeCode]}</TableCell>
                        <TableCell className="text-xs">{holiday.payMultiplier.toFixed(2)}x</TableCell>
                        <TableCell className="text-xs">{applicabilityLabels[holiday.applicability]}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant={holiday.isActive ? "default" : "secondary"}>
                              {holiday.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {holiday.isPast ? <Badge variant="outline">Passed</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEdit(holiday)
                              }}
                              disabled={isPending}
                              title={getEditDisabledReason(holiday) ?? "Edit holiday"}
                            >
                              <IconEdit className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDelete(holiday)
                              }}
                              disabled={isPending}
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
