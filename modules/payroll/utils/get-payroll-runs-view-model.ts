import { PayrollRunType } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

export type PayrollRunsViewModel = {
  companyId: string
  companyName: string
  runs: Array<{
    id: string
    runNumber: string
    runTypeCode: PayrollRunType
    statusCode: string
    isLocked: boolean
    currentStepNumber: number
    currentStepName: string
    periodLabel: string
    cutoffStartLabel: string
    cutoffEndLabel: string
    periodYear: number
    totalEmployees: number
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
    createdAt: string
  }>
}

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateTimeLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

export async function getPayrollRunsViewModel(companyId: string): Promise<PayrollRunsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const runs = await db.payrollRun.findMany({
    where: { companyId: context.companyId },
    include: {
      payPeriod: {
        select: {
          cutoffStartDate: true,
          cutoffEndDate: true,
          statusCode: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  })

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    runs: runs.map((run) => ({
      id: run.id,
      runNumber: run.runNumber,
      runTypeCode: run.runTypeCode,
      statusCode: run.statusCode,
      isLocked: run.payPeriod.statusCode === "LOCKED",
      currentStepNumber: run.currentStepNumber,
      currentStepName: run.currentStepName,
      periodLabel: `${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)}`,
      cutoffStartLabel: toDateLabel(run.payPeriod.cutoffStartDate),
      cutoffEndLabel: toDateLabel(run.payPeriod.cutoffEndDate),
      periodYear: run.payPeriod.cutoffEndDate.getUTCFullYear(),
      totalEmployees: run.totalEmployees,
      totalGrossPay: toNumber(run.totalGrossPay),
      totalDeductions: toNumber(run.totalDeductions),
      totalNetPay: toNumber(run.totalNetPay),
      createdAt: toDateTimeLabel(run.createdAt),
    })),
  }
}
