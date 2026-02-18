"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCloudUpload,
  IconFileUpload,
  IconFileExport,
  IconLoader,
  IconPlayerPlay,
  IconRefresh,
  IconSparkles,
  IconTableImport,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { bulkUpdateEmployeesAction } from "@/modules/employees/masterlist/actions/bulk-update-employees-action"
import {
  csvEscape,
  EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
  EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS,
  type EmployeeBulkUpdateTemplateHeader,
  isClearToken,
  isCsvRowBlank,
  normalizeBulkHeaderKey,
  normalizeBulkKey,
  parseCsvRows,
  type ParsedCsvRow,
} from "@/modules/employees/masterlist/utils/employee-bulk-csv"

type EmployeeBulkUpdateWorkspacePageProps = {
  companyId: string
  companyName: string
}

type PreviewChange = {
  field: EmployeeBulkUpdateTemplateHeader
  label: string
  value: string
  mode: "set" | "clear"
}

type ValidationState = "pending" | "ready" | "invalid"
type ApplyState = "idle" | "running" | "success" | "error" | "skipped"

type PreviewRow = {
  id: string
  rowNumber: number
  employeeNumber: string
  changes: PreviewChange[]
  localIssues: string[]
  validationIssues: string[]
  validationState: ValidationState
  applyState: ApplyState
  applyIssue: string | null
  rowCsv: string
}

type ApplyProgressState = {
  total: number
  completed: number
  success: number
  error: number
  skipped: number
  currentEmployeeNumber: string | null
}

const isCommentRow = (row: ParsedCsvRow): boolean => {
  const firstNonBlankCell = row.cells.find((cell) => cell.trim().length > 0)
  if (!firstNonBlankCell) return false
  return firstNonBlankCell.trim().startsWith("#")
}

const toDisplayFieldLabel = (field: EmployeeBulkUpdateTemplateHeader): string => {
  const withSpaces = field
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

const toPreviewValue = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return "Empty"
  return trimmed
}

const buildHeaderIndexMap = (headerCells: string[]): Map<string, number> => {
  const map = new Map<string, number>()
  headerCells.forEach((cell, index) => {
    const key = normalizeBulkHeaderKey(cell)
    if (!key || map.has(key)) return
    map.set(key, index)
  })
  return map
}

const getCellValue = (
  row: ParsedCsvRow,
  headerIndexMap: Map<string, number>,
  header: EmployeeBulkUpdateTemplateHeader
): string => {
  const index = headerIndexMap.get(normalizeBulkHeaderKey(header))
  if (index === undefined) return ""
  return row.cells[index] ?? ""
}

const buildSingleRowCsv = (headerCells: string[], rowCells: string[]): string => {
  const normalizedRow = Array.from({ length: headerCells.length }, (_, index) => rowCells[index] ?? "")
  return [headerCells.map(csvEscape).join(","), normalizedRow.map(csvEscape).join(",")].join("\n")
}

const parseLegendDisplayMap = (
  rows: ParsedCsvRow[]
): Map<EmployeeBulkUpdateTemplateHeader, Map<string, string>> => {
  const byField = new Map<EmployeeBulkUpdateTemplateHeader, Map<string, string>>()

  for (const row of rows) {
    const firstCell = row.cells[0]?.trim() ?? ""
    if (!firstCell.startsWith("#")) continue

    const templateColumnRaw = row.cells[4]?.trim() ?? ""
    if (!templateColumnRaw) continue

    const normalizedTemplateColumn = normalizeBulkHeaderKey(templateColumnRaw)
    const matchedHeader = EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.find(
      (header) => normalizeBulkHeaderKey(header) === normalizedTemplateColumn
    )
    if (!matchedHeader) continue

    const code = row.cells[1]?.trim() ?? ""
    const name = row.cells[2]?.trim() ?? ""
    if (!code && !name) continue

    const fieldMap = byField.get(matchedHeader) ?? new Map<string, string>()
    if (code) {
      fieldMap.set(normalizeBulkKey(code), name || code)
    }
    if (name) {
      fieldMap.set(normalizeBulkKey(name), name)
    }
    byField.set(matchedHeader, fieldMap)
  }

  return byField
}

const resolvePreviewDisplayValue = (
  field: EmployeeBulkUpdateTemplateHeader,
  rawValue: string,
  legendDisplayMap: Map<EmployeeBulkUpdateTemplateHeader, Map<string, string>>
): string => {
  const fieldMap = legendDisplayMap.get(field)
  if (!fieldMap) return rawValue
  const mapped = fieldMap.get(normalizeBulkKey(rawValue))
  if (!mapped) return rawValue
  return mapped
}

export function EmployeeBulkUpdateWorkspacePage({
  companyId,
  companyName,
}: EmployeeBulkUpdateWorkspacePageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isValidating, startValidationTransition] = useTransition()
  const [isApplying, setIsApplying] = useState(false)
  const [csvFileName, setCsvFileName] = useState<string>("")
  const [csvContent, setCsvContent] = useState<string>("")
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [hasValidated, setHasValidated] = useState(false)
  const [applyProgress, setApplyProgress] = useState<ApplyProgressState>({
    total: 0,
    completed: 0,
    success: 0,
    error: 0,
    skipped: 0,
    currentEmployeeNumber: null,
  })

  const parseCsvPreview = (rawCsv: string, fileName: string) => {
    let parsedRows: ParsedCsvRow[]
    try {
      parsedRows = parseCsvRows(rawCsv)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid CSV format."
      toast.error(message)
      return
    }

    if (parsedRows.length === 0) {
      toast.error("CSV file is empty.")
      return
    }

    const [headerRow, ...rawRows] = parsedRows
    if (!headerRow) {
      toast.error("CSV file is missing headers.")
      return
    }

    const headerIndexMap = buildHeaderIndexMap(headerRow.cells)
    const missingRequiredHeaders = EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS.filter(
      (requiredHeader) => !headerIndexMap.has(normalizeBulkHeaderKey(requiredHeader))
    )

    if (missingRequiredHeaders.length > 0) {
      toast.error(`Missing required column(s): ${missingRequiredHeaders.join(", ")}`)
      return
    }

    const dataRows = rawRows.filter((row) => !isCsvRowBlank(row.cells) && !isCommentRow(row))
    if (dataRows.length === 0) {
      toast.error("No import rows found. Remove blank/comment-only rows and try again.")
      return
    }
    const legendDisplayMap = parseLegendDisplayMap(rawRows)

    const nextRows = dataRows.map((row, index) => {
      const employeeNumber = getCellValue(row, headerIndexMap, "employeeNumber").trim()
      const changes: PreviewChange[] = []

      for (const header of EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS) {
        if (header === "employeeNumber") continue
        const rawValue = getCellValue(row, headerIndexMap, header).trim()
        if (!rawValue) continue
        const displayValue = isClearToken(rawValue)
          ? rawValue
          : resolvePreviewDisplayValue(header, rawValue, legendDisplayMap)
        changes.push({
          field: header,
          label: toDisplayFieldLabel(header),
          value: toPreviewValue(displayValue),
          mode: isClearToken(rawValue) ? "clear" : "set",
        })
      }

      const localIssues: string[] = []
      if (!employeeNumber) {
        localIssues.push("employeeNumber is required.")
      }
      if (changes.length === 0) {
        localIssues.push("No non-empty update fields were provided for this row.")
      }

      return {
        id: `preview-${row.lineNumber}-${index}`,
        rowNumber: row.lineNumber,
        employeeNumber,
        changes,
        localIssues,
        validationIssues: [],
        validationState: localIssues.length > 0 ? "invalid" : "pending",
        applyState: "idle",
        applyIssue: null,
        rowCsv: buildSingleRowCsv(headerRow.cells, row.cells),
      } satisfies PreviewRow
    })

    setCsvFileName(fileName)
    setCsvContent(rawCsv)
    setPreviewRows(nextRows)
    setHasValidated(false)
    setApplyProgress({
      total: 0,
      completed: 0,
      success: 0,
      error: 0,
      skipped: 0,
      currentEmployeeNumber: null,
    })
    toast.success(`Loaded ${nextRows.length} row(s) from ${fileName}.`)
  }

  const handleValidate = () => {
    if (!csvContent || previewRows.length === 0) {
      toast.error("Upload a CSV file first.")
      return
    }

    startValidationTransition(async () => {
      const result = await bulkUpdateEmployeesAction({
        companyId,
        csvContent,
        dryRun: true,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const serverIssues = new Map<number, string[]>()
      for (const rowError of result.errors) {
        const existing = serverIssues.get(rowError.rowNumber) ?? []
        existing.push(rowError.message)
        serverIssues.set(rowError.rowNumber, existing)
      }

      setPreviewRows((previous) =>
        previous.map((row) => {
          const issues = serverIssues.get(row.rowNumber) ?? []
          const hasIssues = row.localIssues.length > 0 || issues.length > 0
          return {
            ...row,
            validationIssues: issues,
            validationState: hasIssues ? "invalid" : "ready",
            applyState: "idle",
            applyIssue: null,
          }
        })
      )

      setHasValidated(true)

      if (result.summary.errorRows > 0) {
        toast.error(result.message)
      } else {
        toast.success(result.message)
      }
    })
  }

  const handleApply = async () => {
    if (isApplying) return
    if (!hasValidated) {
      toast.error("Run Validate Preview first so row-level issues are visible before update.")
      return
    }

    const rowsToApply = previewRows.filter((row) => row.validationState === "ready")
    if (rowsToApply.length === 0) {
      toast.error("No valid rows available to update.")
      return
    }

    setIsApplying(true)
    setApplyProgress({
      total: rowsToApply.length,
      completed: 0,
      success: 0,
      error: 0,
      skipped: 0,
      currentEmployeeNumber: null,
    })

    let success = 0
    let error = 0
    let skipped = 0
    let completed = 0

    for (const row of rowsToApply) {
      setApplyProgress((previous) => ({
        ...previous,
        currentEmployeeNumber: row.employeeNumber || `Row ${row.rowNumber}`,
      }))
      setPreviewRows((previous) =>
        previous.map((current) =>
          current.id === row.id
            ? {
                ...current,
                applyState: "running",
                applyIssue: null,
              }
            : current
        )
      )

      const result = await bulkUpdateEmployeesAction({
        companyId,
        csvContent: row.rowCsv,
        dryRun: false,
      })

      let applyState: ApplyState = "success"
      let applyIssue: string | null = null

      if (!result.ok) {
        applyState = "error"
        applyIssue = result.error
      } else if (result.summary.errorRows > 0) {
        applyState = "error"
        applyIssue = result.errors[0]?.message ?? result.message
      } else if (result.summary.updatedRows === 0) {
        applyState = "skipped"
        applyIssue = result.message
      }

      if (applyState === "success") success += 1
      if (applyState === "error") error += 1
      if (applyState === "skipped") skipped += 1
      completed += 1

      setPreviewRows((previous) =>
        previous.map((current) =>
          current.id === row.id
            ? {
                ...current,
                applyState,
                applyIssue,
              }
            : current
        )
      )

      setApplyProgress({
        total: rowsToApply.length,
        completed,
        success,
        error,
        skipped,
        currentEmployeeNumber: row.employeeNumber || `Row ${row.rowNumber}`,
      })
    }

    setApplyProgress((previous) => ({ ...previous, currentEmployeeNumber: null }))
    setIsApplying(false)

    if (success > 0) {
      router.refresh()
    }

    if (error > 0) {
      toast.error(`Bulk update finished with issues. Success: ${success}, Errors: ${error}, Skipped: ${skipped}.`)
    } else {
      toast.success(`Bulk update completed. Success: ${success}, Skipped: ${skipped}.`)
    }
  }

  const previewCounts = useMemo(() => {
    const pending = previewRows.filter((row) => row.validationState === "pending").length
    const ready = previewRows.filter((row) => row.validationState === "ready").length
    const invalid = previewRows.filter((row) => row.validationState === "invalid").length
    const success = previewRows.filter((row) => row.applyState === "success").length
    const error = previewRows.filter((row) => row.applyState === "error").length
    const running = previewRows.filter((row) => row.applyState === "running").length
    return { pending, ready, invalid, success, error, running }
  }, [previewRows])

  const displayedRows = useMemo(() => previewRows.filter((row) => row.changes.length > 0), [previewRows])
  const previewFieldColumns = useMemo(
    () =>
      EMPLOYEE_BULK_UPDATE_TEMPLATE_HEADERS.filter(
        (header) =>
          header !== "employeeNumber" &&
          displayedRows.some((row) => row.changes.some((change) => change.field === header))
      ),
    [displayedRows]
  )

  const applyPercent = applyProgress.total > 0 ? Math.round((applyProgress.completed / applyProgress.total) * 100) : 0

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Human Resources</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconTableImport className="size-6 text-primary sm:size-7" />
                  Employee Bulk Update
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload CSV, validate rows, preview employee changes, then apply updates with per-row progress.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/employees`}>
                  <IconArrowLeft className="mr-1.5 size-3.5" />
                  Back to Masterlist
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 border-border/70">
                <a href={`/${companyId}/employees/bulk-template`}>
                  <IconFileExport className="mr-1.5 size-3.5" />
                  Download CSV Template
                </a>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-border/70 py-0">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-base">Upload and Prepare</CardTitle>
            <CardDescription className="text-xs">
              Required headers are marked with <span className="font-semibold text-foreground">*</span> in template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            <div className="space-y-2">
              <Label htmlFor="employee-bulk-workspace-file">
                CSV File
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <div className="relative w-full max-w-full min-w-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isApplying || isValidating}
                  className="flex h-10 w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-dashed border-primary/40 bg-background px-3 pr-10 text-sm font-medium text-foreground transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <IconFileUpload className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{csvFileName || "Select CSV File"}</span>
                </button>
                {csvFileName ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 z-10 size-8 -translate-y-1/2"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCsvFileName("")
                      setCsvContent("")
                      setPreviewRows([])
                      setHasValidated(false)
                      setApplyProgress({
                        total: 0,
                        completed: 0,
                        success: 0,
                        error: 0,
                        skipped: 0,
                        currentEmployeeNumber: null,
                      })
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                    aria-label="Clear selected csv file"
                    disabled={isApplying || isValidating}
                  >
                    <IconX className="size-4" />
                  </Button>
                ) : null}
              </div>
              <Input
                ref={fileInputRef}
                id="employee-bulk-workspace-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={isApplying || isValidating}
                onChange={async (event) => {
                  const selectedFile = event.target.files?.[0]
                  if (!selectedFile) return
                  const rawContent = await selectedFile.text()
                  parseCsvPreview(rawContent, selectedFile.name)
                }}
              />
            </div>

            <div className="rounded-md border border-border/60 bg-muted/15 p-3 text-xs text-muted-foreground">
              <p>Leave cells blank to keep existing values.</p>
              <p className="mt-1">
                Use <span className="font-semibold text-foreground">__CLEAR__</span> to clear supported optional fields.
              </p>
              <p className="mt-1">Rows that start with `#` are ignored.</p>
            </div>

            <div className="grid gap-2">
              <Button onClick={handleValidate} disabled={!csvContent || isValidating || isApplying}>
                {isValidating ? (
                  <>
                    <IconLoader className="mr-1.5 size-4 animate-spin" />
                    Validating Preview...
                  </>
                ) : (
                  <>
                    <IconSparkles className="mr-1.5 size-4" />
                    Validate Preview
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleApply} disabled={isApplying || isValidating || previewCounts.ready === 0}>
                {isApplying ? (
                  <>
                    <IconLoader className="mr-1.5 size-4 animate-spin" />
                    Applying Updates...
                  </>
                ) : (
                  <>
                    <IconPlayerPlay className="mr-1.5 size-4" />
                    Apply Updates Per Employee
                  </>
                )}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Preview Counters</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">Rows with updates: {displayedRows.length}</Badge>
                <Badge variant="secondary">Pending: {previewCounts.pending}</Badge>
                <Badge variant="secondary">Ready: {previewCounts.ready}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">Invalid: {previewCounts.invalid}</Badge>
                <Badge variant="outline">Success: {previewCounts.success}</Badge>
                <Badge variant="outline">Error: {previewCounts.error}</Badge>
                <Badge variant="outline">Running: {previewCounts.running}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-base">Update Progress</CardTitle>
              <CardDescription className="text-xs">
                Progress is tracked in real-time while each employee row is processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall completion</span>
                <span className="tabular-nums">{applyPercent}%</span>
              </div>
              <Progress value={applyPercent} className="h-2" />
              <AnimatePresence mode="popLayout">
                {isApplying && applyProgress.currentEmployeeNumber ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-foreground"
                  >
                    <IconLoader className="size-3.5 animate-spin text-primary" />
                    Updating {applyProgress.currentEmployeeNumber}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground"
                  >
                    <IconRefresh className="size-3.5" />
                    Ready to run bulk update
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <Metric label="Completed" value={`${applyProgress.completed}/${applyProgress.total}`} />
                <Metric label="Success" value={String(applyProgress.success)} tone="success" />
                <Metric label="Error" value={String(applyProgress.error)} tone="danger" />
                <Metric label="Skipped" value={String(applyProgress.skipped)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 py-0">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-base">Imported Rows Preview</CardTitle>
              <CardDescription className="text-xs">
                Simple row preview: one employee per row with only updated fields shown as columns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              {previewRows.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center">
                  <IconCloudUpload className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium text-foreground">Upload a CSV to preview updates</p>
                  <p className="text-xs text-muted-foreground">
                    The table will show each row, validation state, and exact field values to update.
                  </p>
                </div>
              ) : displayedRows.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No update fields detected</p>
                  <p className="text-xs text-muted-foreground">
                    Only rows with actual field updates are shown in this preview table.
                  </p>
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-md border border-border/60 [&_[data-slot=table-container]]:overflow-visible">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 z-20 w-20 bg-background">Row</TableHead>
                        <TableHead className="sticky top-0 z-20 w-44 bg-background">Employee No.</TableHead>
                        <TableHead className="sticky top-0 z-20 w-40 bg-background">Validation</TableHead>
                        <TableHead className="sticky top-0 z-20 w-36 bg-background">Apply</TableHead>
                        <TableHead className="sticky top-0 z-20 w-60 bg-background">Issues</TableHead>
                        {previewFieldColumns.map((field) => (
                          <TableHead
                            key={`preview-col-${field}`}
                            className="sticky top-0 z-20 min-w-[170px] bg-background"
                          >
                            {toDisplayFieldLabel(field)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRows.map((row) => {
                        const rowIssues = [...row.localIssues, ...row.validationIssues]
                        if (row.applyIssue) {
                          rowIssues.push(row.applyIssue)
                        }
                        const changeMap = new Map(row.changes.map((change) => [change.field, change]))

                        return (
                          <TableRow key={row.id} className={cn(row.applyState === "running" && "bg-primary/5")}>
                            <TableCell className="align-top text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                            <TableCell className="align-top text-xs font-medium">
                              {row.employeeNumber || <span className="text-destructive">Missing</span>}
                            </TableCell>
                            <TableCell className="align-top">{renderValidationBadge(row.validationState)}</TableCell>
                            <TableCell className="align-top">{renderApplyBadge(row.applyState)}</TableCell>
                            <TableCell className="align-top text-xs text-muted-foreground">
                              {rowIssues.length > 0 ? rowIssues.join(" | ") : "-"}
                            </TableCell>
                            {previewFieldColumns.map((field) => {
                              const change = changeMap.get(field)
                              if (!change) {
                                return (
                                  <TableCell key={`${row.id}-${field}`} className="align-top text-xs">
                                    {" "}
                                  </TableCell>
                                )
                              }
                              return (
                                <TableCell key={`${row.id}-${field}`} className="align-top text-xs">
                                  {change.mode === "clear" ? (
                                    <Badge
                                      variant="outline"
                                      className="h-5 border-destructive/40 bg-destructive/10 px-1.5 text-[10px] text-destructive"
                                    >
                                      __CLEAR__
                                    </Badge>
                                  ) : (
                                    <span className="text-foreground">{change.value}</span>
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "success" | "danger"
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/10",
        tone === "danger" && "border-destructive/30 bg-destructive/10",
        tone === "default" && "border-border/60 bg-muted/10"
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function renderValidationBadge(state: ValidationState) {
  if (state === "ready") {
    return (
      <Badge variant="outline" className="h-5 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700">
        <IconCheck className="mr-1 size-3" />
        Ready
      </Badge>
    )
  }

  if (state === "invalid") {
    return (
      <Badge variant="outline" className="h-5 border-destructive/40 bg-destructive/10 px-1.5 text-[10px] text-destructive">
        <IconAlertTriangle className="mr-1 size-3" />
        Invalid
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
      Pending
    </Badge>
  )
}

function renderApplyBadge(state: ApplyState) {
  if (state === "running") {
    return (
      <Badge variant="outline" className="h-5 border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary">
        <IconLoader className="mr-1 size-3 animate-spin" />
        Updating
      </Badge>
    )
  }

  if (state === "success") {
    return (
      <Badge variant="outline" className="h-5 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-700">
        <IconCheck className="mr-1 size-3" />
        Success
      </Badge>
    )
  }

  if (state === "error") {
    return (
      <Badge variant="outline" className="h-5 border-destructive/40 bg-destructive/10 px-1.5 text-[10px] text-destructive">
        <IconX className="mr-1 size-3" />
        Error
      </Badge>
    )
  }

  if (state === "skipped") {
    return (
      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
        Skipped
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
      Idle
    </Badge>
  )
}
