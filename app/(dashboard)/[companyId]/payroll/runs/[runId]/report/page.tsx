import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { PayrollRegisterPreviewClient } from "@/modules/payroll/components/payroll-register-preview-client"
import { buildPayrollRegisterReportData } from "@/modules/payroll/utils/build-payroll-register-csv"

type PayrollRegisterReportPageProps = {
  params: Promise<{ companyId: string; runId: string }>
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

export default async function PayrollRegisterReportPage({ params }: PayrollRegisterReportPageProps) {
  const { companyId, runId } = await params

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      redirect("/login")
    }
    throw error
  }

  if (!hasModuleAccess(company.companyRole as CompanyRole, "payroll")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  const run = await db.payrollRun.findFirst({
    where: {
      id: runId,
      companyId: company.companyId,
    },
    select: {
      id: true,
      runNumber: true,
      runTypeCode: true,
      payPeriod: {
        select: {
          cutoffStartDate: true,
          cutoffEndDate: true,
        },
      },
      payslips: {
        select: {
          departmentSnapshotName: true,
          employee: {
            select: {
              employeeNumber: true,
              firstName: true,
              lastName: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          basicPay: true,
          sssEmployee: true,
          philHealthEmployee: true,
          pagIbigEmployee: true,
          withholdingTax: true,
          netPay: true,
          earnings: {
            select: {
              description: true,
              amount: true,
              earningType: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
          deductions: {
            select: {
              description: true,
              amount: true,
              deductionType: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!run) {
    redirect(`/${company.companyId}/payroll/runs`)
  }

  const report = buildPayrollRegisterReportData({
    rows: run.payslips.map((payslip) => ({
      employeeNumber: payslip.employee.employeeNumber,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      departmentName: payslip.departmentSnapshotName ?? payslip.employee.department?.name ?? null,
      periodStart: run.payPeriod.cutoffStartDate,
      periodEnd: run.payPeriod.cutoffEndDate,
      basicPay: payslip.basicPay,
      sss: payslip.sssEmployee,
      philHealth: payslip.philHealthEmployee,
      pagIbig: payslip.pagIbigEmployee,
      tax: payslip.withholdingTax,
      netPay: payslip.netPay,
      earnings: payslip.earnings.map((line) => ({
        code: line.earningType.code,
        name: line.earningType.name,
        description: line.description ?? line.earningType.name,
        amount: line.amount,
      })),
      deductions: payslip.deductions.map((line) => ({
        code: line.deductionType.code,
        name: line.deductionType.name,
        description: line.description ?? line.deductionType.name,
        amount: line.amount,
      })),
    })),
  })

  return (
    <PayrollRegisterPreviewClient
      companyId={company.companyId}
      runId={run.id}
      runNumber={run.runNumber}
      runTypeCode={run.runTypeCode}
      companyName={company.companyName}
      periodLabel={`${toDateLabel(run.payPeriod.cutoffStartDate)} - ${toDateLabel(run.payPeriod.cutoffEndDate)}`}
      generatedAt={toDateTimeLabel(new Date())}
      report={report}
    />
  )
}
