import { db } from "@/lib/db"
import { PayrollRunType } from "@prisma/client"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
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

export type PayrollPayslipDetailViewModel = {
  companyId: string
  companyName: string
  payslip: {
    id: string
    payslipNumber: string
    employeeName: string
    employeeNumber: string
    runId: string
    runNumber: string
    periodLabel: string
    semiMonthlyBase: string
    basicPay: string
    grossPay: string
    totalDeductions: string
    netPay: string
    daysWorked: number
    daysAbsent: number
    overtimeHours: number
    tardinessMins: number
    undertimeMins: number
    nightDiffHours: number
    sssEmployee: string
    philHealthEmployee: string
    pagIbigEmployee: string
    withholdingTax: string
    earnings: Array<{
      id: string
      description: string
      amount: string
      isTaxable: boolean
    }>
    deductions: Array<{
      id: string
      description: string
      amount: string
      referenceType: string
    }>
  }
}

export async function getPayrollPayslipDetailViewModel(
  companyId: string,
  payslipId: string
): Promise<PayrollPayslipDetailViewModel | null> {
  const context = await getActiveCompanyContext({ companyId })

  const payslip = await db.payslip.findFirst({
    where: {
      id: payslipId,
      payrollRun: {
        companyId: context.companyId,
        runTypeCode: {
          not: PayrollRunType.TRIAL_RUN,
        },
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
          id: true,
          runNumber: true,
          payPeriod: {
            select: {
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
      earnings: {
        orderBy: [{ createdAt: "asc" }],
      },
      deductions: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  })

  if (!payslip) {
    return null
  }

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    payslip: {
      id: payslip.id,
      payslipNumber: toPayslipDisplayId(payslip.payslipNumber),
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      runId: payslip.payrollRun.id,
      runNumber: payslip.payrollRun.runNumber,
      periodLabel: `${toDateLabel(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${toDateLabel(payslip.payrollRun.payPeriod.cutoffEndDate)}`,
      semiMonthlyBase: toPhpAmount(toNumber(payslip.baseSalary) / 2),
      basicPay: toPhpAmount(toNumber(payslip.basicPay)),
      grossPay: toPhpAmount(toNumber(payslip.grossPay)),
      totalDeductions: toPhpAmount(toNumber(payslip.totalDeductions)),
      netPay: toPhpAmount(toNumber(payslip.netPay)),
      daysWorked: toNumber(payslip.daysWorked),
      daysAbsent: toNumber(payslip.daysAbsent),
      overtimeHours: toNumber(payslip.overtimeHours),
      tardinessMins: payslip.tardinessMins,
      undertimeMins: payslip.undertimeMins,
      nightDiffHours: toNumber(payslip.nightDiffHours),
      sssEmployee: toPhpAmount(toNumber(payslip.sssEmployee)),
      philHealthEmployee: toPhpAmount(toNumber(payslip.philHealthEmployee)),
      pagIbigEmployee: toPhpAmount(toNumber(payslip.pagIbigEmployee)),
      withholdingTax: toPhpAmount(toNumber(payslip.withholdingTax)),
      earnings: payslip.earnings.map((entry) => ({
        id: entry.id,
        description: entry.description ?? "Earning",
        amount: toPhpAmount(toNumber(entry.amount)),
        isTaxable: entry.isTaxable,
      })),
      deductions: payslip.deductions.map((entry) => ({
        id: entry.id,
        description: entry.description ?? "Deduction",
        amount: toPhpAmount(toNumber(entry.amount)),
        referenceType: entry.referenceType ?? "OTHER",
      })),
    },
  }
}
