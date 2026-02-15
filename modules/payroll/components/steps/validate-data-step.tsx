"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconAlertTriangle, IconLoader2, IconTerminal2 } from "@tabler/icons-react"
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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { proceedToCalculatePayrollRunAction, validatePayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"

type ValidateDataStepProps = {
  companyId: string
  runId: string
  validationNotes: string
}

export function ValidateDataStep({ companyId, runId, validationNotes }: ValidateDataStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [logs, setLogs] = useState<string[]>([])
  const [summaryPage, setSummaryPage] = useState(1)
  const [summaryPageSize, setSummaryPageSize] = useState("10")
  const [confirmProceedOpen, setConfirmProceedOpen] = useState(false)

  const parsedNotes = useMemo(() => {
    if (!validationNotes) return null
    try {
      return JSON.parse(validationNotes) as {
        errorCount?: number
        warningCount?: number
        errors?: string[]
        warnings?: string[]
        dtrSummary?: {
          details?: Array<{
            employeeId: string
            employeeNumber: string
            employeeName: string
            presentDays: number
            absentDays: number
            tardinessMins: number
            undertimeMins: number
            overtimeHours?: number
            ctoConversionHours?: number
          }>
        }
      }
    } catch {
      return null
    }
  }, [validationNotes])

  const handleValidate = () => {
    setLogs(["Initializing validation...", "Checking employee records...", "Checking DTR and request diagnostics..."])

    startTransition(async () => {
      const result = await validatePayrollRunAction({ companyId, runId })
      if (!result.ok) {
        setLogs((prev) => [...prev, "Validation failed."])
        toast.error(result.error)
        return
      }

      setLogs((prev) => [...prev, "Validation complete."])
      toast.success(result.message)
      router.refresh()
    })
  }

  const handleProceed = () => {
    startTransition(async () => {
      const result = await proceedToCalculatePayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setConfirmProceedOpen(false)
      router.refresh()
    })
  }

  const canProceed = (parsedNotes?.errorCount ?? 0) === 0 && Boolean(parsedNotes)
  const attendanceDetails = parsedNotes?.dtrSummary?.details ?? []
  const summaryPageSizeNumber = useMemo(() => Math.max(1, Number(summaryPageSize) || 10), [summaryPageSize])
  const summaryTotalPages = useMemo(
    () => Math.max(1, Math.ceil(attendanceDetails.length / summaryPageSizeNumber)),
    [attendanceDetails.length, summaryPageSizeNumber]
  )
  const safeSummaryPage = Math.min(summaryPage, summaryTotalPages)
  const pagedAttendanceDetails = useMemo(() => {
    const start = (safeSummaryPage - 1) * summaryPageSizeNumber
    return attendanceDetails.slice(start, start + summaryPageSizeNumber)
  }, [attendanceDetails, safeSummaryPage, summaryPageSizeNumber])
  const showValidationLog = isPending || attendanceDetails.length === 0

  useEffect(() => {
    if (summaryPage <= summaryTotalPages) return
    setSummaryPage(summaryTotalPages)
  }, [summaryPage, summaryTotalPages])

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold text-foreground">Payroll Data Validation</h2>
        <p className="text-sm text-muted-foreground">Automated checks on attendance, payroll profile readiness, and request diagnostics.</p>
      </div>

      {showValidationLog ? (
        <div className="min-h-56 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-card p-4 text-xs text-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground"><IconTerminal2 className="h-4 w-4 text-primary" /> Validation Log</p>
          {logs.length === 0 ? (
            <p className="text-muted-foreground">Ready to run validation...</p>
          ) : (
            logs.map((log, index) => (
              <p key={`${log}-${index}`} className="text-muted-foreground">{log}</p>
            ))
          )}
          {isPending ? (
            <p className="flex items-center gap-2 text-primary">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Running validation...
            </p>
          ) : null}
        </div>
      ) : null}

      {!isPending && attendanceDetails.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-card p-3">
          <p className="text-xs font-medium text-foreground">Validated Employee Attendance Summary</p>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-2 text-left">Employee</th>
                  <th className="px-2 py-2 text-left">Present</th>
                  <th className="px-2 py-2 text-left">Absent</th>
                  <th className="px-2 py-2 text-left">Tardiness</th>
                  <th className="px-2 py-2 text-left">Undertime</th>
                  <th className="px-2 py-2 text-left">OT</th>
                  <th className="px-2 py-2 text-left">CTO Conv</th>
                </tr>
              </thead>
              <tbody>
                {pagedAttendanceDetails.map((entry) => (
                  <tr key={entry.employeeId} className="border-t border-border/50">
                    <td className="px-2 py-2">
                      <p className="font-medium">{entry.employeeName}</p>
                      <p className="text-[11px] text-muted-foreground">{entry.employeeNumber}</p>
                    </td>
                    <td className="px-2 py-2">{entry.presentDays}</td>
                    <td className="px-2 py-2">{entry.absentDays}</td>
                    <td className="px-2 py-2">{entry.tardinessMins} min</td>
                    <td className="px-2 py-2">{entry.undertimeMins} min</td>
                    <td className="px-2 py-2">{(entry.overtimeHours ?? 0).toFixed(2)} h</td>
                    <td className="px-2 py-2">{(entry.ctoConversionHours ?? 0).toFixed(2)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={summaryPageSize}
                onValueChange={(value) => {
                  setSummaryPageSize(value)
                  setSummaryPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[84px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>
                Page {safeSummaryPage} of {summaryTotalPages} • {attendanceDetails.length} records
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeSummaryPage <= 1}
                onClick={() => setSummaryPage((previous) => Math.max(1, previous - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeSummaryPage >= summaryTotalPages}
                onClick={() => setSummaryPage((previous) => Math.min(summaryTotalPages, previous + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={handleValidate}>
          Run Validation
        </Button>
        <Button type="button" disabled={isPending || !canProceed} onClick={() => setConfirmProceedOpen(true)}>
          Proceed to Next Step
        </Button>
      </div>

      <AlertDialog open={confirmProceedOpen} onOpenChange={setConfirmProceedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed to Calculation Step?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that you reviewed the validation results and attendance summary. This will advance the payroll run to the calculation step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                handleProceed()
              }}
            >
              {isPending ? "Proceeding..." : "Yes, Proceed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
