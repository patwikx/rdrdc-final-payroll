import { db } from "@/lib/db"
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

const amount = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })

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
      payslipNumber: payslip.payslipNumber,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      runId: payslip.payrollRun.id,
      runNumber: payslip.payrollRun.runNumber,
      periodLabel: `${toDateLabel(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${toDateLabel(payslip.payrollRun.payPeriod.cutoffEndDate)}`,
      basicPay: amount.format(toNumber(payslip.basicPay)),
      grossPay: amount.format(toNumber(payslip.grossPay)),
      totalDeductions: amount.format(toNumber(payslip.totalDeductions)),
      netPay: amount.format(toNumber(payslip.netPay)),
      daysWorked: toNumber(payslip.daysWorked),
      daysAbsent: toNumber(payslip.daysAbsent),
      overtimeHours: toNumber(payslip.overtimeHours),
      tardinessMins: payslip.tardinessMins,
      undertimeMins: payslip.undertimeMins,
      nightDiffHours: toNumber(payslip.nightDiffHours),
      sssEmployee: amount.format(toNumber(payslip.sssEmployee)),
      philHealthEmployee: amount.format(toNumber(payslip.philHealthEmployee)),
      pagIbigEmployee: amount.format(toNumber(payslip.pagIbigEmployee)),
      withholdingTax: amount.format(toNumber(payslip.withholdingTax)),
      earnings: payslip.earnings.map((entry) => ({
        id: entry.id,
        description: entry.description ?? "Earning",
        amount: amount.format(toNumber(entry.amount)),
        isTaxable: entry.isTaxable,
      })),
      deductions: payslip.deductions.map((entry) => ({
        id: entry.id,
        description: entry.description ?? "Deduction",
        amount: amount.format(toNumber(entry.amount)),
        referenceType: entry.referenceType ?? "OTHER",
      })),
    },
  }
}
