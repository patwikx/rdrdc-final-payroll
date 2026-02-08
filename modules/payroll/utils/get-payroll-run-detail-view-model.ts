import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const toDateTimeLabel = (value: Date | null): string => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

export type PayrollRunDetailViewModel = {
  companyId: string
  companyName: string
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

export async function getPayrollRunDetailViewModel(companyId: string, runId: string): Promise<PayrollRunDetailViewModel | null> {
  const context = await getActiveCompanyContext({ companyId })

  const run = await db.payrollRun.findFirst({
    where: {
      id: runId,
      companyId: context.companyId,
    },
    include: {
      payPeriod: {
        select: {
          cutoffStartDate: true,
          cutoffEndDate: true,
          statusCode: true,
        },
      },
      processSteps: {
        orderBy: { stepNumber: "asc" },
        select: {
          stepNumber: true,
          stepName: true,
          status: true,
          isCompleted: true,
          completedAt: true,
          notes: true,
        },
      },
      payslips: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          earnings: {
            include: {
              earningType: {
                select: {
                  name: true,
                },
              },
            },
          },
          deductions: {
            include: {
              deductionType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  })

  if (!run) {
    return null
  }

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    run: {
      id: run.id,
      runNumber: run.runNumber,
      runTypeCode: run.runTypeCode,
      statusCode: run.statusCode,
      isLocked: run.payPeriod.statusCode === "LOCKED",
      currentStepNumber: run.currentStepNumber,
      currentStepName: run.currentStepName,
      totalEmployees: run.totalEmployees,
      totalGrossPay: toNumber(run.totalGrossPay),
      totalDeductions: toNumber(run.totalDeductions),
      totalNetPay: toNumber(run.totalNetPay),
      createdAt: toDateTimeLabel(run.createdAt),
      processedAt: toDateTimeLabel(run.processedAt),
      approvedAt: toDateTimeLabel(run.approvedAt),
      paidAt: toDateTimeLabel(run.paidAt),
      periodLabel: `${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)}`,
      processSteps: run.processSteps.map((step) => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        status: step.status,
        isCompleted: step.isCompleted,
        completedAt: toDateTimeLabel(step.completedAt),
        notes: step.notes ?? "",
      })),
      payslips: run.payslips.map((payslip) => ({
        id: payslip.id,
        employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
        employeeNumber: payslip.employee.employeeNumber,
        grossPay: toNumber(payslip.grossPay),
        totalDeductions: toNumber(payslip.totalDeductions),
        netPay: toNumber(payslip.netPay),
        status: toNumber(payslip.netPay) <= 0 || toNumber(payslip.grossPay) <= 0 ? "CHECK" : "READY",
        earnings: payslip.earnings
          .filter((entry) => toNumber(entry.amount) > 0)
          .map((entry) => ({
            id: entry.id,
            name: entry.description ?? entry.earningType.name,
            amount: toNumber(entry.amount),
          })),
        deductionDetails: payslip.deductions
          .filter((entry) => toNumber(entry.amount) > 0)
          .map((entry) => ({
            id: entry.id,
            name: entry.description ?? entry.deductionType.name,
            amount: toNumber(entry.amount),
          })),
      })),
    },
  }
}
