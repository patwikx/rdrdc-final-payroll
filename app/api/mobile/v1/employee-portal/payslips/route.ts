import { NextRequest } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { requireMobileSession, getMobileEmployeeContext } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

const isoDate = (value: Date | null): string | null => (value ? value.toISOString() : null)
const toNumber = (value: { toString(): string } | number): number => Number(value)

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

export async function GET(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const queryParsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!queryParsed.success) {
    return mobileError(queryParsed.error.issues[0]?.message ?? "Invalid payslip query payload.", 400)
  }

  const companyId = resolveCompanyId(session.context.user.companyId, session.context.claims.companyId)
  const employee = await getMobileEmployeeContext({
    userId: session.context.user.id,
    companyId,
  })

  if (!employee) {
    return mobileError("Employee profile not found for the active company.", 404)
  }

  const payslips = await db.payslip.findMany({
    where: {
      employeeId: employee.id,
      payrollRun: {
        companyId,
        isTrialRun: false,
      },
    },
    orderBy: { generatedAt: "desc" },
    take: queryParsed.data.limit,
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

  return mobileOk(
    {
      rows: payslips.map((item) => ({
        id: item.id,
        payslipNumber: item.payslipNumber,
        generatedAt: item.generatedAt.toISOString(),
        releasedAt: isoDate(item.releasedAt),
        periodNumber: item.payrollRun.payPeriod.periodNumber,
        cutoffStartDate: item.payrollRun.payPeriod.cutoffStartDate.toISOString(),
        cutoffEndDate: item.payrollRun.payPeriod.cutoffEndDate.toISOString(),
        basicPay: toNumber(item.basicPay),
        grossPay: toNumber(item.grossPay),
        totalDeductions: toNumber(item.totalDeductions),
        netPay: toNumber(item.netPay),
        ytdGrossPay: toNumber(item.ytdGrossPay),
        ytdTaxWithheld: toNumber(item.ytdTaxWithheld),
        ytdNetPay: toNumber(item.ytdNetPay),
        sssEmployee: toNumber(item.sssEmployee),
        philHealthEmployee: toNumber(item.philHealthEmployee),
        pagIbigEmployee: toNumber(item.pagIbigEmployee),
        withholdingTax: toNumber(item.withholdingTax),
        daysWorked: toNumber(item.daysWorked),
        daysAbsent: toNumber(item.daysAbsent),
        overtimeHours: toNumber(item.overtimeHours),
        tardinessMins: item.tardinessMins,
        downloadUrl: `/${companyId}/employee-portal/payslips/${item.id}/download`,
        earnings: item.earnings.map((earning) => ({
          id: earning.id,
          name: earning.earningType.name,
          description: earning.description,
          amount: toNumber(earning.amount),
        })),
        deductions: item.deductions.map((deduction) => ({
          id: deduction.id,
          name: deduction.deductionType.name,
          description: deduction.description,
          amount: toNumber(deduction.amount),
        })),
      })),
    },
    "Payslips loaded."
  )
}
