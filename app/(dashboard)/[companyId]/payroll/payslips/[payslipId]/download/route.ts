import { NextResponse } from "next/server"
import { PayrollRunType } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { generatePayslipPdfBuffer } from "@/modules/employee-portal/utils/payslip-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
    payslipId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId, payslipId } = await context.params
  const auditMeta = getRequestAuditMetadata(request)

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "payroll")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payslip = await db.payslip.findFirst({
      where: {
        id: payslipId,
        payrollRun: {
          companyId: activeCompany.companyId,
          runTypeCode: { not: PayrollRunType.TRIAL_RUN },
        },
      },
      select: {
        id: true,
        payslipNumber: true,
        generatedAt: true,
        releasedAt: true,
        baseSalary: true,
        basicPay: true,
        grossPay: true,
        totalDeductions: true,
        netPay: true,
        sssEmployee: true,
        philHealthEmployee: true,
        pagIbigEmployee: true,
        withholdingTax: true,
        daysWorked: true,
        daysAbsent: true,
        overtimeHours: true,
        tardinessMins: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        payrollRun: {
          select: {
            company: {
              select: {
                name: true,
                legalName: true,
                logoUrl: true,
                payslipWatermarkText: true,
              },
            },
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
            amount: true,
            earningType: { select: { name: true } },
          },
        },
        deductions: {
          select: {
            amount: true,
            deductionType: { select: { name: true } },
          },
        },
      },
    })

    if (!payslip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 })
    }

    const pdfBuffer = await generatePayslipPdfBuffer({
      payslipNumber: payslip.payslipNumber,
      generatedAt: payslip.generatedAt,
      releasedAt: payslip.releasedAt,
      periodNumber: payslip.payrollRun.payPeriod.periodNumber,
      cutoffStartDate: payslip.payrollRun.payPeriod.cutoffStartDate,
      cutoffEndDate: payslip.payrollRun.payPeriod.cutoffEndDate,
      employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
      employeeNumber: payslip.employee.employeeNumber,
      companyName: payslip.payrollRun.company.name,
      companyLegalName: payslip.payrollRun.company.legalName,
      companyLogoUrl: payslip.payrollRun.company.logoUrl,
      watermarkText: payslip.payrollRun.company.payslipWatermarkText ?? process.env.PAYSLIP_PDF_WATERMARK ?? null,
      baseSalary: Number(payslip.baseSalary),
      basicPay: Number(payslip.basicPay),
      grossPay: Number(payslip.grossPay),
      totalDeductions: Number(payslip.totalDeductions),
      netPay: Number(payslip.netPay),
      sssEmployee: Number(payslip.sssEmployee),
      philHealthEmployee: Number(payslip.philHealthEmployee),
      pagIbigEmployee: Number(payslip.pagIbigEmployee),
      withholdingTax: Number(payslip.withholdingTax),
      daysWorked: Number(payslip.daysWorked),
      daysAbsent: Number(payslip.daysAbsent),
      overtimeHours: Number(payslip.overtimeHours),
      tardinessMins: payslip.tardinessMins,
      earnings: payslip.earnings.map((item) => ({
        name: item.earningType.name,
        amount: Number(item.amount),
      })),
      deductions: payslip.deductions.map((item) => ({
        name: item.deductionType.name,
        amount: Number(item.amount),
      })),
    })

    const fileName = `${payslip.payslipNumber}.pdf`

    await createAuditLog({
      tableName: "Payslip",
      recordId: payslip.id,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "ADMIN_DOWNLOAD_PAYSLIP_PDF",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "downloadedAt", newValue: new Date() },
        { fieldName: "payslipNumber", newValue: payslip.payslipNumber },
      ],
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Unable to generate payslip PDF." }, { status: 500 })
  }
}
