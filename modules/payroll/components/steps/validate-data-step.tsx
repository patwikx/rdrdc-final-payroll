"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconAlertTriangle, IconLoader2, IconTerminal2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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

      toast.success(result.message)
      router.refresh()
    })
  }

  const canProceed = (parsedNotes?.errorCount ?? 0) === 0 && Boolean(parsedNotes)
  const attendanceDetails = parsedNotes?.dtrSummary?.details ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold text-foreground">Payroll Data Validation</h2>
        <p className="text-sm text-muted-foreground">Automated checks on attendance, payroll profile readiness, and request diagnostics.</p>
      </div>

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

      {parsedNotes ? (
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-4 text-sm">
          {(parsedNotes.errors ?? []).slice(0, 4).map((error) => (
            <p key={error} className="flex items-start gap-2 text-xs text-destructive"><IconAlertTriangle className="mt-0.5 h-3.5 w-3.5" /> {error}</p>
          ))}
          {(parsedNotes.warnings ?? []).slice(0, 4).map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-xs text-amber-600"><IconAlertTriangle className="mt-0.5 h-3.5 w-3.5" /> {warning}</p>
          ))}

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
                {attendanceDetails.map((entry) => (
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
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={handleValidate}>
          Run Validation
        </Button>
        <Button type="button" disabled={isPending || !canProceed} onClick={handleProceed}>
          Proceed to Next Step
        </Button>
      </div>
    </div>
  )
}
