"use client"

import { Fragment, type ComponentType, useMemo, useState } from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendarEvent,
  IconChevronDown,
  IconChevronUp,
  IconFileAnalytics,
  IconFileText,
  IconHeartRateMonitor,
  IconPrinter,
  IconReceiptTax,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react"
import type { PayrollRunType } from "@prisma/client"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getPhYear, toPhDateOnlyUtc } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import {
  GovernmentRemittanceReports,
  type Dole13thMonthRow,
  type PagIbigContributionRow,
  type PhilHealthRemittanceRow,
  type SssRemittanceRow,
} from "@/modules/payroll/components/government-remittance-reports"

type PayrollStatutoryPageClientProps = {
  companyId: string
  companyName: string
  printedBy: string
  payrollRegisterRuns: Array<{
    runId: string
    runNumber: string
    runTypeCode: PayrollRunType
    isTrialRun: boolean
    periodLabel: string
    createdAtIso: string
  }>
  totals: {
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }
  rows: StatutoryMonthlyRow[]
  trialRows: StatutoryMonthlyRow[]
  birRows: StatutoryBirRow[]
  trialBirRows: StatutoryBirRow[]
  doleRows: StatutoryDoleRow[]
  trialDoleRows: StatutoryDoleRow[]
}

type StatutoryMonthlyRow = {
  payslipId: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  birthDate: string | null
  sssNumber: string | null
  philHealthPin: string | null
  pagIbigNumber: string | null
  tinNumber: string | null
  runNumber: string
  periodLabel: string
  cutoffEndDateIso: string
  grossPay: string
  sssEmployee: string
  sssEmployer: string
  philHealthEmployee: string
  philHealthEmployer: string
  pagIbigEmployee: string
  pagIbigEmployer: string
  withholdingTax: string
}

type StatutoryBirRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  tinNumber: string | null
  year: number
  sssEmployee: string
  philHealthEmployee: string
  pagIbigEmployee: string
  grossCompensation: string
  nonTaxableBenefits: string
  taxableCompensation: string
  withholdingTax: string
  annualTaxDue: string
  taxVariance: string
}

type StatutoryDoleRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  year: number
  annualBasicSalary: string
  thirteenthMonthPay: string
}

type ReportKey = "sss" | "philhealth" | "pagibig" | "dole13th" | "bir-alphalist" | "payroll-register"

const REPORT_OPTIONS: Array<{ key: ReportKey; label: string; frequency: string }> = [
  { key: "payroll-register", label: "Payroll Register", frequency: "Per Run" },
  { key: "sss", label: "SSS Monthly Remittance", frequency: "Monthly" },
  { key: "philhealth", label: "PhilHealth EPRS Remittance", frequency: "Monthly" },
  { key: "pagibig", label: "Pag-IBIG MCRF (Contributions)", frequency: "Monthly" },
  { key: "dole13th", label: "DOLE 13th Month Pay Report", frequency: "Annual" },
  { key: "bir-alphalist", label: "BIR Alphalist", frequency: "Annual" },
]

const reportIconByKey: Record<ReportKey, ComponentType<{ className?: string }>> = {
  sss: IconShieldCheck,
  philhealth: IconHeartRateMonitor,
  pagibig: IconBuilding,
  dole13th: IconCalendarEvent,
  "bir-alphalist": IconReceiptTax,
  "payroll-register": IconFileText,
}

const parseAmount = (value: string): number => Number(value.replace(/[^0-9.-]/g, "")) || 0
const numberFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const monthYearFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Manila",
})
const birthDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "2-digit",
  timeZone: "Asia/Manila",
})

const toPhMonthKey = (value: Date): string => {
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value ?? String(getPhYear())
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  return `${year}-${month}`
}

const extractNameParts = (fullName: string): { surname: string; firstName: string; middleName: string } => {
  const [surnamePart, firstPartRaw] = fullName.split(",")
  const firstTokens = (firstPartRaw ?? "").trim().split(/\s+/).filter(Boolean)

  return {
    surname: (surnamePart ?? "").trim(),
    firstName: firstTokens[0] ?? "",
    middleName: firstTokens.slice(1).join(" "),
  }
}

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const downloadCsv = (fileName: string, headers: string[], records: string[][]): void => {
  const lines = [headers.map(csvEscape).join(","), ...records.map((row) => row.map(csvEscape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const downloadCsvRows = (fileName: string, rows: string[][]): void => {
  const lines = rows.map((row) => row.map(csvEscape).join(","))
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function PayrollStatutoryPageClient({
  companyId,
  companyName,
  printedBy,
  payrollRegisterRuns,
  rows,
  trialRows,
  birRows,
  trialBirRows,
  doleRows,
  trialDoleRows,
}: PayrollStatutoryPageClientProps) {
  const [activeReport, setActiveReport] = useState<ReportKey>("philhealth")
  const [searchText, setSearchText] = useState("")
  const [expandedBirTraceKey, setExpandedBirTraceKey] = useState<string | null>(null)
  const [showTrialRuns, setShowTrialRuns] = useState(false)
  const [selectedRegisterRunId, setSelectedRegisterRunId] = useState("")

  const sourceRows = showTrialRuns ? trialRows : rows
  const sourceBirRows = showTrialRuns ? trialBirRows : birRows
  const sourceDoleRows = showTrialRuns ? trialDoleRows : doleRows

  const monthOptions = useMemo(() => {
    const yearSet = new Set<number>()
    for (const row of sourceRows) {
      const date = new Date(row.cutoffEndDateIso)
      if (Number.isNaN(date.getTime())) {
        continue
      }
      yearSet.add(date.getUTCFullYear())
    }

    yearSet.add(getPhYear())

    const sortedYears = Array.from(yearSet).sort((a, b) => a - b)
    const options: Array<{ key: string; date: Date; label: string }> = []

    for (const year of sortedYears) {
      for (let month = 0; month <= 11; month += 1) {
        const date = new Date(Date.UTC(year, month, 1))
        const key = `${year}-${String(month + 1).padStart(2, "0")}`
        options.push({
          key,
          date,
          label: date.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Manila",
          }),
        })
      }
    }

    return options
  }, [sourceRows])

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("")
  const currentMonthKey = useMemo(() => toPhMonthKey(new Date()), [])
  const resolvedMonthKey = monthOptions.some((option) => option.key === selectedMonthKey)
    ? selectedMonthKey
    : monthOptions.some((option) => option.key === currentMonthKey)
      ? currentMonthKey
      : (monthOptions[0]?.key ?? "")

  const filteredOptions = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) {
      return REPORT_OPTIONS
    }

    return REPORT_OPTIONS.filter((report) => report.label.toLowerCase().includes(normalized))
  }, [searchText])

  const resolvedReport = filteredOptions.find((option) => option.key === activeReport) ?? filteredOptions[0] ?? REPORT_OPTIONS[0]
  const filteredRegisterRuns = useMemo(() => {
    return payrollRegisterRuns.filter((run) =>
      showTrialRuns ? run.isTrialRun : !run.isTrialRun
    )
  }, [payrollRegisterRuns, showTrialRuns])
  const resolvedRegisterRunId = filteredRegisterRuns.some((row) => row.runId === selectedRegisterRunId)
    ? selectedRegisterRunId
    : (filteredRegisterRuns[0]?.runId ?? "")
  const selectedRegisterRun = filteredRegisterRuns.find((row) => row.runId === resolvedRegisterRunId) ?? null

  const selectedMonthDate = monthOptions.find((option) => option.key === resolvedMonthKey)?.date ?? toPhDateOnlyUtc()

  const scopedRows = useMemo(() => {
    if (!resolvedMonthKey) {
      return sourceRows
    }

    return sourceRows.filter((row) => row.cutoffEndDateIso.startsWith(resolvedMonthKey))
  }, [sourceRows, resolvedMonthKey])

  const philHealthRows = useMemo<PhilHealthRemittanceRow[]>(() => {
    const map = new Map<string, PhilHealthRemittanceRow>()

    for (const row of scopedRows) {
      const key = row.employeeId || row.employeeNumber || row.payslipId
      const pin = (row.philHealthPin ?? "").replace(/\D/g, "")
      const employeeShare = parseAmount(row.philHealthEmployee)
      const employerShare = parseAmount(row.philHealthEmployer)
      const existing = map.get(key)

      if (!existing) {
        map.set(key, {
          idNumber: row.employeeNumber,
          employeeName: row.employeeName,
          pin,
          employeeShare,
          employerShare,
        })
        continue
      }

      existing.employeeShare += employeeShare
      existing.employerShare += employerShare
      if (!existing.pin && pin) {
        existing.pin = pin
      }
    }

    return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [scopedRows])

  const sssRows = useMemo<SssRemittanceRow[]>(() => {
    const map = new Map<string, SssRemittanceRow>()

    for (const row of scopedRows) {
      const key = row.employeeId || row.employeeNumber || row.payslipId
      const sssNumber = row.sssNumber ?? ""
      const employeeShare = parseAmount(row.sssEmployee)
      const employerShare = parseAmount(row.sssEmployer)
      const existing = map.get(key)

      if (!existing) {
        map.set(key, {
          idNumber: row.employeeNumber,
          employeeName: row.employeeName,
          sssNumber,
          employeeShare,
          employerShare,
        })
        continue
      }

      existing.employeeShare += employeeShare
      existing.employerShare += employerShare
      if (!existing.sssNumber && sssNumber) {
        existing.sssNumber = sssNumber
      }
    }

    return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [scopedRows])

  const pagIbigRows = useMemo<PagIbigContributionRow[]>(() => {
    const map = new Map<string, PagIbigContributionRow>()

    for (const row of scopedRows) {
      const key = row.employeeId || row.employeeNumber || row.payslipId
      const nameParts = extractNameParts(row.employeeName)
      const parsedBirthDate = row.birthDate ? new Date(row.birthDate) : null
      const birthDate =
        parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
          ? parsedBirthDate
          : new Date("2000-01-01")
      const pagIbigNumber = row.pagIbigNumber ?? ""
      const employeeShare = parseAmount(row.pagIbigEmployee)
      const employerShare = parseAmount(row.pagIbigEmployer)
      const existing = map.get(key)

      if (!existing) {
        map.set(key, {
          employeeId: row.employeeNumber,
          surname: nameParts.surname,
          firstName: nameParts.firstName,
          middleName: nameParts.middleName,
          birthDate,
          pagIbigNumber,
          employeeShare,
          employerShare,
        })
        continue
      }

      existing.employeeShare += employeeShare
      existing.employerShare += employerShare
      if (!existing.pagIbigNumber && pagIbigNumber) {
        existing.pagIbigNumber = pagIbigNumber
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const surnameCompare = a.surname.localeCompare(b.surname)
      if (surnameCompare !== 0) {
        return surnameCompare
      }
      return a.firstName.localeCompare(b.firstName)
    })
  }, [scopedRows])

  const selectedYearPrefix = resolvedMonthKey ? resolvedMonthKey.slice(0, 4) : ""
  const selectedReportYear = selectedYearPrefix ? Number(selectedYearPrefix) : Number.NaN
  const resolvedReportYear = Number.isFinite(selectedReportYear) ? selectedReportYear : getPhYear()

  const filteredBirRows = useMemo(() => {
    if (!selectedYearPrefix) {
      return sourceBirRows
    }

    const year = Number(selectedYearPrefix)
    return sourceBirRows.filter((row) => row.year === year)
  }, [sourceBirRows, selectedYearPrefix])

  const filteredDoleRows = useMemo<Dole13thMonthRow[]>(() => {
    const targetYear = selectedYearPrefix ? Number(selectedYearPrefix) : undefined
    const scoped = targetYear ? sourceDoleRows.filter((row) => row.year === targetYear) : sourceDoleRows

    return scoped.map((row) => ({
      employeeId: row.employeeNumber,
      employeeName: row.employeeName,
      annualBasicSalary: parseAmount(row.annualBasicSalary),
      thirteenthMonthPay: parseAmount(row.thirteenthMonthPay),
    }))
  }, [sourceDoleRows, selectedYearPrefix])

  const exportCsvTemplate = (report: ReportKey) => {
    if (report === "philhealth") {
      const totals = philHealthRows.reduce(
        (acc, row) => {
          acc.ee += row.employeeShare
          acc.er += row.employerShare
          return acc
        },
        { ee: 0, er: 0 }
      )

      const monthLabel = monthYearFormatter.format(reportMonth)
      const reportRows: string[][] = [
        [companyName.toUpperCase()],
        ["PHILHEALTH REMMITTANCE"],
        [`FOR THE MONTH OF ${monthLabel.toUpperCase()}`],
        [],
        ["ID #", "EMPLOYEE'S NAME", "PIN", "EMPLOYEE SHARE", "EMPLOYER SHARE", "TOTALS"],
        ...philHealthRows.map((row) => {
          const rowTotal = row.employeeShare + row.employerShare
          return [
            row.idNumber,
            row.employeeName,
            row.pin,
            numberFormatter.format(row.employeeShare),
            numberFormatter.format(row.employerShare),
            numberFormatter.format(rowTotal),
          ]
        }),
        [
          "TOTAL",
          "",
          "",
          numberFormatter.format(totals.ee),
          numberFormatter.format(totals.er),
          numberFormatter.format(totals.ee + totals.er),
        ],
      ]

      downloadCsvRows("philhealth-remittance-report.csv", reportRows)
      toast.success("Generated styled PhilHealth CSV report.")
      return
    }

    if (report === "pagibig") {
      const totals = pagIbigRows.reduce(
        (acc, row) => {
          acc.ee += row.employeeShare
          acc.er += row.employerShare
          return acc
        },
        { ee: 0, er: 0 }
      )

      const monthLabel = monthYearFormatter.format(reportMonth)
      const reportRows: string[][] = [
        [companyName.toUpperCase()],
        ["MONTHLY PAG-IBIG CONTRIBUTION REPORT"],
        [`FOR THE MONTH OF ${monthLabel.toUpperCase()}`],
        [],
        [
          "EMPLOYEE ID",
          "SURNAME",
          "FIRST NAME",
          "MIDDLE NAME",
          "BIRTHDATE",
          "PAG-IBIG #",
          "PAG-IBIG EE",
          "PAG-IBIG ER",
          "TOTAL",
        ],
        ...pagIbigRows.map((row) => {
          const rowTotal = row.employeeShare + row.employerShare
          return [
            row.employeeId,
            row.surname.toUpperCase(),
            row.firstName.toUpperCase(),
            row.middleName.toUpperCase(),
            birthDateFormatter.format(row.birthDate),
            row.pagIbigNumber,
            numberFormatter.format(row.employeeShare),
            numberFormatter.format(row.employerShare),
            numberFormatter.format(rowTotal),
          ]
        }),
        [
          "PAGE TOTAL",
          "",
          "",
          "",
          "",
          `HEAD COUNT (${pagIbigRows.length})`,
          numberFormatter.format(totals.ee),
          numberFormatter.format(totals.er),
          numberFormatter.format(totals.ee + totals.er),
        ],
        [
          "GRAND TOTAL",
          "",
          "",
          "",
          "",
          "",
          numberFormatter.format(totals.ee),
          numberFormatter.format(totals.er),
          numberFormatter.format(totals.ee + totals.er),
        ],
      ]

      downloadCsvRows("pagibig-mcrf-contribution-report.csv", reportRows)
      toast.success("Generated styled Pag-IBIG CSV report.")
      return
    }

    if (report === "sss") {
      const totals = sssRows.reduce(
        (acc, row) => {
          acc.ee += row.employeeShare
          acc.er += row.employerShare
          return acc
        },
        { ee: 0, er: 0 }
      )

      const monthLabel = monthYearFormatter.format(reportMonth)
      const reportRows: string[][] = [
        [companyName.toUpperCase()],
        ["SSS MONTHLY REMITTANCE REPORT"],
        [`FOR THE MONTH OF ${monthLabel.toUpperCase()}`],
        [],
        ["ID #", "EMPLOYEE NAME", "SSS #", "EMPLOYEE SHARE", "EMPLOYER SHARE", "TOTALS"],
        ...sssRows.map((row) => {
          const rowTotal = row.employeeShare + row.employerShare
          return [
            row.idNumber,
            row.employeeName.toUpperCase(),
            row.sssNumber,
            numberFormatter.format(row.employeeShare),
            numberFormatter.format(row.employerShare),
            numberFormatter.format(rowTotal),
          ]
        }),
        [
          "TOTAL",
          "",
          "",
          numberFormatter.format(totals.ee),
          numberFormatter.format(totals.er),
          numberFormatter.format(totals.ee + totals.er),
        ],
      ]

      downloadCsvRows("sss-monthly-remittance-report.csv", reportRows)
      toast.success("Generated styled SSS monthly remittance CSV.")
      return
    }

    if (report === "dole13th") {
      const yearLabel = String(resolvedReportYear)
      const totals = filteredDoleRows.reduce(
        (acc, row) => {
          acc.annualBasicSalary += row.annualBasicSalary
          acc.thirteenthMonthPay += row.thirteenthMonthPay
          return acc
        },
        { annualBasicSalary: 0, thirteenthMonthPay: 0 }
      )

      const reportRows: string[][] = [
        [companyName.toUpperCase()],
        ["DOLE 13TH MONTH PAY REPORT"],
        [`FOR CALENDAR YEAR ${yearLabel}`],
        [],
        ["EMPLOYEE ID", "EMPLOYEE NAME", "ANNUAL BASIC SALARY", "13TH MONTH PAY"],
        ...filteredDoleRows.map((row) => [
          row.employeeId,
          row.employeeName.toUpperCase(),
          numberFormatter.format(row.annualBasicSalary),
          numberFormatter.format(row.thirteenthMonthPay),
        ]),
        ["TOTAL", "", numberFormatter.format(totals.annualBasicSalary), numberFormatter.format(totals.thirteenthMonthPay)],
      ]

      downloadCsvRows("dole-13th-month-pay-report.csv", reportRows)
      toast.success("Generated styled DOLE 13th month report CSV.")
      return
    }

    if (report === "bir-alphalist") {
      const yearLabel = String(resolvedReportYear)
      const reportRows: string[][] = [
        [companyName.toUpperCase()],
        ["BIR ANNUAL ALPHALIST"],
        [`FOR TAXABLE YEAR ${yearLabel}`],
        [],
        [
          "EMPLOYEE ID",
          "EMPLOYEE NAME",
          "TIN",
          "SSS EE",
          "PH EE",
          "PG EE",
          "GROSS COMPENSATION",
          "TAXABLE COMPENSATION",
          "WITHHOLDING TAX",
        ],
        ...filteredBirRows.map((row) => [
          row.employeeNumber,
          row.employeeName.toUpperCase(),
          row.tinNumber ?? "",
          row.sssEmployee,
          row.philHealthEmployee,
          row.pagIbigEmployee,
          row.grossCompensation,
          row.taxableCompensation,
          row.withholdingTax,
        ]),
      ]

      downloadCsvRows("bir-annual-alphalist.csv", reportRows)
      toast.success("Generated styled BIR annual alphalist CSV.")
      return
    }

    downloadCsv(
      "bir-alphalist-template.csv",
      ["TIN", "Employee Name", "Gross Compensation", "Withholding Tax", "Remarks"],
      scopedRows.map((row) => ["", row.employeeName, "", row.withholdingTax, ""])
    )
    toast.success("Generated BIR alphalist template.")
  }

  const reportMonth = selectedMonthDate

  return (
    <>
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 print:hidden sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payroll Operations</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconFileAnalytics className="size-6 text-primary" />
                Payroll Reports
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {companyName}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                {resolvedReport.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Scope: {resolvedReport.key === "dole13th" || resolvedReport.key === "bir-alphalist"
                ? `Calendar Year ${resolvedReportYear}`
                : resolvedReport.key === "payroll-register"
                  ? (selectedRegisterRun ? `Run ${selectedRegisterRun.runNumber}` : "No run selected")
                  : monthYearFormatter.format(reportMonth)} • Source: {resolvedReport.key === "payroll-register"
                ? (showTrialRuns ? "Trial runs" : "Regular runs")
                : showTrialRuns
                  ? "Trial runs (latest per pay period)"
                  : "Regular runs"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline" className="h-8 text-xs font-medium">
              <Link href={`/${companyId}/payroll/runs`}>
                <IconArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Payroll Runs
              </Link>
            </Button>
            {resolvedReport.key === "payroll-register" ? (
              <>
                <Button asChild className="h-8 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700" disabled={!selectedRegisterRun}>
                  <Link href={selectedRegisterRun ? `/${companyId}/payroll/runs/${selectedRegisterRun.runId}/report` : "#"}>
                    <IconFileText className="size-3.5" />
                    Open Report
                  </Link>
                </Button>
                <Button asChild className="h-8 bg-green-600 text-xs font-medium text-white hover:bg-green-700" disabled={!selectedRegisterRun}>
                  <Link href={selectedRegisterRun ? `/${companyId}/payroll/runs/${selectedRegisterRun.runId}/report/export` : "#"}>
                    <IconFileText className="size-3.5" />
                    Export CSV
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => exportCsvTemplate(resolvedReport.key)} className="h-8 bg-green-600 text-xs font-medium text-white hover:bg-green-700">
                  <IconFileText className="size-3.5" />
                  Export CSV
                </Button>
                <Button onClick={() => window.print()} className="h-8 bg-blue-600 text-xs font-medium text-white hover:bg-blue-700">
                  <IconPrinter className="size-3.5" />
                  Print Report
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-4 mb-4 grid overflow-hidden border border-border/60 lg:mx-6 lg:grid-cols-[320px_1fr] print:mx-0 print:mb-0 print:block print:border-0">
        <aside className="space-y-3 border-b border-border/60 bg-background/60 p-4 print:hidden lg:border-b-0 lg:border-r sm:p-6">
          <div className="space-y-2">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <IconReceiptTax className="size-4 text-primary" />
            Report Workspace
            </h2>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search report"
                className="h-9 pl-8"
              />
            </div>
            <Select value={resolvedMonthKey} onValueChange={setSelectedMonthKey}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between border border-border/60 px-3 py-2">
              <div>
                <p className="text-xs font-medium">Show Trial Runs</p>
                <p className="text-[11px] text-muted-foreground">Latest trial run per pay period</p>
              </div>
              <Switch checked={showTrialRuns} onCheckedChange={setShowTrialRuns} />
            </div>
          </div>

          <ScrollArea className="h-[460px] pr-1 lg:h-[calc(100vh-400px)]">
            <div className="space-y-2">
              {filteredOptions.map((report) => {
                const ReportIcon = reportIconByKey[report.key]
                return (
                  <button
                    key={report.key}
                    type="button"
                    onClick={() => setActiveReport(report.key)}
                    className={cn(
                      "w-full border-l-2 border-r border-y px-3 py-2 text-left text-xs transition-colors",
                    resolvedReport.key === report.key
                      ? "border-l-primary border-y-primary/40 border-r-primary/40 bg-primary/10 text-foreground"
                      : "border-l-transparent border-y-border/60 border-r-border/60 bg-background hover:bg-muted/40"
                  )}
                >
                  <p className="inline-flex items-center gap-1.5 font-medium">
                    <ReportIcon className="size-3.5" />
                    <span>{report.label}</span>
                  </p>
                    <p className="text-[11px] text-muted-foreground">{report.frequency}</p>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </aside>

          <section className="space-y-3 p-4 print:border-0 print:p-0 sm:p-6">
            <div className="border border-border/60 bg-background px-3 py-2.5 print:hidden">
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">{resolvedReport.label}</p>
                <p className="text-xs text-muted-foreground">{resolvedReport.frequency}</p>
                <p className="text-xs text-muted-foreground">
                  Source: {showTrialRuns ? "Trial runs (latest per pay period)" : "Regular runs"}
                </p>
              </div>
            </div>

            {resolvedReport.key === "philhealth" ? (
              <div id="statutory-print-root">
              <GovernmentRemittanceReports
                companyName={companyName}
                philHealthMonth={reportMonth}
                pagIbigMonth={reportMonth}
                printedAt={new Date()}
                printedBy={printedBy}
                philHealthRows={philHealthRows}
                pagIbigRows={[]}
                showPhilHealth
                showPagIbig={false}
              />
              </div>
            ) : null}

            {resolvedReport.key === "sss" ? (
              <div id="statutory-print-root">
                <GovernmentRemittanceReports
                  companyName={companyName}
                  philHealthMonth={reportMonth}
                  pagIbigMonth={reportMonth}
                  printedAt={new Date()}
                  printedBy={printedBy}
                  sssRows={sssRows}
                  philHealthRows={[]}
                  pagIbigRows={[]}
                  showSss
                  showPhilHealth={false}
                  showPagIbig={false}
                />
              </div>
            ) : null}

            {resolvedReport.key === "pagibig" ? (
              <div id="statutory-print-root">
              <GovernmentRemittanceReports
                companyName={companyName}
                philHealthMonth={reportMonth}
                pagIbigMonth={reportMonth}
                printedAt={new Date()}
                printedBy={printedBy}
                philHealthRows={[]}
                pagIbigRows={pagIbigRows}
                showPhilHealth={false}
                showPagIbig
              />
              </div>
            ) : null}

            {resolvedReport.key === "bir-alphalist" ? (
              <div className="space-y-3">
                <div id="statutory-print-root">
                  <GovernmentRemittanceReports
                    companyName={companyName}
                    philHealthMonth={reportMonth}
                    pagIbigMonth={reportMonth}
                    birYear={resolvedReportYear}
                    printedAt={new Date()}
                    printedBy={printedBy}
                    philHealthRows={[]}
                    pagIbigRows={[]}
                    birAlphalistRows={filteredBirRows.map((row) => ({
                      employeeId: row.employeeNumber,
                      employeeName: row.employeeName,
                      tinNumber: row.tinNumber ?? "",
                      sssEmployee: parseAmount(row.sssEmployee),
                      philHealthEmployee: parseAmount(row.philHealthEmployee),
                      pagIbigEmployee: parseAmount(row.pagIbigEmployee),
                      grossCompensation: parseAmount(row.grossCompensation),
                      taxableCompensation: parseAmount(row.taxableCompensation),
                      withholdingTax: parseAmount(row.withholdingTax),
                    }))}
                    showPhilHealth={false}
                    showPagIbig={false}
                    showBirAlphalist
                  />
                </div>

                <div className="border border-border/60 bg-muted/10 p-3 print:hidden">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    BIR Calc Trace (Per Employee)
                  </p>
                  <div className="overflow-x-auto border border-border/60">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Year</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Annual Tax Due</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Delta</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBirRows.map((row) => {
                          const traceKey = `${row.employeeId}-${row.year}`
                          const expanded = expandedBirTraceKey === traceKey

                          return (
                            <Fragment key={traceKey}>
                              <tr key={traceKey} className="border-t border-border/50">
                                <td className="px-3 py-2">
                                  <p className="font-medium">{row.employeeName}</p>
                                  <p className="text-[11px] text-muted-foreground">{row.employeeNumber}</p>
                                </td>
                                <td className="px-3 py-2">{row.year}</td>
                                <td className="px-3 py-2">{row.annualTaxDue}</td>
                                <td className="px-3 py-2">{row.taxVariance}</td>
                                <td className="px-3 py-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setExpandedBirTraceKey(expanded ? null : traceKey)}
                                  >
                                    {expanded ? <IconChevronUp className="size-3.5" /> : <IconChevronDown className="size-3.5" />}
                                    Trace
                                  </Button>
                                </td>
                              </tr>
                              {expanded ? (
                                <tr className="border-t border-border/50 bg-background">
                                  <td className="px-3 py-3" colSpan={5}>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      <TraceItem label="Gross Compensation" value={row.grossCompensation} />
                                      <TraceItem label="Non-Taxable Cap Applied" value={row.nonTaxableBenefits} />
                                      <TraceItem label="Taxable Base" value={row.taxableCompensation} />
                                      <TraceItem label="Annual Tax Due" value={row.annualTaxDue} />
                                      <TraceItem label="YTD Withheld" value={row.withholdingTax} />
                                      <TraceItem label="Delta" value={row.taxVariance} />
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {resolvedReport.key === "dole13th" ? (
              <div id="statutory-print-root">
                <GovernmentRemittanceReports
                  companyName={companyName}
                  philHealthMonth={reportMonth}
                  pagIbigMonth={reportMonth}
                  birYear={resolvedReportYear}
                  printedAt={new Date()}
                  printedBy={printedBy}
                  sssRows={[]}
                  philHealthRows={[]}
                  pagIbigRows={[]}
                  dole13thRows={filteredDoleRows}
                  showSss={false}
                  showPhilHealth={false}
                  showPagIbig={false}
                  showDole13th
                />
              </div>
            ) : null}

            {resolvedReport.key === "payroll-register" ? (
              <div className="space-y-3">
                <div className="print:hidden">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Select Payroll Run</p>
                      <Select value={resolvedRegisterRunId} onValueChange={setSelectedRegisterRunId}>
                        <SelectTrigger className="h-9 w-full md:w-[380px]">
                          <SelectValue placeholder="Select payroll run" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredRegisterRuns.map((run) => (
                            <SelectItem key={run.runId} value={run.runId}>
                              {run.isTrialRun ? "[TRIAL]" : "[REGULAR]"} {run.runNumber} • {run.runTypeCode} • {run.periodLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="border border-border/60 bg-card p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Available Payroll Register Runs ({filteredRegisterRuns.length})
                  </p>
                  <div className="overflow-x-auto border border-border/60">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run #</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Period</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Created</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRegisterRuns.length === 0 ? (
                          <tr className="border-t border-border/50">
                            <td className="px-3 py-4 text-center text-muted-foreground" colSpan={5}>
                              No payroll runs matched the selected mode.
                            </td>
                          </tr>
                        ) : (
                          filteredRegisterRuns.map((run) => (
                            <tr key={run.runId} className="border-t border-border/50">
                              <td className="px-3 py-2">{run.runNumber}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span>{run.runTypeCode}</span>
                                  <Badge variant={run.isTrialRun ? "secondary" : "default"}>
                                    {run.isTrialRun ? "TRIAL" : "REGULAR"}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-3 py-2">{run.periodLabel}</td>
                              <td className="px-3 py-2">
                                {new Intl.DateTimeFormat("en-PH", {
                                  month: "short",
                                  day: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Asia/Manila",
                                }).format(new Date(run.createdAtIso))}
                              </td>
                              <td className="px-3 py-2">
                                <Button asChild type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                                  <Link href={`/${companyId}/payroll/runs/${run.runId}/report`}>
                                    Open Register
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

          </section>
      </section>
    </main>
    <style jsx global>{`
      @media print {
        body * {
          visibility: hidden;
        }

        #statutory-print-root,
        #statutory-print-root * {
          visibility: visible;
        }

        #statutory-print-root {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 0;
          background: #fff;
        }
      }
    `}</style>
    </>
  )
}

function TraceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
