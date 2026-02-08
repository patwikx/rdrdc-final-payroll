"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { IconArrowLeft, IconCalendarTime, IconLock, IconPlayerPlay, IconRosetteDiscountCheck } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProcessStepper } from "@/modules/payroll/components/process-stepper"
import { CalculatePayrollStep } from "@/modules/payroll/components/steps/calculate-payroll-step"
import { CloseRunStep } from "@/modules/payroll/components/steps/close-run-step"
import { GeneratePayslipsStep } from "@/modules/payroll/components/steps/generate-payslips-step"
import { ReviewAdjustStep } from "@/modules/payroll/components/steps/review-adjust-step"
import { ValidateDataStep } from "@/modules/payroll/components/steps/validate-data-step"

type PayrollRunDetailClientProps = {
  companyId: string
  run: {
    id: string
    runNumber: string
    runTypeCode: string
    statusCode: string
    isLocked: boolean
    currentStepNumber: number
    currentStepName: string
    totalEmployees: number
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
    createdAt: string
    processedAt: string
    approvedAt: string
    paidAt: string
    periodLabel: string
    processSteps: Array<{
      stepNumber: number
      stepName: string
      status: string
      isCompleted: boolean
      completedAt: string
      notes: string
    }>
    payslips: Array<{
      id: string
      employeeName: string
      employeeNumber: string
      grossPay: number
      totalDeductions: number
      netPay: number
      status: string
      earnings: Array<{ id: string; name: string; amount: number }>
      deductionDetails: Array<{ id: string; name: string; amount: number }>
    }>
  }
}

const steps = [
  { stepNumber: 1, title: "Setup" },
  { stepNumber: 2, title: "Validate" },
  { stepNumber: 3, title: "Calculate" },
  { stepNumber: 4, title: "Review" },
  { stepNumber: 5, title: "Payslips" },
  { stepNumber: 6, title: "Close" },
]

export function PayrollRunDetailClient({ companyId, run }: PayrollRunDetailClientProps) {
  const router = useRouter()

  const validationStepNotes = useMemo(() => {
    return run.processSteps.find((step) => step.stepNumber === 2)?.notes ?? ""
  }, [run.processSteps])

  const calculationStepNotes = useMemo(() => {
    return run.processSteps.find((step) => step.stepNumber === 3)?.notes ?? ""
  }, [run.processSteps])

  const isPayslipsGenerated = useMemo(() => {
    return run.processSteps.find((step) => step.stepNumber === 5)?.isCompleted ?? false
  }, [run.processSteps])

  const displayStatus = run.isLocked && run.statusCode === "PAID" ? "LOCKED" : run.statusCode

  return (
    <div className="w-full space-y-6">
      <div className="border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payroll</p>
            <h1 className="text-2xl font-semibold text-foreground">Payroll Run #{run.runNumber}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><IconCalendarTime className="h-4 w-4" /> {run.periodLabel}</span>
              <span className="inline-flex items-center gap-1.5"><IconPlayerPlay className="h-4 w-4" /> Step {run.currentStepNumber} of 6</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3">
              {displayStatus === "LOCKED" ? <IconLock className="h-3.5 w-3.5" /> : <IconRosetteDiscountCheck className="h-3.5 w-3.5" />}
              {displayStatus}
            </Badge>
            <Button type="button" variant="outline" onClick={() => router.push(`/${companyId}/payroll/runs`)}>
              <IconArrowLeft className="mr-1.5 h-4 w-4" /> Back to Runs
            </Button>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <ProcessStepper currentStep={run.currentStepNumber} steps={steps} />
      </div>

      {run.currentStepNumber === 2 ? <ValidateDataStep companyId={companyId} runId={run.id} validationNotes={validationStepNotes} /> : null}
      {run.currentStepNumber === 3 ? (
        <CalculatePayrollStep
          companyId={companyId}
          runId={run.id}
          employeeCount={run.totalEmployees}
          totalNetPay={run.totalNetPay}
          calculationNotes={calculationStepNotes}
        />
      ) : null}
      {run.currentStepNumber === 4 ? <ReviewAdjustStep companyId={companyId} runId={run.id} payslips={run.payslips} /> : null}
      {run.currentStepNumber === 5 ? (
        <GeneratePayslipsStep
          companyId={companyId}
          runId={run.id}
          payslipCount={run.payslips.length}
          isGenerated={isPayslipsGenerated}
          payslips={run.payslips.map((payslip) => ({
            id: payslip.id,
            employeeName: payslip.employeeName,
            employeeNumber: payslip.employeeNumber,
          }))}
        />
      ) : null}
      {run.currentStepNumber >= 6 ? (
        <CloseRunStep
          companyId={companyId}
          runId={run.id}
          statusCode={run.statusCode}
          totalEmployees={run.totalEmployees}
          totalDeductions={run.totalDeductions}
          totalNetPay={run.totalNetPay}
        />
      ) : null}
    </div>
  )
}
