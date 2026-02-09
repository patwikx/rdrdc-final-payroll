import { redirect } from "next/navigation"
import { PayrollRunType } from "@prisma/client"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { PayslipsClient } from "@/modules/employee-portal/components/payslips-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type PayslipsPageProps = {
  params: Promise<{ companyId: string }>
}

const isoDate = (value: Date | null): string | null => (value ? value.toISOString() : null)

export default async function PayslipsPage({ params }: PayslipsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (context.companyRole !== "EMPLOYEE") {
    redirect(`/${context.companyId}/dashboard`)
  }

  if (!context.employee) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Your account is not linked to an employee profile for this company yet.
        </CardContent>
      </Card>
    )
  }

  const payslips = await db.payslip.findMany({
    where: {
      employeeId: context.employee.id,
      payrollRun: {
        companyId: context.companyId,
        runTypeCode: { not: PayrollRunType.TRIAL_RUN },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      payslipNumber: true,
      generatedAt: true,
      releasedAt: true,
      basicPay: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      ytdGrossPay: true,
      ytdTaxWithheld: true,
      ytdNetPay: true,
      sssEmployee: true,
      philHealthEmployee: true,
      pagIbigEmployee: true,
      withholdingTax: true,
      daysWorked: true,
      daysAbsent: true,
      overtimeHours: true,
      tardinessMins: true,
      payrollRun: {
        select: {
          payPeriod: {
            select: {
              periodNumber: true,
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
      earnings: {
        select: {
          id: true,
          description: true,
          amount: true,
          earningType: { select: { name: true } },
        },
      },
      deductions: {
        select: {
          id: true,
          description: true,
          amount: true,
          deductionType: { select: { name: true } },
        },
      },
    },
  })

  return (
    <PayslipsClient
      companyId={context.companyId}
      payslips={payslips.map((item) => ({
        id: item.id,
        payslipNumber: item.payslipNumber,
        generatedAt: item.generatedAt.toISOString(),
        releasedAt: isoDate(item.releasedAt),
        periodNumber: item.payrollRun.payPeriod.periodNumber,
        cutoffStartDate: item.payrollRun.payPeriod.cutoffStartDate.toISOString(),
        cutoffEndDate: item.payrollRun.payPeriod.cutoffEndDate.toISOString(),
        basicPay: Number(item.basicPay),
        grossPay: Number(item.grossPay),
        totalDeductions: Number(item.totalDeductions),
        netPay: Number(item.netPay),
        ytdGrossPay: Number(item.ytdGrossPay),
        ytdTaxWithheld: Number(item.ytdTaxWithheld),
        ytdNetPay: Number(item.ytdNetPay),
        sssEmployee: Number(item.sssEmployee),
        philHealthEmployee: Number(item.philHealthEmployee),
        pagIbigEmployee: Number(item.pagIbigEmployee),
        withholdingTax: Number(item.withholdingTax),
        daysWorked: Number(item.daysWorked),
        daysAbsent: Number(item.daysAbsent),
        overtimeHours: Number(item.overtimeHours),
        tardinessMins: item.tardinessMins,
        earnings: item.earnings.map((earning) => ({
          id: earning.id,
          name: earning.earningType.name,
          description: earning.description,
          amount: Number(earning.amount),
        })),
        deductions: item.deductions.map((deduction) => ({
          id: deduction.id,
          name: deduction.deductionType.name,
          description: deduction.description,
          amount: Number(deduction.amount),
        })),
      }))}
    />
  )
}
