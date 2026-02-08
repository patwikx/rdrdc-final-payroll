import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { buildPayrollRegisterCsv } from "@/modules/payroll/utils/build-payroll-register-csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
    runId: string
  }>
}

const toDateStamp = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .replace(/\//g, "")
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId, runId } = await context.params
  const auditMeta = getRequestAuditMetadata(request)

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "payroll")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const run = await db.payrollRun.findFirst({
      where: {
        id: runId,
        companyId: activeCompany.companyId,
      },
      select: {
        id: true,
        runNumber: true,
        payPeriod: {
          select: {
            cutoffStartDate: true,
            cutoffEndDate: true,
          },
        },
        payslips: {
          select: {
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
            totalDeductions: true,
            netPay: true,
            earnings: {
              select: {
                description: true,
                amount: true,
                earningType: {
                  select: {
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
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 })
    }

    const csv = buildPayrollRegisterCsv({
      rows: run.payslips.map((payslip) => ({
        employeeNumber: payslip.employee.employeeNumber,
        employeeName: `${payslip.employee.lastName}, ${payslip.employee.firstName}`,
        departmentName: payslip.employee.department?.name ?? null,
        periodStart: run.payPeriod.cutoffStartDate,
        periodEnd: run.payPeriod.cutoffEndDate,
        basicPay: payslip.basicPay,
        sss: payslip.sssEmployee,
        philHealth: payslip.philHealthEmployee,
        pagIbig: payslip.pagIbigEmployee,
        tax: payslip.withholdingTax,
        totalDeductions: payslip.totalDeductions,
        netPay: payslip.netPay,
        earnings: payslip.earnings.map((line) => ({
          description: line.description ?? line.earningType.name,
          amount: line.amount,
        })),
        deductions: payslip.deductions.map((line) => ({
          description: line.description ?? line.deductionType.name,
          amount: line.amount,
        })),
      })),
    })

    await createAuditLog({
      tableName: "PayrollRun",
      recordId: run.id,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_PAYROLL_REGISTER_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "reportType", newValue: "payroll-register-csv" },
        { fieldName: "runNumber", newValue: run.runNumber },
      ],
    })

    const fileName = `payroll-register-${run.runNumber}-${toDateStamp(new Date())}.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Unable to export payroll register." }, { status: 500 })
  }
}
