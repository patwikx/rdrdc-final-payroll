import { PayrollRunStatus } from "@prisma/client"

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

export type PayrollAdjustmentsViewModel = {
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
    employeeId: string
    employeeNumber: string
    employeeName: string
    grossPay: string
    totalDeductions: string
    netPay: string
    adjustmentCount: number
    runNumber: string
  }>
}

export async function getPayrollAdjustmentsViewModel(
  companyId: string,
  selectedRunId?: string
): Promise<PayrollAdjustmentsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const runs = await db.payrollRun.findMany({
    where: {
      companyId: context.companyId,
      statusCode: {
        in: [PayrollRunStatus.COMPUTED, PayrollRunStatus.FOR_REVIEW],
      },
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
    take: 30,
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
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          payrollRun: {
            select: {
              runNumber: true,
            },
          },
          earnings: {
            where: {
              earningType: {
                code: "ADJUSTMENT",
              },
            },
            select: {
              id: true,
            },
          },
          deductions: {
            where: {
              OR: [{ referenceType: "ADJUSTMENT" }, { deductionType: { code: "ADJUSTMENT" } }],
            },
            select: {
              id: true,
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
      employeeId: payslip.employeeId,
      employeeNumber: payslip.employee.employeeNumber,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      grossPay: amount.format(toNumber(payslip.grossPay)),
      totalDeductions: amount.format(toNumber(payslip.totalDeductions)),
      netPay: amount.format(toNumber(payslip.netPay)),
      adjustmentCount: payslip.earnings.length + payslip.deductions.length,
      runNumber: payslip.payrollRun.runNumber,
    })),
  }
}
