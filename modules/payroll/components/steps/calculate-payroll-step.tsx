"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconCalculator, IconCircleCheck, IconProgress } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { calculatePayrollRunAction, proceedToReviewPayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"

type CalculatePayrollStepProps = {
  companyId: string
  runId: string
  employeeCount: number
  totalNetPay: number
  calculationNotes: string
}

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "code" })

export function CalculatePayrollStep({ companyId, runId, employeeCount, totalNetPay, calculationNotes }: CalculatePayrollStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const calculatedEmployees = useMemo(() => {
    if (!calculationNotes) return []
    try {
      const parsed = JSON.parse(calculationNotes) as {
        employeeSummaries?: Array<{
          employeeId: string
          employeeNumber: string
          employeeName: string
          grossPay: number
          totalDeductions: number
          netPay: number
        }>
      }
      return parsed.employeeSummaries ?? []
    } catch {
      return []
    }
  }, [calculationNotes])

  const handleCalculate = () => {
    setProgress(15)

    startTransition(async () => {
      const timer = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 250)

      const result = await calculatePayrollRunAction({ companyId, runId })
      clearInterval(timer)

      if (!result.ok) {
        setProgress(0)
        toast.error(result.error)
        return
      }

      setProgress(100)
      setIsComplete(true)
      toast.success(result.message)
      router.refresh()
    })
  }

  const handleProceed = () => {
    startTransition(async () => {
      const result = await proceedToReviewPayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        {calculatedEmployees.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Calculated Employee Payroll Summary</p>
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left">Employee</th>
                    <th className="px-2 py-2 text-left">Gross</th>
                    <th className="px-2 py-2 text-left">Deductions</th>
                    <th className="px-2 py-2 text-left">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedEmployees.map((entry) => (
                    <tr key={entry.employeeId} className="border-t border-border/50">
                      <td className="px-2 py-2">
                        <p className="font-medium">{entry.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{entry.employeeNumber}</p>
                      </td>
                      <td className="px-2 py-2">{money.format(entry.grossPay)}</td>
                      <td className="px-2 py-2">{money.format(entry.totalDeductions)}</td>
                      <td className="px-2 py-2 font-semibold">{money.format(entry.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : progress > 0 ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              {isComplete ? <IconCircleCheck className="h-4 w-4 text-emerald-600" /> : <IconProgress className="h-4 w-4 text-primary" />}
              {isComplete ? "Calculation Complete" : "Processing Gross-to-Net"}
            </p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center">
            <IconCalculator className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Ready to process payroll calculation.</p>
            <p className="mt-1 text-xs text-muted-foreground">This computes attendance-adjusted pay, statutory deductions, recurring deductions, and payslip lines.</p>
          </div>
        )}
      </div>

      <aside className="space-y-3 lg:col-span-4">
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4 text-sm">
          <p className="font-medium">Current Totals</p>
          <div className="flex items-center justify-between"><span>Employees</span><span>{employeeCount}</span></div>
          <div className="flex items-center justify-between"><span>Net Pay</span><span>{money.format(totalNetPay)}</span></div>
        </div>
        {calculatedEmployees.length > 0 ? (
          <Button type="button" className="w-full" disabled={isPending} onClick={handleProceed}>
            Proceed to Next Step
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled={isPending} onClick={handleCalculate}>
            Run Calculation
          </Button>
        )}
      </aside>
    </div>
  )
}
