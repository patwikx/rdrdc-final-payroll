"use client"

import Link from "next/link"
import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconArrowLeft,
  IconDownload,
  IconFileAnalytics,
  IconRefresh,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getPhMonthIndex, getPhYear } from "@/lib/ph-time"
import type { MonthlyBirWTaxReportRow } from "@/modules/reports/payroll/types/report-view-models"

type MonthOption = { value: number; label: string }

type MonthlyBirWTaxReportClientProps = {
  companyId: string
  companyName: string
  generatedAtLabel: string
  filters: {
    year: number
    month: number
    includeTrialRuns: boolean
  }
  options: {
    yearOptions: number[]
  }
  rows: MonthlyBirWTaxReportRow[]
  totalWithholdingTaxAmount: number
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const monthFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  timeZone: "Asia/Manila",
})

const monthOptions: MonthOption[] = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthFormatter.format(new Date(Date.UTC(2026, index, 1))),
}))

const toCurrencyLabel = (value: number): string => {
  return `PHP ${currencyFormatter.format(value)}`
}

const getCurrentMonthSelection = (): { year: number; month: number } => {
  const now = new Date()
  return {
    year: getPhYear(now),
    month: getPhMonthIndex(now) + 1,
  }
}

const resolveExportHref = (
  companyId: string,
  filters: {
    year: number
    month: number
    includeTrialRuns: boolean
  }
): string => {
  const params = new URLSearchParams()
  params.set("year", String(filters.year))
  params.set("month", String(filters.month))
  if (filters.includeTrialRuns) {
    params.set("includeTrialRuns", "true")
  }
  return `/${companyId}/reports/payroll/monthly-bir-wtax/export?${params.toString()}`
}

export function MonthlyBirWTaxReportClient({
  companyId,
  companyName,
  generatedAtLabel,
  filters,
  options,
  rows,
  totalWithholdingTaxAmount,
}: MonthlyBirWTaxReportClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const exportHref = resolveExportHref(companyId, filters)

  const updateRoute = (updates: {
    year?: number
    month?: number
    includeTrialRuns?: boolean
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextYear = updates.year ?? filters.year
    const nextMonth = updates.month ?? filters.month
    const nextIncludeTrialRuns = updates.includeTrialRuns ?? filters.includeTrialRuns

    nextParams.set("year", String(nextYear))
    nextParams.set("month", String(nextMonth))
    if (nextIncludeTrialRuns) {
      nextParams.set("includeTrialRuns", "true")
    } else {
      nextParams.delete("includeTrialRuns")
    }

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`)
    })
  }

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Monthly BIR WTAX Report</h1>
            <p className="text-xs text-muted-foreground">{companyName} • Generated: {generatedAtLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" type="button">
              <Link href={`/${companyId}/reports/payroll`}>
                <IconArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Payroll Reports
              </Link>
            </Button>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href={exportHref}>
                <IconDownload className="mr-1.5 h-4 w-4" />
                Export CSV
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border border-border/60 bg-background p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Year</p>
            <Select
              value={String(filters.year)}
              onValueChange={(value) => {
                updateRoute({
                  year: Number(value),
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {options.yearOptions.map((yearOption) => (
                  <SelectItem key={yearOption} value={String(yearOption)}>
                    {yearOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Month</p>
            <Select
              value={String(filters.month)}
              onValueChange={(value) => {
                updateRoute({
                  month: Number(value),
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run Selection</p>
            <label className="flex h-9 items-center justify-between rounded-md border border-input px-3 text-sm">
              Include Trial Runs
              <Switch
                checked={filters.includeTrialRuns}
                onCheckedChange={(checked) => {
                  updateRoute({
                    includeTrialRuns: checked,
                  })
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const current = getCurrentMonthSelection()
              updateRoute({
                year: current.year,
                month: current.month,
                includeTrialRuns: false,
              })
            }}
          >
            <IconRefresh className="mr-1.5 h-3.5 w-3.5" />
            Reset to Current Month
          </Button>
          {isPending ? <p className="text-xs text-muted-foreground">Loading report...</p> : null}
        </div>
      </section>

      <section className="border border-border/60 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <IconFileAnalytics className="h-4 w-4 text-primary" />
            Withholding Tax Totals by Employee
          </p>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {rows.length} employee{rows.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm font-semibold text-foreground">Total WTAX: {toCurrencyLabel(totalWithholdingTaxAmount)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Employee</th>
                <th className="border border-border px-2 py-1 text-left">Department</th>
                <th className="border border-border px-2 py-1 text-left">TIN</th>
                <th className="border border-border px-2 py-1 text-left">Runs</th>
                <th className="border border-border px-2 py-1 text-right">WTAX Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No withholding tax records found for the selected month.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-muted/20">
                    <td className="border border-border px-2 py-1">
                      <p className="font-medium text-foreground">{row.employeeName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                    </td>
                    <td className="border border-border px-2 py-1">{row.departmentName ?? "UNASSIGNED"}</td>
                    <td className="border border-border px-2 py-1">{row.tinNumberMasked ?? "-"}</td>
                    <td className="border border-border px-2 py-1">{row.runNumbers.join(" | ")}</td>
                    <td className="border border-border px-2 py-1 text-right font-medium">
                      {toCurrencyLabel(row.withholdingTaxAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
