"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconCalendarEvent, IconCheck, IconInfoCircle, IconLock, IconRefresh, IconSettings } from "@tabler/icons-react"
import { toast } from "sonner"

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { archivePayrollYearAction } from "@/modules/settings/payroll/actions/archive-payroll-year-action"
import { savePayrollPeriodRowsAction } from "@/modules/settings/payroll/actions/save-payroll-period-rows-action"
import { updatePayrollPoliciesAction } from "@/modules/settings/payroll/actions/update-payroll-policies-action"
import {
  PAY_FREQUENCY_OPTIONS,
  STATUTORY_DEDUCTION_TIMING_OPTIONS,
  type PayrollPoliciesInput,
} from "@/modules/settings/payroll/schemas/payroll-policies-schema"

type PayrollPoliciesPageProps = {
  companyName: string
  initialData: PayrollPoliciesInput
  availableYears: number[]
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const statutoryTimingLabel: Record<(typeof STATUTORY_DEDUCTION_TIMING_OPTIONS)[number], string> = {
  FIRST_HALF: "First Half",
  SECOND_HALF: "Second Half",
  EVERY_PERIOD: "Every Period",
  DISABLED: "Disabled",
}

const formatDisplayDate = (value: string): string => {
  if (!value) return ""
  const parsed = parsePhDateInputToPhDate(value)
  if (!parsed) return ""

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const computeWorkingDays = (start: string, end: string): number | undefined => {
  if (!start || !end) {
    return undefined
  }

  const startDate = parsePhDateInputToPhDate(start)
  const endDate = parsePhDateInputToPhDate(end)

  if (!startDate || !endDate) {
    return undefined
  }

  if (endDate.getTime() < startDate.getTime()) {
    return undefined
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay)
  return diff + 1
}

export function PayrollPoliciesPage({ companyName, initialData, availableYears }: PayrollPoliciesPageProps) {
  const router = useRouter()
  const [form, setForm] = useState<PayrollPoliciesInput>(initialData)
  const [isGeneratingYear, startGenerateYearTransition] = useTransition()
  const [isArchivingYear, startArchiveYearTransition] = useTransition()
  const [isSavingPattern, setIsSavingPattern] = useState(false)
  const [isSavingRows, setIsSavingRows] = useState(false)
  const yearValue = form.periodYear

  const isTopControlsBusy = isGeneratingYear || isArchivingYear || isSavingPattern
  const isRowsControlsBusy = isGeneratingYear || isArchivingYear || isSavingRows

  useEffect(() => {
    setForm(initialData)
  }, [initialData])

  const canGenerateYear = !availableYears.includes(yearValue)
  const isYearFullyLocked = form.periodRows.length > 0 && form.periodRows.every((row) => row.statusCode === "LOCKED")

  const updateField = <K extends keyof PayrollPoliciesInput>(key: K, value: PayrollPoliciesInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const updateRowField = <K extends keyof PayrollPoliciesInput["periodRows"][number]>(
    index: number,
    key: K,
    value: PayrollPoliciesInput["periodRows"][number][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      periodRows: previous.periodRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: value,
              workingDays:
                key === "cutoffStartDate" || key === "cutoffEndDate"
                  ? computeWorkingDays(
                      key === "cutoffStartDate" ? (value as string) : row.cutoffStartDate,
                      key === "cutoffEndDate" ? (value as string) : row.cutoffEndDate
                    )
                  : row.workingDays,
            }
          : row
      ),
    }))
  }

  const handleReset = () => {
    setForm(initialData)
    toast.info("Payroll policy form reset.")
  }

  const handleGenerateYear = () => {
    startGenerateYearTransition(async () => {
      const result = await updatePayrollPoliciesAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(`Pay periods generated for ${form.periodYear}.`)
      router.refresh()
    })
  }

  const handleSave = () => {
    setIsSavingPattern(true)
    void (async () => {
      try {
        const result = await updatePayrollPoliciesAction(form)

        if (!result.ok) {
          toast.error(result.error)
          return
        }

        toast.success(result.message)
        router.refresh()
      } finally {
        setIsSavingPattern(false)
      }
    })()
  }

  const handleArchiveYear = () => {
    const patternId = form.patternId

    if (!patternId) {
      toast.error("Save payroll policies first before archiving a year.")
      return
    }

    startArchiveYearTransition(async () => {
      const result = await archivePayrollYearAction({
        companyId: form.companyId,
        patternId,
        year: yearValue,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setForm((previous) => ({
        ...previous,
        periodRows: previous.periodRows.map((row) => ({
          ...row,
          statusCode: "LOCKED",
        })),
      }))

      toast.success(result.message)
      router.refresh()
    })
  }

  const handleSaveRows = () => {
    const patternId = form.patternId

    if (!patternId) {
      toast.error("Save payroll pattern first before saving period rows.")
      return
    }

    setIsSavingRows(true)
    void (async () => {
      try {
        const result = await savePayrollPeriodRowsAction({
          companyId: form.companyId,
          patternId,
          year: yearValue,
          periodRows: form.periodRows,
        })

        if (!result.ok) {
          toast.error(result.error)
          return
        }

        toast.success(result.message)
      } finally {
        setIsSavingRows(false)
      }
    })()
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconCalendarEvent className="size-5" /> {companyName} Payroll Policies</h1>
            <p className="text-sm text-muted-foreground">One policy form with monthly pay-period rows for first and second half cutoffs.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(yearValue)} onValueChange={(value) => {
              if (value === "__new__") {
                const nextYear = (availableYears.at(-1) ?? yearValue) + 1
                const search = new URLSearchParams(window.location.search)
                search.set("year", String(nextYear))
                window.location.search = search.toString()
                return
              }

              const nextYear = Number(value)
              if (Number.isNaN(nextYear)) return

              const search = new URLSearchParams(window.location.search)
              search.set("year", String(nextYear))
              window.location.search = search.toString()
            }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
                {!availableYears.includes(yearValue) ? (
                  <SelectItem value={String(yearValue)}>{yearValue}</SelectItem>
                ) : null}
                <SelectItem value="__new__">+ New Year</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isTopControlsBusy}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={handleGenerateYear} disabled={isTopControlsBusy || !canGenerateYear}>
              <IconCalendarEvent className="size-4" />
              {isGeneratingYear ? "Generating..." : "Generate Year"}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isTopControlsBusy}>
              <IconCheck className="size-4" />
              {isSavingPattern ? "Saving..." : "Save Pattern"}
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 py-6">
      <section className="border-y border-border/60 px-4 py-4 sm:px-6">
        <div className="mb-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconSettings className="size-4" /> Pattern Identity</h2>
          <p className="text-sm text-muted-foreground">Define the main payroll policy profile for this company.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Pattern Code" required>
            <Input value={form.code} onChange={(event) => updateField("code", event.target.value)} />
          </Field>
          <Field label="Pattern Name" required>
            <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </Field>
          <Field label="Pay Frequency" required>
            <Select
              value={form.payFrequencyCode}
              onValueChange={(value) => updateField("payFrequencyCode", value as (typeof PAY_FREQUENCY_OPTIONS)[number])}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAY_FREQUENCY_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Periods Per Year" required>
            <Input type="number" value={form.periodsPerYear} onChange={(event) => updateField("periodsPerYear", Number(event.target.value))} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
              <p className="text-xs font-medium text-foreground">Statutory Deduction Schedule</p>
              <p className="text-[11px] text-muted-foreground">Controls when each statutory deduction is applied within the pay cycle.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="SSS" required>
                  <Select
                    value={form.statutoryDeductionSchedule.sss}
                    onValueChange={(value) =>
                      updateField("statutoryDeductionSchedule", {
                        ...form.statutoryDeductionSchedule,
                        sss: value as PayrollPoliciesInput["statutoryDeductionSchedule"]["sss"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUTORY_DEDUCTION_TIMING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>{statutoryTimingLabel[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="PhilHealth" required>
                  <Select
                    value={form.statutoryDeductionSchedule.philHealth}
                    onValueChange={(value) =>
                      updateField("statutoryDeductionSchedule", {
                        ...form.statutoryDeductionSchedule,
                        philHealth: value as PayrollPoliciesInput["statutoryDeductionSchedule"]["philHealth"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUTORY_DEDUCTION_TIMING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>{statutoryTimingLabel[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pag-IBIG" required>
                  <Select
                    value={form.statutoryDeductionSchedule.pagIbig}
                    onValueChange={(value) =>
                      updateField("statutoryDeductionSchedule", {
                        ...form.statutoryDeductionSchedule,
                        pagIbig: value as PayrollPoliciesInput["statutoryDeductionSchedule"]["pagIbig"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUTORY_DEDUCTION_TIMING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>{statutoryTimingLabel[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Withholding Tax" required>
                  <Select
                    value={form.statutoryDeductionSchedule.withholdingTax}
                    onValueChange={(value) =>
                      updateField("statutoryDeductionSchedule", {
                        ...form.statutoryDeductionSchedule,
                        withholdingTax: value as PayrollPoliciesInput["statutoryDeductionSchedule"]["withholdingTax"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUTORY_DEDUCTION_TIMING_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>{statutoryTimingLabel[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>
          <Field label="Payment Day Offset" required>
            <Input type="number" value={form.paymentDayOffset} onChange={(event) => updateField("paymentDayOffset", Number(event.target.value))} />
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
                  selected={form.effectiveFrom ? (parsePhDateInputToPhDate(form.effectiveFrom) ?? undefined) : undefined}
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
                  selected={form.effectiveTo ? (parsePhDateInputToPhDate(form.effectiveTo) ?? undefined) : undefined}
                  onSelect={(date) => updateField("effectiveTo", toPhDateInputValue(date) || undefined)}
                />
              </PopoverContent>
            </Popover>
          </Field>
          <Field label="Policy Active">
            <div className="flex h-7 items-center justify-between rounded-md border border-border/70 bg-background px-2">
              <span className="text-[11px] text-muted-foreground">Enable this policy</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => updateField("isActive", checked)} />
            </div>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Description">
              <Textarea className="h-16" value={form.description ?? ""} onChange={(event) => updateField("description", event.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <PeriodTableRows
        rows={form.periodRows}
        onChange={updateRowField}
        isYearLocked={isYearFullyLocked}
        selectedYear={yearValue}
        canArchiveYear={Boolean(form.patternId) && !isYearFullyLocked}
        isBusy={isRowsControlsBusy}
        isArchivingYear={isArchivingYear}
        isSavingRows={isSavingRows}
        onArchiveYear={handleArchiveYear}
        onSaveRows={handleSaveRows}
      />
      </div>
    </main>
  )
}

function PeriodTableRows({
  rows,
  onChange,
  isYearLocked,
  selectedYear,
  canArchiveYear,
  isBusy,
  isArchivingYear,
  isSavingRows,
  onArchiveYear,
  onSaveRows,
}: {
  rows: PayrollPoliciesInput["periodRows"]
  onChange: <K extends keyof PayrollPoliciesInput["periodRows"][number]>(
    index: number,
    key: K,
    value: PayrollPoliciesInput["periodRows"][number][K]
  ) => void
  isYearLocked: boolean
  selectedYear: number
  canArchiveYear: boolean
  isBusy: boolean
  isArchivingYear: boolean
  isSavingRows: boolean
  onArchiveYear: () => void
  onSaveRows: () => void
}) {
  return (
    <section className="border-y border-border/60 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconCalendarEvent className="size-4" /> {`Pay Period Rows (${selectedYear})`}</p>
            <p className="text-sm text-muted-foreground">
              Define per-period cutoff and payment dates. {rows.length} rows loaded.
              {isYearLocked ? " This year is archived and row editing is disabled." : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onArchiveYear} disabled={isBusy || !canArchiveYear}>
              <IconLock className="size-4" />
              {isYearLocked ? "Year Locked" : isArchivingYear ? "Archiving..." : "Archive Year"}
            </Button>
            <Button type="button" onClick={onSaveRows} disabled={isBusy || isYearLocked}>
              <IconCheck className="size-4" />
              {isSavingRows ? "Saving..." : "Save Period Rows"}
            </Button>
          </div>
      </div>
      <div className="mt-3">
        <div className="overflow-x-auto border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {[
                  "#",
                  "Year",
                  "Half",
                  "Cutoff Start",
                  "Cutoff End",
                  "Payment Date",
                  "Working Days",
                  "Status",
                ].map((header) => (
                  <th key={header} className="px-3 py-2 text-left font-medium text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <PeriodEditableRow
                  key={`${row.year}-${row.periodNumber}`}
                  index={index}
                  row={row}
                  onChange={onChange}
                  disabled={isYearLocked}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function PeriodEditableRow({
  index,
  row,
  onChange,
  disabled,
}: {
  index: number
  row: PayrollPoliciesInput["periodRows"][number]
  onChange: <K extends keyof PayrollPoliciesInput["periodRows"][number]>(
    index: number,
    key: K,
    value: PayrollPoliciesInput["periodRows"][number][K]
  ) => void
  disabled: boolean
}) {
  return (
    <tr className="border-t border-border/50">
      <td className="px-3 py-2 text-foreground">{row.periodNumber}</td>
      <td className="px-3 py-2 text-foreground">{row.year}</td>
      <td className="px-3 py-2 text-foreground">{row.periodHalf}</td>
      <td className="px-3 py-2">
        <DateCell value={row.cutoffStartDate} onChange={(value) => onChange(index, "cutoffStartDate", value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <DateCell value={row.cutoffEndDate} onChange={(value) => onChange(index, "cutoffEndDate", value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <DateCell value={row.paymentDate} onChange={(value) => onChange(index, "paymentDate", value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <Input
            type="number"
            value={row.workingDays ?? ""}
            readOnly
            className="bg-muted/30 pr-7"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Working days help"
              >
                <IconInfoCircle className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Auto-calculated from cutoff dates
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
      <td className="px-3 py-2">
        <Select
          value={row.statusCode}
          onValueChange={(value) => onChange(index, "statusCode", value as PayrollPoliciesInput["periodRows"][number]["statusCode"])}
          disabled={disabled}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">OPEN</SelectItem>
            <SelectItem value="PROCESSING">PROCESSING</SelectItem>
            <SelectItem value="CLOSED">CLOSED</SelectItem>
            <SelectItem value="LOCKED">LOCKED</SelectItem>
          </SelectContent>
        </Select>
      </td>
    </tr>
  )
}

function DateCell({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const displayValue = value ? formatDisplayDate(value) : "Select date"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-7 w-full justify-between px-2 text-xs" disabled={disabled}>
          <span>{displayValue}</span>
          <IconCalendarEvent className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={value ? (parsePhDateInputToPhDate(value) ?? undefined) : undefined}
          onSelect={(date) => onChange(toPhDateInputValue(date))}
        />
      </PopoverContent>
    </Popover>
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
