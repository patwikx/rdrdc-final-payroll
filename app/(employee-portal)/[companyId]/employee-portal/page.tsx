import Link from "next/link"
import { redirect } from "next/navigation"
import type { ComponentType } from "react"
import { PayrollRunType } from "@prisma/client"
import {
  IconAlertCircle,
  IconArrowRight,
  IconBeach,
  IconBriefcase,
  IconCalendarEvent,
  IconClockHour4,
  IconCoins,
  IconFileText,
  IconGift,
  IconWallet,
} from "@tabler/icons-react"

import { db } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type EmployeePortalDashboardPageProps = {
  params: Promise<{ companyId: string }>
}

type QuickCardProps = {
  href: string
  title: string
  desc: string
  icon: ComponentType<{ className?: string }>
  disabled?: boolean
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const shortDay = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  timeZone: "Asia/Manila",
})

const money = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const LEAVE_BALANCE_CARD_TYPES = new Set([
  "vacation leave",
  "sick leave",
  "compensatory time off",
  "compensary time off",
  "cto",
])

function QuickActionCard({ href, title, desc, icon: Icon, disabled = false }: QuickCardProps) {
  if (disabled) {
    return (
      <div aria-disabled="true" className="relative overflow-hidden rounded-xl border border-border/60 bg-background/70 p-4 opacity-60">
        <div className="mb-3 w-fit rounded-lg border border-border/60 bg-muted/40 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    )
  }

  return (
    <Link href={href} className="group relative overflow-hidden rounded-xl border border-border/60 bg-background p-4 transition-all duration-300 hover:bg-muted/40">
      <div className="absolute right-0 top-0 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <IconArrowRight className="h-3 w-3 -rotate-45 text-primary transition-transform duration-300 group-hover:rotate-0" />
      </div>

      <div className="mb-3 w-fit rounded-lg border border-border/60 bg-muted/40 p-2 transition-colors group-hover:bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      <h3 className="mb-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  )
}

export default async function EmployeePortalDashboardPage({ params }: EmployeePortalDashboardPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
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

  const [leaveBalances, pendingLeaveRequests, pendingOvertimeRequests, pendingLoanApplications, recentPayslips, upcomingHolidays] = await Promise.all([
    db.leaveBalance.findMany({
      where: {
        employeeId: context.employee.id,
        year: new Date().getFullYear(),
      },
      select: {
        id: true,
        availableBalance: true,
        leaveType: { select: { name: true } },
      },
      orderBy: { leaveType: { name: "asc" } },
    }),
    db.leaveRequest.count({
      where: {
        employeeId: context.employee.id,
        statusCode: "PENDING",
      },
    }),
    db.overtimeRequest.count({
      where: {
        employeeId: context.employee.id,
        statusCode: "PENDING",
      },
    }),
    db.loan.count({
      where: {
        employeeId: context.employee.id,
        applicationStatusCode: "PENDING",
      },
    }),
    db.payslip.findMany({
      where: {
        employeeId: context.employee.id,
        payrollRun: {
          companyId: context.companyId,
          runTypeCode: { not: PayrollRunType.TRIAL_RUN },
        },
      },
      orderBy: { generatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        netPay: true,
        generatedAt: true,
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
      },
    }),
    db.holiday.findMany({
      where: {
        isActive: true,
        holidayDate: { gte: new Date() },
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      orderBy: { holidayDate: "asc" },
      take: 5,
      select: {
        id: true,
        holidayDate: true,
        name: true,
        description: true,
        holidayTypeCode: true,
      },
    }),
  ])

  const filteredLeaveBalances = leaveBalances.filter((balance) => LEAVE_BALANCE_CARD_TYPES.has(balance.leaveType.name.trim().toLowerCase()))

  return (
    <div className="min-h-screen w-full animate-in fade-in bg-background pb-8 duration-500">
      <div className="flex flex-col justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Employee Self-Service</p>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Portal Dashboard</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              ID: {context.employee.employeeNumber}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Quick Access</h2>
              <IconBriefcase className="h-4 w-4 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <QuickActionCard href={`/${context.companyId}/employee-portal/payslips`} title="My Payslips" desc="Salary records" icon={IconWallet} />
              <QuickActionCard href={`/${context.companyId}/employee-portal/leaves`} title="Leave" desc="Time off requests" icon={IconCalendarEvent} />
              <QuickActionCard href={`/${context.companyId}/employee-portal/overtime`} title="Overtime" desc="Extra hours" icon={IconClockHour4} />
              <QuickActionCard href={`/${context.companyId}/employee-portal/loans`} title="Loans" desc="Currently unavailable" icon={IconCoins} disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Leave Balance</h3>
                <IconBeach className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2.5 p-4">
                {filteredLeaveBalances.length > 0 ? (
                  filteredLeaveBalances.map((balance) => (
                    <div key={balance.id} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{balance.leaveType.name}</span>
                      <span className="text-sm font-semibold text-foreground">{Number(balance.availableBalance)} days</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No leave balances available</p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Pending Requests</h3>
                <IconAlertCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2.5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Leave Requests</span>
                  <span className="text-sm font-semibold text-foreground">{pendingLeaveRequests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overtime Requests</span>
                  <span className="text-sm font-semibold text-foreground">{pendingOvertimeRequests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Loan Applications</span>
                  <span className="text-sm font-semibold text-foreground">{pendingLoanApplications}</span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:bg-muted/20 md:col-span-2">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Employment Status</h3>
                <IconBriefcase className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-wrap gap-4 p-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Current Status</p>
                  <div className="inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
                    <p className="text-sm font-medium text-primary">{context.employee.employmentStatus?.name || "Active"}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Date Hired</p>
                  <p className="text-sm text-foreground">{dateLabel.format(context.employee.hireDate)}</p>
                </div>
                {context.employee.regularizationDate ? (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Regularized</p>
                    <p className="text-sm text-foreground">{dateLabel.format(context.employee.regularizationDate)}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">Recent Payslips</h2>
              <IconFileText className="h-4 w-4 text-primary" />
            </div>
            <div className="p-4">
              {recentPayslips.length > 0 ? (
                <div className="space-y-3">
                  {recentPayslips.map((payslip) => (
                    <Link
                      key={payslip.id}
                      href={`/${context.companyId}/employee-portal/payslips`}
                      className="group block rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Pay Period: {payslip.payrollRun.payPeriod?.periodNumber ?? "Payslip"}</p>
                          <p className="text-xs text-muted-foreground">
                            {payslip.payrollRun.payPeriod ? `${dateLabel.format(payslip.payrollRun.payPeriod.cutoffStartDate)} - ${dateLabel.format(payslip.payrollRun.payPeriod.cutoffEndDate)}` : dateLabel.format(payslip.generatedAt)}
                          </p>
                        </div>
                        <IconArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Net Pay</span>
                        <span className="text-lg font-semibold text-foreground">PHP {money.format(Number(payslip.netPay))}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payslips available yet.</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">Upcoming Holidays</h2>
              <IconGift className="h-4 w-4 text-primary" />
            </div>
            <div className="p-4">
              {upcomingHolidays.length > 0 ? (
                <div className="space-y-3">
                  {upcomingHolidays.map((holiday) => (
                    <div key={holiday.id} className="rounded-xl border border-border/60 p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                          <p className="text-xs text-muted-foreground">{holiday.holidayTypeCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{dateLabel.format(holiday.holidayDate)}</p>
                          <p className="text-xs text-muted-foreground">{shortDay.format(holiday.holidayDate)}</p>
                        </div>
                      </div>
                      {holiday.description ? <p className="text-xs text-muted-foreground">{holiday.description}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
