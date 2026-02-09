import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const amountNumber = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toPhpAmount = (value: number): string => `PHP ${amountNumber.format(value)}`

const toPayslipDisplayId = (value: string): string => {
  if (value.startsWith("PSL-")) {
    return value
  }

  if (value.startsWith("RUN-")) {
    return value.replace("RUN-", "PSL-")
  }

  return `PSL-${value}`
}

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
  payslips: Array<{
    id: string
    employeeId: string
    payslipNumber: string
    employeeName: string
    employeeNumber: string
    employeePhotoUrl: string | null
    grossPay: string
    totalDeductions: string
    netPay: string
    releasedAt: string
    generatedAt: string
    runNumber: string
    runPeriodLabel: string
  }>
}

export async function getPayrollPayslipsViewModel(companyId: string): Promise<PayrollPayslipsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const payslips = await db.payslip.findMany({
    where: {
      payrollRun: {
        companyId: context.companyId,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              photoUrl: true,
            },
          },
      payrollRun: {
        select: {
          runNumber: true,
          payPeriod: {
            select: {
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
    },
    orderBy: [{ generatedAt: "desc" }],
  })

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    payslips: payslips.map((payslip) => ({
      id: payslip.id,
      employeeId: payslip.employee.id,
      payslipNumber: toPayslipDisplayId(payslip.payslipNumber),
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      employeePhotoUrl: payslip.employee.photoUrl,
      grossPay: toPhpAmount(toNumber(payslip.grossPay)),
      totalDeductions: toPhpAmount(toNumber(payslip.totalDeductions)),
      netPay: toPhpAmount(toNumber(payslip.netPay)),
      releasedAt: toDateTimeLabel(payslip.releasedAt),
      generatedAt: toDateTimeLabel(payslip.generatedAt),
      runNumber: payslip.payrollRun.runNumber,
      runPeriodLabel: `${toDateLabel(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${toDateLabel(payslip.payrollRun.payPeriod.cutoffEndDate)}`,
    })),
  }
}
