import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

export type PayrollStatutoryViewModel = {
  companyId: string
  companyName: string
  selectedRunId: string | null
  runs: Array<{
    id: string
    label: string
    statusCode: string
  }>
  totals: {
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }
  rows: Array<{
    payslipId: string
    employeeName: string
    employeeNumber: string
    sssEmployee: string
    sssEmployer: string
    philHealthEmployee: string
    philHealthEmployer: string
    pagIbigEmployee: string
    pagIbigEmployer: string
    withholdingTax: string
  }>
}

export async function getPayrollStatutoryViewModel(
  companyId: string,
  selectedRunId?: string
): Promise<PayrollStatutoryViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const runs = await db.payrollRun.findMany({
    where: { companyId: context.companyId },
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
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      })
    : []

  const totalsRaw = payslips.reduce(
    (acc, payslip) => {
      acc.sssEmployee += toNumber(payslip.sssEmployee)
      acc.sssEmployer += toNumber(payslip.sssEmployer)
      acc.philHealthEmployee += toNumber(payslip.philHealthEmployee)
      acc.philHealthEmployer += toNumber(payslip.philHealthEmployer)
      acc.pagIbigEmployee += toNumber(payslip.pagIbigEmployee)
      acc.pagIbigEmployer += toNumber(payslip.pagIbigEmployer)
      acc.withholdingTax += toNumber(payslip.withholdingTax)
      return acc
    },
    {
      sssEmployee: 0,
      sssEmployer: 0,
      philHealthEmployee: 0,
      philHealthEmployer: 0,
      pagIbigEmployee: 0,
      pagIbigEmployer: 0,
      withholdingTax: 0,
    }
  )

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    selectedRunId: resolvedRunId,
    runs: runs.map((run) => ({
      id: run.id,
      statusCode: run.statusCode,
      label: `${run.runNumber} (${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)})`,
    })),
    totals: {
      sssEmployee: money.format(totalsRaw.sssEmployee),
      sssEmployer: money.format(totalsRaw.sssEmployer),
      philHealthEmployee: money.format(totalsRaw.philHealthEmployee),
      philHealthEmployer: money.format(totalsRaw.philHealthEmployer),
      pagIbigEmployee: money.format(totalsRaw.pagIbigEmployee),
      pagIbigEmployer: money.format(totalsRaw.pagIbigEmployer),
      withholdingTax: money.format(totalsRaw.withholdingTax),
    },
    rows: payslips.map((payslip) => ({
      payslipId: payslip.id,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      sssEmployee: money.format(toNumber(payslip.sssEmployee)),
      sssEmployer: money.format(toNumber(payslip.sssEmployer)),
      philHealthEmployee: money.format(toNumber(payslip.philHealthEmployee)),
      philHealthEmployer: money.format(toNumber(payslip.philHealthEmployer)),
      pagIbigEmployee: money.format(toNumber(payslip.pagIbigEmployee)),
      pagIbigEmployer: money.format(toNumber(payslip.pagIbigEmployer)),
      withholdingTax: money.format(toNumber(payslip.withholdingTax)),
    })),
  }
}
