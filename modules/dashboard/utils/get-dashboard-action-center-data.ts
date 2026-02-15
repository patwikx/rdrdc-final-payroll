import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { getPhDateParts, toPhDateOnlyUtc } from "@/lib/ph-time"

type ApprovalQueueItem = {
  ref: string
  module: "Overtime" | "Leave" | "Timekeeping" | "Payroll"
  employee: string
  owner: string
  amount: string
  priority: "Low" | "Medium" | "High" | "Critical"
  reviewHref: string
}

type CriticalActionItem = {
  key: "payroll" | "timekeeping" | "leave" | "overtime"
  label: string
  count: number
}

export type DashboardActionCenterData = {
  cycleMode: "current" | "previous" | "month"
  stats: {
    employeesValue: string
    employeesDelta: string
    timekeepingValue: string
    timekeepingDelta: string
    netPayrollValue: string
    netPayrollDelta: string
    leaveOtValue: string
    leaveOtDelta: string
    approvalsValue: string
    approvalsDelta: string
  }
  approvals: ApprovalQueueItem[]
  criticalActions: CriticalActionItem[]
  cycleReadiness: number
  timekeepingExceptions: string[][]
  leaveOtRows: string[][]
  employeeRows: string[][]
  payrollReadiness: {
    attendanceLocked: number
    leaveDeductionsComputed: number
    otPremiumsComputed: number
    approvalComplete: number
    blockers: number
  }
}

const toCurrency = (value: Prisma.Decimal | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "PHP 0"
  }

  const numeric = value instanceof Prisma.Decimal ? value.toNumber() : value

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(numeric)
}

const fullName = (firstName: string, lastName: string): string => `${firstName} ${lastName}`

const daysBetweenInclusive = (start: Date, end: Date): number => {
  if (end.getTime() < start.getTime()) {
    return 0
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const diff = Math.floor((end.getTime() - start.getTime()) / msPerDay)
  return diff + 1
}

const formatPeriodLabel = (start: Date, end: Date): string => {
  const format = (value: Date) =>
    value.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    })

  return `${format(start)} - ${format(end)}`
}

export async function getDashboardActionCenterData(
  companyId: string,
  cycleMode: "current" | "previous" | "month" = "current"
): Promise<DashboardActionCenterData> {
  const todayPh = toPhDateOnlyUtc()

  const companyScopedPayPeriod = await db.payPeriod.findFirst({
    where: {
      cutoffStartDate: { lte: todayPh },
      cutoffEndDate: { gte: todayPh },
      pattern: { companyId },
    },
    orderBy: { cutoffStartDate: "desc" },
  })

  const fallbackPayPeriod = await db.payPeriod.findFirst({
    where: {
      pattern: { companyId },
    },
    orderBy: { cutoffEndDate: "desc" },
  })

  const activePayPeriod = companyScopedPayPeriod ?? fallbackPayPeriod

  let periodStart = activePayPeriod?.cutoffStartDate ?? todayPh
  let periodEnd = activePayPeriod?.cutoffEndDate ?? todayPh

  if (cycleMode === "previous") {
    const previousPayPeriod = await db.payPeriod.findFirst({
      where: {
        pattern: { companyId },
        cutoffEndDate: { lt: periodStart },
      },
      orderBy: { cutoffEndDate: "desc" },
    })

    if (previousPayPeriod) {
      periodStart = previousPayPeriod.cutoffStartDate
      periodEnd = previousPayPeriod.cutoffEndDate
    }
  }

  if (cycleMode === "month") {
    const { year, month } = getPhDateParts(todayPh)
    periodStart = new Date(Date.UTC(year, month - 1, 1))
    periodEnd = new Date(Date.UTC(year, month, 0))
  }

  const periodEffectiveEnd = periodEnd.getTime() < todayPh.getTime() ? periodEnd : todayPh
  const periodLabel = formatPeriodLabel(periodStart, periodEnd)
  const previousPeriodEnd = new Date(periodStart.getTime() - 24 * 60 * 60 * 1000)
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - (periodEnd.getTime() - periodStart.getTime()))

  const [
    activeEmployees,
    newHires,
    pendingLeaveCount,
    pendingOtCount,
    pendingDtrCount,
    pendingPayrollCount,
    latestPayrollRun,
    latestPaidPayrollRun,
    leaveApprovals,
    overtimeApprovals,
    dtrApprovals,
    payrollApprovals,
    timekeepingRecords,
    actualDtrSlots,
  ] = await Promise.all([
    db.employee.count({ where: { companyId, isActive: true, deletedAt: null } }),
    db.employee.count({ where: { companyId, isActive: true, deletedAt: null, hireDate: { gte: periodStart, lte: periodEnd } } }),
    db.leaveRequest.count({ where: { employee: { companyId }, statusCode: { in: ["PENDING", "SUPERVISOR_APPROVED"] }, startDate: { lte: periodEnd }, endDate: { gte: periodStart } } }),
    db.overtimeRequest.count({ where: { employee: { companyId }, statusCode: { in: ["PENDING", "SUPERVISOR_APPROVED"] }, overtimeDate: { gte: periodStart, lte: periodEnd } } }),
    db.dailyTimeRecord.count({ where: { employee: { companyId }, approvalStatusCode: "PENDING", attendanceDate: { gte: periodStart, lte: periodEnd } } }),
    db.payrollRun.count({ where: { companyId, statusCode: { in: ["DRAFT", "VALIDATING", "PROCESSING", "COMPUTED", "FOR_REVIEW"] }, payPeriod: { cutoffStartDate: { lte: periodEnd }, cutoffEndDate: { gte: periodStart } } } }),
    db.payrollRun.findFirst({ where: { companyId, payPeriod: { cutoffStartDate: { lte: periodEnd }, cutoffEndDate: { gte: periodStart } } }, orderBy: { createdAt: "desc" } }),
    db.payrollRun.findFirst({ where: { companyId, statusCode: "PAID", payPeriod: { cutoffEndDate: { gte: previousPeriodStart, lte: previousPeriodEnd } } }, orderBy: { createdAt: "desc" } }),
    db.leaveRequest.findMany({
      where: { employee: { companyId }, statusCode: { in: ["PENDING", "SUPERVISOR_APPROVED"] }, startDate: { lte: periodEnd }, endDate: { gte: periodStart } },
      orderBy: { updatedAt: "desc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    db.overtimeRequest.findMany({
      where: { employee: { companyId }, statusCode: { in: ["PENDING", "SUPERVISOR_APPROVED"] }, overtimeDate: { gte: periodStart, lte: periodEnd } },
      orderBy: { updatedAt: "desc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    db.dailyTimeRecord.findMany({
      where: { employee: { companyId }, approvalStatusCode: "PENDING", attendanceDate: { gte: periodStart, lte: periodEnd } },
      orderBy: { updatedAt: "desc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    db.payrollRun.findMany({
      where: { companyId, statusCode: { in: ["DRAFT", "VALIDATING", "PROCESSING", "COMPUTED", "FOR_REVIEW"] }, payPeriod: { cutoffStartDate: { lte: periodEnd }, cutoffEndDate: { gte: periodStart } } },
      orderBy: { updatedAt: "desc" },
      select: { runNumber: true, totalNetPay: true },
    }),
    db.dailyTimeRecord.findMany({
      where: {
        employee: { companyId },
        attendanceDate: { gte: periodStart, lte: periodEnd },
        OR: [
          { approvalStatusCode: "PENDING" },
          { attendanceStatus: "ABSENT" },
          { tardinessMins: { gt: 0 } },
          { undertimeMins: { gt: 0 } },
        ],
      },
      orderBy: { attendanceDate: "desc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    db.dailyTimeRecord.count({
      where: {
        employee: { companyId },
        attendanceDate: { gte: periodStart, lte: periodEffectiveEnd },
      },
    }),
  ])

  const approvalRows: ApprovalQueueItem[] = [
    ...leaveApprovals.map((item) => ({
      ref: item.requestNumber,
      module: "Leave" as const,
      employee: fullName(item.employee.firstName, item.employee.lastName),
      owner: item.statusCode === "SUPERVISOR_APPROVED" ? "HR" : "Supervisor",
      amount: "-",
      priority: item.statusCode === "SUPERVISOR_APPROVED" ? "High" as const : "Medium" as const,
      reviewHref: `/${companyId}/approvals?kind=LEAVE&q=${encodeURIComponent(item.requestNumber)}`,
    })),
    ...overtimeApprovals.map((item) => ({
      ref: item.requestNumber,
      module: "Overtime" as const,
      employee: fullName(item.employee.firstName, item.employee.lastName),
      owner: item.statusCode === "SUPERVISOR_APPROVED" ? "Payroll" : "Supervisor",
      amount: `${item.hours.toString()} hrs`,
      priority: item.statusCode === "SUPERVISOR_APPROVED" ? "High" as const : "Medium" as const,
      reviewHref: `/${companyId}/approvals?kind=OVERTIME&q=${encodeURIComponent(item.requestNumber)}`,
    })),
    ...dtrApprovals.map((item) => ({
      ref: `DTR-${item.id.slice(0, 6).toUpperCase()}`,
      module: "Timekeeping" as const,
      employee: fullName(item.employee.firstName, item.employee.lastName),
      owner: "HR",
      amount: "-",
      priority: "High" as const,
      reviewHref: `/${companyId}/attendance/dtr`,
    })),
    ...payrollApprovals.map((item) => ({
      ref: item.runNumber,
      module: "Payroll" as const,
      employee: "Batch",
      owner: "Super Admin",
      amount: toCurrency(item.totalNetPay),
      priority: "Critical" as const,
      reviewHref: `/${companyId}/payroll/runs`,
    })),
  ]

  const timekeepingExceptionsRows = timekeepingRecords.map((record) => {
    const issue =
      record.attendanceStatus === "ABSENT"
        ? "Absent"
        : record.tardinessMins > 0
          ? `Late (${record.tardinessMins}m)`
          : record.undertimeMins > 0
            ? `Undertime (${record.undertimeMins}m)`
            : "Pending approval"

    return [
      fullName(record.employee.firstName, record.employee.lastName),
      issue,
      record.attendanceDate.toISOString().slice(0, 10),
      record.approvalStatusCode === "PENDING" ? "For correction" : "Review",
    ]
  })

  const payrollValue = toCurrency(latestPayrollRun?.totalNetPay)
  const previousPayroll = latestPaidPayrollRun?.totalNetPay ?? new Prisma.Decimal(0)
  const latestPayroll = latestPayrollRun?.totalNetPay ?? new Prisma.Decimal(0)
  const payrollDeltaPercent =
    previousPayroll.equals(0)
      ? 0
      : ((latestPayroll.toNumber() - previousPayroll.toNumber()) / previousPayroll.toNumber()) * 100

  const approvalTotal = pendingLeaveCount + pendingOtCount + pendingDtrCount + pendingPayrollCount
  const elapsedPeriodDays = daysBetweenInclusive(periodStart, periodEffectiveEnd)
  const expectedDtrSlots = activeEmployees * elapsedPeriodDays

  const attendanceLocked = expectedDtrSlots === 0
    ? 0
    : Math.max(0, Math.min(100, Math.round((actualDtrSlots / expectedDtrSlots) * 100)))
  const leaveDeductionsComputed = pendingLeaveCount === 0 ? 100 : Math.max(0, 100 - pendingLeaveCount * 3)
  const otPremiumsComputed = pendingOtCount === 0 ? 100 : Math.max(0, 100 - pendingOtCount * 3)
  const approvalComplete = approvalTotal === 0 ? 100 : Math.max(0, 100 - approvalTotal * 2)
  const cycleReadiness = Math.round((attendanceLocked + leaveDeductionsComputed + otPremiumsComputed + approvalComplete) / 4)
  const criticalActions: CriticalActionItem[] = [
    { key: "payroll", label: "Approve payroll runs", count: pendingPayrollCount },
    { key: "timekeeping", label: "Clear DTR blockers", count: pendingDtrCount },
    { key: "leave", label: "Resolve leave requests", count: pendingLeaveCount },
    { key: "overtime", label: "Approve OT requests", count: pendingOtCount },
  ]

  return {
    cycleMode,
    stats: {
      employeesValue: String(activeEmployees),
      employeesDelta: `${newHires >= 0 ? "+" : ""}${newHires}`,
      timekeepingValue: `${attendanceLocked.toFixed(1)}%`,
      timekeepingDelta: `${pendingDtrCount} pending (${periodLabel})`,
      netPayrollValue: payrollValue,
      netPayrollDelta: `${payrollDeltaPercent >= 0 ? "+" : ""}${payrollDeltaPercent.toFixed(1)}%`,
      leaveOtValue: String(pendingLeaveCount + pendingOtCount),
      leaveOtDelta: `${pendingLeaveCount} leave / ${pendingOtCount} OT (${periodLabel})`,
      approvalsValue: String(approvalTotal),
      approvalsDelta: `${pendingPayrollCount} payroll / ${pendingDtrCount} DTR (${periodLabel})`,
    },
    approvals: approvalRows,
    criticalActions,
    cycleReadiness,
    timekeepingExceptions: timekeepingExceptionsRows.length > 0 ? timekeepingExceptionsRows : [["-", "No exceptions", "-", "Clear"]],
    leaveOtRows: [
      ["Leave Requests", String(pendingLeaveCount), `${leaveApprovals.length} visible in queue`],
      ["Overtime Requests", String(pendingOtCount), `${overtimeApprovals.length} visible in queue`],
      ["Leave + OT Pending", String(pendingLeaveCount + pendingOtCount), "Needs management action"],
      ["Payroll Pending", String(pendingPayrollCount), "Run approvals waiting"],
    ],
    employeeRows: [
      ["Active employees", String(activeEmployees)],
      ["New hires this month", String(newHires)],
      ["Leave records", String(pendingLeaveCount)],
      ["Timekeeping exceptions", String(timekeepingRecords.length)],
    ],
    payrollReadiness: {
      attendanceLocked,
      leaveDeductionsComputed,
      otPremiumsComputed,
      approvalComplete,
      blockers: pendingDtrCount + pendingPayrollCount,
    },
  }
}
