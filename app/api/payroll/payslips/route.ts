import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { resolvePayslipGeneratedAtRange } from "@/lib/payroll-payslip-date-range"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const amountNumber = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toPhpAmount = (value: number): string => `PHP ${amountNumber.format(value)}`

const toDateLabel = (value: Date): string => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateTimeLabel = (value: Date | null): string => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toPayslipDisplayId = (value: string): string => {
  if (value.startsWith("PSL-")) return value
  if (value.startsWith("RUN-")) return value.replace("RUN-", "PSL-")
  return `PSL-${value}`
}

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const companyId = params.get("companyId")

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 })
  }

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1)
  const pageSize = Math.min(50, Math.max(5, Number(params.get("pageSize") ?? "20") || 20))
  const search = (params.get("search") ?? "").trim()
  const selectedEmployeeIdParam = (params.get("selectedEmployeeId") ?? "").trim()

  const resolvedRange = resolvePayslipGeneratedAtRange(params.get("startDate"), params.get("endDate"))

  if (!resolvedRange.ok) {
    return NextResponse.json({ error: resolvedRange.error }, { status: 400 })
  }
  const { startDate, endDate } = resolvedRange

  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "payroll")) {
    return NextResponse.json({ error: "You do not have payroll access." }, { status: 403 })
  }

  const payslipWhere = {
    payrollRun: {
      companyId: context.companyId,
      isTrialRun: false,
    },
    generatedAt: {
      gte: startDate,
      lte: endDate,
    },
    ...(search
      ? {
          employee: {
            OR: [
              { employeeNumber: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  }

  const [employeeGroups, totals, releasedCount] = await Promise.all([
    db.payslip.groupBy({
      by: ["employeeId"],
      where: payslipWhere,
      _count: { _all: true },
      _max: { generatedAt: true },
      orderBy: { employeeId: "asc" },
    }),
    db.payslip.aggregate({
      where: payslipWhere,
      _count: { _all: true },
      _sum: { netPay: true },
      _max: { releasedAt: true },
    }),
    db.payslip.count({
      where: {
        ...payslipWhere,
        releasedAt: { not: null },
      },
    }),
  ])

  const employeeIds = employeeGroups.map((item) => item.employeeId)
  const employees =
    employeeIds.length > 0
      ? await db.employee.findMany({
          where: {
            id: { in: employeeIds },
            companyId: context.companyId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
          },
        })
      : []

  const employeeMap = new Map(employees.map((row) => [row.id, row]))
  const allEmployeeRows = employeeGroups
    .map((group) => {
      const employee = employeeMap.get(group.employeeId)
      if (!employee) return null
      return {
        employeeId: employee.id,
        employeeName: `${employee.lastName}, ${employee.firstName}`,
        employeeNumber: employee.employeeNumber,
        employeePhotoUrl: employee.photoUrl,
        payslipCount: group._count._all,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))

  const pagedEmployees = allEmployeeRows.slice(0, pageSize)
  const selectedEmployeeId =
    selectedEmployeeIdParam && pagedEmployees.some((row) => row.employeeId === selectedEmployeeIdParam)
      ? selectedEmployeeIdParam
      : (pagedEmployees[0]?.employeeId ?? null)

  const selectedEmployeePayslips = selectedEmployeeId
    ? await db.payslip.findMany({
        where: {
          ...payslipWhere,
          employeeId: selectedEmployeeId,
        },
        include: {
          payrollRun: {
            select: {
              runNumber: true,
              payPeriod: {
                select: {
                  cutoffStartDate: true,
                  cutoffEndDate: true,
                },
              },
            },
          },
        },
        orderBy: [{ generatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    : []

  return NextResponse.json({
    employees: pagedEmployees,
    selectedEmployeeId,
    payslips: selectedEmployeePayslips.map((payslip) => ({
      id: payslip.id,
      payslipNumber: toPayslipDisplayId(payslip.payslipNumber),
      runNumber: payslip.payrollRun.runNumber,
      runPeriodLabel: `${toDateLabel(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${toDateLabel(payslip.payrollRun.payPeriod.cutoffEndDate)}`,
      grossPay: toPhpAmount(toNumber(payslip.grossPay)),
      totalDeductions: toPhpAmount(toNumber(payslip.totalDeductions)),
      netPay: toPhpAmount(toNumber(payslip.netPay)),
      releasedAt: toDateTimeLabel(payslip.releasedAt),
    })),
    stats: {
      totalEmployees: allEmployeeRows.length,
      totalPayslips: totals._count._all,
      totalNet: toPhpAmount(toNumber(totals._sum.netPay)),
      releasedCount,
    },
    page,
    pageSize,
    hasMorePayslips: selectedEmployeePayslips.length === pageSize,
  })
}
