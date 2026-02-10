"use client"

import { Fragment, type ComponentType, useMemo, useState } from "react"
import {
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
import { toast } from "sonner"

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
  totals: {
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }
  rows: Array<{
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
  }>
  birRows: Array<{
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
  }>
  doleRows: Array<{
    employeeId: string
    employeeName: string
    employeeNumber: string
    year: number
    annualBasicSalary: string
    thirteenthMonthPay: string
  }>
}

type ReportKey = "sss" | "philhealth" | "pagibig" | "dole13th" | "bir-alphalist"

const REPORT_OPTIONS: Array<{ key: ReportKey; label: string; frequency: string }> = [
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
  companyName,
  printedBy,
  rows,
  birRows,
  doleRows,
}: PayrollStatutoryPageClientProps) {
  const [activeReport, setActiveReport] = useState<ReportKey>("philhealth")
  const [searchText, setSearchText] = useState("")
  const [expandedBirTraceKey, setExpandedBirTraceKey] = useState<string | null>(null)

  const monthOptions = useMemo(() => {
    const monthMap = new Map<string, Date>()
    for (const row of rows) {
      const date = new Date(row.cutoffEndDateIso)
      if (Number.isNaN(date.getTime())) {
        continue
      }
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
      if (!monthMap.has(key)) {
        monthMap.set(key, date)
      }
    }

    return Array.from(monthMap.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([key, date]) => ({
        key,
        date,
        label: date.toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Manila",
        }),
      }))
  }, [rows])

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(monthOptions[0]?.key ?? "")

  const filteredOptions = useMemo(() => {
    const normalized = searchText.trim().toLowerCase()
    if (!normalized) {
      return REPORT_OPTIONS
    }

    return REPORT_OPTIONS.filter((report) => report.label.toLowerCase().includes(normalized))
  }, [searchText])

  const resolvedReport = filteredOptions.find((option) => option.key === activeReport) ?? filteredOptions[0] ?? REPORT_OPTIONS[0]

  const selectedMonthDate = monthOptions.find((option) => option.key === selectedMonthKey)?.date ?? new Date()

  const scopedRows = useMemo(() => {
    if (!selectedMonthKey) {
      return rows
    }

    return rows.filter((row) => row.cutoffEndDateIso.startsWith(selectedMonthKey))
  }, [rows, selectedMonthKey])

  const philHealthRows = useMemo<PhilHealthRemittanceRow[]>(() => {
    return scopedRows.map((row) => ({
      idNumber: row.employeeNumber,
      employeeName: row.employeeName,
      pin: (row.philHealthPin ?? "").replace(/\D/g, ""),
      employeeShare: parseAmount(row.philHealthEmployee),
      employerShare: parseAmount(row.philHealthEmployer),
    }))
  }, [scopedRows])

  const sssRows = useMemo<SssRemittanceRow[]>(() => {
    return scopedRows.map((row) => ({
      idNumber: row.employeeNumber,
      employeeName: row.employeeName,
      sssNumber: row.sssNumber ?? "",
      employeeShare: parseAmount(row.sssEmployee),
      employerShare: parseAmount(row.sssEmployer),
    }))
  }, [scopedRows])

  const pagIbigRows = useMemo<PagIbigContributionRow[]>(() => {
    return scopedRows.map((row) => {
      const nameParts = extractNameParts(row.employeeName)
      return {
        employeeId: row.employeeNumber,
        surname: nameParts.surname,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        birthDate: row.birthDate ? new Date(row.birthDate) : new Date("2000-01-01"),
        pagIbigNumber: row.pagIbigNumber ?? "",
        employeeShare: parseAmount(row.pagIbigEmployee),
        employerShare: parseAmount(row.pagIbigEmployer),
      }
    })
  }, [scopedRows])

  const selectedYearPrefix = selectedMonthKey ? selectedMonthKey.slice(0, 4) : ""

  const filteredBirRows = useMemo(() => {
    if (!selectedYearPrefix) {
      return birRows
    }

    const year = Number(selectedYearPrefix)
    return birRows.filter((row) => row.year === year)
  }, [birRows, selectedYearPrefix])

  const filteredDoleRows = useMemo<Dole13thMonthRow[]>(() => {
    const targetYear = selectedYearPrefix ? Number(selectedYearPrefix) : undefined
    const scoped = targetYear ? doleRows.filter((row) => row.year === targetYear) : doleRows

    return scoped.map((row) => ({
      employeeId: row.employeeNumber,
      employeeName: row.employeeName,
      annualBasicSalary: parseAmount(row.annualBasicSalary),
      thirteenthMonthPay: parseAmount(row.thirteenthMonthPay),
    }))
  }, [doleRows, selectedYearPrefix])

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
      const yearLabel = selectedYearPrefix || String(new Date().getFullYear())
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
      const yearLabel = selectedYearPrefix || String(new Date().getFullYear())
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
      <header className="border-b border-border/60 px-4 py-6 sm:px-6 print:hidden">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconFileAnalytics className="size-5" />
          {companyName} Statutory Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Select PhilHealth or Pag-IBIG to view the printable report.
        </p>
      </header>

      <section className="grid border-y border-border/60 lg:grid-cols-[320px_1fr] print:block">
        <aside className="space-y-3 border-r border-border/60 p-4 print:hidden sm:p-6">
          <div className="space-y-2">
            <h2 className="inline-flex items-center gap-2 text-base font-medium">
            <IconReceiptTax className="size-4 text-primary" />
            Agency Report Workspace
            </h2>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search report"
                className="pl-8"
              />
            </div>
            <Select value={selectedMonthKey} onValueChange={setSelectedMonthKey}>
              <SelectTrigger className="w-full">
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
          </div>

          <ScrollArea className="h-[620px] pr-1">
            <div className="space-y-2">
              {filteredOptions.map((report) => {
                const ReportIcon = reportIconByKey[report.key]
                return (
                  <button
                    key={report.key}
                    type="button"
                    onClick={() => setActiveReport(report.key)}
                    className={cn(
                      "w-full border px-3 py-2 text-left text-xs",
                    resolvedReport.key === report.key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background hover:bg-muted/40"
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
            <div className="flex items-center justify-between gap-2 print:hidden">
              <div>
                <p className="text-sm font-semibold">{resolvedReport.label}</p>
                <p className="text-xs text-muted-foreground">{resolvedReport.frequency}</p>
              </div>
              {resolvedReport.key === "sss" || resolvedReport.key === "philhealth" || resolvedReport.key === "pagibig" || resolvedReport.key === "bir-alphalist" || resolvedReport.key === "dole13th" ? (
                <div className="flex items-center gap-2">
                  <Button onClick={() => exportCsvTemplate(resolvedReport.key)} className="bg-green-600 text-white hover:bg-green-700">
                    <IconFileText className="size-4" />
                    Export CSV
                  </Button>
                  <Button onClick={() => window.print()} className="bg-blue-600 text-white hover:bg-blue-700">
                    <IconPrinter className="size-4" />
                    Print Report
                  </Button>
                </div>
              ) : null}
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
                    birYear={selectedYearPrefix ? Number(selectedYearPrefix) : new Date().getFullYear()}
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
                          <th className="px-3 py-2 text-left">Employee</th>
                          <th className="px-3 py-2 text-left">Year</th>
                          <th className="px-3 py-2 text-left">Annual Tax Due</th>
                          <th className="px-3 py-2 text-left">Delta</th>
                          <th className="px-3 py-2 text-left">Action</th>
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
                  birYear={selectedYearPrefix ? Number(selectedYearPrefix) : new Date().getFullYear()}
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
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
