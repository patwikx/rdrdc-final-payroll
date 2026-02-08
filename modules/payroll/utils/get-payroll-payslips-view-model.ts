import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const amount = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
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

export type PayrollPayslipsViewModel = {
  companyId: string
  companyName: string
  selectedRunId: string | null
  runs: Array<{
    id: string
    label: string
    statusCode: string
  }>
  payslips: Array<{
    id: string
    payslipNumber: string
    employeeName: string
    employeeNumber: string
    grossPay: string
    totalDeductions: string
    netPay: string
    releasedAt: string
    generatedAt: string
    runNumber: string
  }>
}

export async function getPayrollPayslipsViewModel(companyId: string, selectedRunId?: string): Promise<PayrollPayslipsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const runs = await db.payrollRun.findMany({
    where: {
      companyId: context.companyId,
    },
    include: {
      payPeriod: {
        select: {
          cutoffStartDate: true,
          cutoffEndDate: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 40,
  })

  const resolvedRunId = runs.some((run) => run.id === selectedRunId) ? selectedRunId ?? null : (runs[0]?.id ?? null)

  const payslips = resolvedRunId
    ? await db.payslip.findMany({
        where: {
          payrollRunId: resolvedRunId,
          payrollRun: {
            companyId: context.companyId,
          },
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          payrollRun: {
            select: {
              runNumber: true,
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      })
    : []

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    selectedRunId: resolvedRunId,
    runs: runs.map((run) => ({
      id: run.id,
      statusCode: run.statusCode,
      label: `${run.runNumber} (${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)})`,
    })),
    payslips: payslips.map((payslip) => ({
      id: payslip.id,
      payslipNumber: payslip.payslipNumber,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      grossPay: amount.format(toNumber(payslip.grossPay)),
      totalDeductions: amount.format(toNumber(payslip.totalDeductions)),
      netPay: amount.format(toNumber(payslip.netPay)),
      releasedAt: toDateTimeLabel(payslip.releasedAt),
      generatedAt: toDateTimeLabel(payslip.generatedAt),
      runNumber: payslip.payrollRun.runNumber,
    })),
  }
}
