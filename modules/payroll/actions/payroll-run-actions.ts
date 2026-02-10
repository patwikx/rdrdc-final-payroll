"use server"

import { revalidatePath } from "next/cache"

import {
  AttendanceStatus,
  AttendanceDeductionBasis,
  HolidayType,
  PayFrequencyType,
  PayrollProcessStepName,
  PayrollProcessStepStatus,
  PayrollRunStatus,
  RequestStatus,
  TaxTableType,
  type Prisma,
} from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  createPayrollRunInputSchema,
  payrollRunActionInputSchema,
  type CreatePayrollRunInput,
  type PayrollRunActionInput,
} from "@/modules/payroll/schemas/payroll-run-actions-schema"
import { validatePayrollRun } from "@/modules/payroll/utils/validate-payroll-run"

type ActionResult = { ok: true; message: string; runId?: string } | { ok: false; error: string }

const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (!value) return 0
  return Number(value)
}

const toDecimalText = (value: number): string => value.toFixed(2)

const PAYROLL_CALCULATION_VERSION = "PH-PAYROLL-CALC-V2026.02.09"

const stepBlueprint: Array<{ stepNumber: number; stepName: PayrollProcessStepName }> = [
  { stepNumber: 1, stepName: PayrollProcessStepName.CREATE_RUN },
  { stepNumber: 2, stepName: PayrollProcessStepName.VALIDATE_DATA },
  { stepNumber: 3, stepName: PayrollProcessStepName.CALCULATE_PAYROLL },
  { stepNumber: 4, stepName: PayrollProcessStepName.REVIEW_ADJUST },
  { stepNumber: 5, stepName: PayrollProcessStepName.GENERATE_PAYSLIPS },
  { stepNumber: 6, stepName: PayrollProcessStepName.CLOSE_RUN },
]

type PayrollRunFilters = {
  departmentIds: string[]
  branchIds: string[]
  employeeIds: string[]
}

type AttendanceSnapshot = {
  totalWorkingDays: number
  totalPayableDays: number
  unpaidAbsences: number
  tardinessMins: number
  undertimeMins: number
  overtimeHours: number
  overtimePay: number
  nightDiffHours: number
  holidayPremiumPay: number
  hoursWorked: number
}

type DeductionLine = {
  deductionTypeId: string
  description: string
  amount: number
  employerShare?: number
  isPreTax?: boolean
  referenceType?: string
  referenceId?: string
}

type EarningLine = {
  earningTypeId: string
  description: string
  amount: number
  hours?: number
  days?: number
  rate?: number
  isTaxable: boolean
}

type AdjustmentCarryOver = {
  earnings: Array<{ description: string; amount: number; isTaxable: boolean }>
  deductions: Array<{ description: string; amount: number; referenceType?: string }>
}

type StatutoryDeductionTiming = "FIRST_HALF" | "SECOND_HALF" | "EVERY_PERIOD" | "DISABLED"

type StatutoryDeductionSchedule = {
  sss: StatutoryDeductionTiming
  philHealth: StatutoryDeductionTiming
  pagIbig: StatutoryDeductionTiming
  withholdingTax: StatutoryDeductionTiming
}

const defaultStatutoryDeductionSchedule: StatutoryDeductionSchedule = {
  sss: "SECOND_HALF",
  philHealth: "FIRST_HALF",
  pagIbig: "FIRST_HALF",
  withholdingTax: "EVERY_PERIOD",
}

const toDateKey = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

const getDayName = (value: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .toUpperCase()
}

const getDateRange = (start: Date, end: Date): Date[] => {
  const startKey = toDateKey(start)
  const endKey = toDateKey(end)
  const [sY, sM, sD] = startKey.split("-").map(Number)
  const [eY, eM, eD] = endKey.split("-").map(Number)

  const cursor = new Date(Date.UTC(sY, sM - 1, sD))
  const last = new Date(Date.UTC(eY, eM - 1, eD))

  const dates: Date[] = []
  while (cursor <= last) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

const toUtcDateOnly = (value: Date): Date => {
  const [year, month, day] = toDateKey(value).split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const getInclusiveDayCount = (start: Date, end: Date): number => {
  const startUtc = toUtcDateOnly(start)
  const endUtc = toUtcDateOnly(end)
  if (endUtc < startUtc) {
    return 0
  }

  const diffMs = endUtc.getTime() - startUtc.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100

const computeAnnualTaxFromBracketRows = (
  taxableCompensation: number,
  annualTaxRows: Array<{
    bracketOver: Prisma.Decimal
    bracketNotOver: Prisma.Decimal
    baseTax: Prisma.Decimal
    taxRatePercent: Prisma.Decimal
    excessOver: Prisma.Decimal
  }>
): number => {
  if (taxableCompensation <= 0 || annualTaxRows.length === 0) {
    return 0
  }

  const matched =
    annualTaxRows.find((row) => {
      const bracketOver = toNumber(row.bracketOver)
      const bracketNotOver = toNumber(row.bracketNotOver)
      return taxableCompensation >= bracketOver && taxableCompensation <= bracketNotOver
    }) ??
    annualTaxRows[annualTaxRows.length - 1]

  const baseTax = toNumber(matched.baseTax)
  const rate = toNumber(matched.taxRatePercent)
  const excessOver = toNumber(matched.excessOver)
  return roundCurrency(Math.max(0, baseTax + (taxableCompensation - excessOver) * rate))
}

const roundQuantity = (value: number): number => Math.round(value * 10000) / 10000

const parseRunFilters = (remarks: string | null): PayrollRunFilters => {
  if (!remarks) {
    return { departmentIds: [], branchIds: [], employeeIds: [] }
  }

  try {
    const parsed = JSON.parse(remarks) as { filters?: { departmentIds?: string[]; branchIds?: string[]; employeeIds?: string[] } }
    return {
      departmentIds: parsed.filters?.departmentIds ?? [],
      branchIds: parsed.filters?.branchIds ?? [],
      employeeIds: parsed.filters?.employeeIds ?? [],
    }
  } catch {
    return { departmentIds: [], branchIds: [], employeeIds: [] }
  }
}

const parseRestDays = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return ["SATURDAY", "SUNDAY"]
  }

  const parsed = value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toUpperCase())
  if (parsed.length === 0) {
    return ["SATURDAY", "SUNDAY"]
  }

  return parsed
}

const isSecondHalfPeriod = (run: NonNullable<Awaited<ReturnType<typeof ensureRunForCompany>>>): boolean => {
  if (run.payPeriod.pattern.payFrequencyCode !== PayFrequencyType.SEMI_MONTHLY) {
    return true
  }

  return run.payPeriod.periodHalf === "SECOND"
}

const parseStatutoryDeductionSchedule = (value: Prisma.JsonValue | null | undefined): StatutoryDeductionSchedule => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStatutoryDeductionSchedule
  }

  const record = value as Record<string, unknown>
  const normalize = (entry: unknown, fallback: StatutoryDeductionTiming): StatutoryDeductionTiming => {
    if (entry === "FIRST_HALF" || entry === "SECOND_HALF" || entry === "EVERY_PERIOD" || entry === "DISABLED") {
      return entry
    }
    return fallback
  }

  return {
    sss: normalize(record.sss, defaultStatutoryDeductionSchedule.sss),
    philHealth: normalize(record.philHealth, defaultStatutoryDeductionSchedule.philHealth),
    pagIbig: normalize(record.pagIbig, defaultStatutoryDeductionSchedule.pagIbig),
    withholdingTax: normalize(record.withholdingTax, defaultStatutoryDeductionSchedule.withholdingTax),
  }
}

const shouldApplyByTiming = (
  timing: StatutoryDeductionTiming,
  payFrequencyCode: PayFrequencyType,
  periodHalf: string
): boolean => {
  if (timing === "DISABLED") return false
  if (timing === "EVERY_PERIOD") return true

  if (payFrequencyCode !== PayFrequencyType.SEMI_MONTHLY) {
    return true
  }

  if (timing === "FIRST_HALF") return periodHalf === "FIRST"
  if (timing === "SECOND_HALF") return periodHalf === "SECOND"
  return true
}

const calculateAttendanceRuleDeduction = (
  minutes: number,
  hourlyRate: number,
  dailyRate: number,
  rule:
    | {
        calculationBasis: AttendanceDeductionBasis
        thresholdMins: number
      }
    | undefined
): number => {
  if (minutes <= 0) return 0

  const deductibleMins = Math.max(0, minutes - (rule?.thresholdMins ?? 0))
  if (deductibleMins === 0) return 0

  if (!rule) {
    return roundCurrency((deductibleMins / 60) * hourlyRate)
  }

  switch (rule.calculationBasis) {
    case "PER_MINUTE":
      return roundCurrency((deductibleMins / 60) * hourlyRate)
    case "PER_15_MINS":
      return roundCurrency(Math.ceil(deductibleMins / 15) * (hourlyRate / 4))
    case "PER_30_MINS":
      return roundCurrency(Math.ceil(deductibleMins / 30) * (hourlyRate / 2))
    case "PER_HOUR":
      return roundCurrency(Math.ceil(deductibleMins / 60) * hourlyRate)
    case "DAILY_RATE":
      return roundCurrency(dailyRate)
    default:
      return roundCurrency((deductibleMins / 60) * hourlyRate)
  }
}

const calculateAttendanceSnapshot = (params: {
  workScheduleRestDays: Prisma.JsonValue | null
  dailyRate: number
  hourlyRate: number
  holidaysByDate: Map<string, { holidayTypeCode: HolidayType; payMultiplier: number }>
  dtrs: Array<{
    attendanceDate: Date
    attendanceStatus: AttendanceStatus
    hoursWorked: Prisma.Decimal | null
    overtimeHours: Prisma.Decimal | null
    nightDiffHours: Prisma.Decimal | null
    tardinessMins: number
    undertimeMins: number
    remarks: string | null
  }>
  approvedLeaves: Array<{
    startDate: Date
    endDate: Date
    isHalfDay: boolean
    isPaid: boolean
  }>
  approvedOvertimeByDate: Map<string, number>
  overtimeRateByType: Map<string, number>
  isOvertimeEligible: boolean
  isNightDiffEligible: boolean
  datesInPeriod: Date[]
}): AttendanceSnapshot => {
  const restDays = parseRestDays(params.workScheduleRestDays)
  const dtrByDate = new Map(params.dtrs.map((row) => [toDateKey(row.attendanceDate), row]))

  let totalWorkingDays = 0
  let totalPayableDays = 0
  let unpaidAbsences = 0
  let tardinessMins = 0
  let undertimeMins = 0
  let nightDiffHours = 0
  let overtimeHours = 0
  let overtimePay = 0
  let holidayPremiumPay = 0
  let hoursWorked = 0

  for (const date of params.datesInPeriod) {
    const dateKey = toDateKey(date)
    const holiday = params.holidaysByDate.get(dateKey)
    const isHoliday = Boolean(holiday)
    const isRestDay = restDays.includes(getDayName(date))
    const dtr = dtrByDate.get(dateKey)

    if (!isRestDay) {
      totalWorkingDays += 1
    }

    const activeLeave = params.approvedLeaves.find((leave) => {
      const leaveStart = toDateKey(leave.startDate)
      const leaveEnd = toDateKey(leave.endDate)
      return dateKey >= leaveStart && dateKey <= leaveEnd
    })

    const leaveDayValue = activeLeave?.isHalfDay ? 0.5 : 1
    const dtrRemarks = dtr?.remarks?.toUpperCase() ?? ""
    const isHalfDayDtr =
      dtrRemarks.includes("[HALF_DAY]") ||
      dtrRemarks.includes("HALF DAY") ||
      dtrRemarks.includes("HALFDAY")
    const dtrPayableValue = isHalfDayDtr ? 0.5 : 1

    if (isHoliday) {
      totalPayableDays += 1
    } else if (activeLeave?.isPaid) {
      totalPayableDays += leaveDayValue
    } else if (activeLeave && !activeLeave.isPaid) {
      unpaidAbsences += leaveDayValue
    } else if (isRestDay || dtr?.attendanceStatus === AttendanceStatus.REST_DAY) {
      totalPayableDays += 1
    } else if (dtr && (dtr.attendanceStatus === AttendanceStatus.PRESENT || dtr.attendanceStatus === AttendanceStatus.HOLIDAY)) {
      totalPayableDays += dtrPayableValue
      if (isHalfDayDtr) {
        unpaidAbsences += 0.5
      }
    } else if (dtr?.attendanceStatus === AttendanceStatus.ON_LEAVE) {
      if (activeLeave?.isPaid) {
        totalPayableDays += leaveDayValue
      } else if (activeLeave && !activeLeave.isPaid) {
        unpaidAbsences += leaveDayValue
      } else {
        unpaidAbsences += dtrPayableValue
      }
    } else {
      unpaidAbsences += 1
    }

    if (!dtr) {
      continue
    }

    tardinessMins += dtr.tardinessMins
    undertimeMins += dtr.undertimeMins
    hoursWorked += toNumber(dtr.hoursWorked)

    if (params.isNightDiffEligible) {
      nightDiffHours += toNumber(dtr.nightDiffHours)
    }

    if (isHoliday && holiday && dtr.attendanceStatus === AttendanceStatus.PRESENT) {
      holidayPremiumPay += roundCurrency(params.dailyRate * Math.max(holiday.payMultiplier - 1, 0))
    }

    if (!params.isOvertimeEligible) {
      continue
    }

    const approvedOtHours = params.approvedOvertimeByDate.get(dateKey) ?? 0
    if (approvedOtHours <= 0) {
      continue
    }

    overtimeHours += approvedOtHours

    const isRegularHoliday = holiday?.holidayTypeCode === HolidayType.REGULAR
    const isSpecialHoliday =
      holiday?.holidayTypeCode === HolidayType.SPECIAL_NON_WORKING || holiday?.holidayTypeCode === HolidayType.SPECIAL_WORKING

    let overtimeType = "REGULAR_OT"
    if (isRestDay && (isRegularHoliday || isSpecialHoliday)) {
      overtimeType = "REST_DAY_HOLIDAY_OT"
    } else if (isRegularHoliday) {
      overtimeType = "REGULAR_HOLIDAY_OT"
    } else if (isSpecialHoliday) {
      overtimeType = "SPECIAL_HOLIDAY_OT"
    } else if (isRestDay) {
      overtimeType = "REST_DAY_OT"
    }

    const overtimeMultiplier = params.overtimeRateByType.get(overtimeType) ?? 1.25
    overtimePay += roundCurrency(approvedOtHours * params.hourlyRate * overtimeMultiplier)

  }

  return {
    totalWorkingDays,
    totalPayableDays: roundQuantity(totalPayableDays),
    unpaidAbsences: roundQuantity(unpaidAbsences),
    tardinessMins,
    undertimeMins,
    overtimeHours: roundQuantity(overtimeHours),
    overtimePay: roundCurrency(overtimePay),
    nightDiffHours: roundQuantity(nightDiffHours),
    holidayPremiumPay: roundCurrency(holidayPremiumPay),
    hoursWorked: roundQuantity(hoursWorked),
  }
}

const ensurePayrollAccess = async (companyId: string) => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "payroll")) {
    return { ok: false as const, error: "You do not have access to payroll operations." }
  }

  return { ok: true as const, context }
}

const ensureRunForCompany = async (runId: string, companyId: string) => {
  return db.payrollRun.findFirst({
    where: {
      id: runId,
      companyId,
    },
    include: {
      payPeriod: {
        include: {
          pattern: true,
        },
      },
      processSteps: {
        orderBy: { stepNumber: "asc" },
      },
    },
  })
}

const getNextRunNumber = async (companyId: string): Promise<string> => {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date())

  const existingCount = await db.payrollRun.count({ where: { companyId } })
  return `RUN-${year}-${String(existingCount + 1).padStart(5, "0")}`
}

const writeRunRevalidation = (companyId: string, runId?: string) => {
  revalidatePath(`/${companyId}/payroll`)
  revalidatePath(`/${companyId}/payroll/runs`)
  revalidatePath(`/${companyId}/dashboard`)
  if (runId) {
    revalidatePath(`/${companyId}/payroll/runs/${runId}`)
  }
}

export async function createPayrollRunAction(input: CreatePayrollRunInput): Promise<ActionResult> {
  const parsed = createPayrollRunInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue ? `Invalid payload at ${issue.path.join(".")}: ${issue.message}` : "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const period = await db.payPeriod.findFirst({
    where: {
      id: payload.payPeriodId,
      pattern: { companyId: context.companyId },
    },
    include: {
      pattern: { select: { id: true, companyId: true } },
      payrollRuns: {
        where: { statusCode: { in: [PayrollRunStatus.DRAFT, PayrollRunStatus.VALIDATING, PayrollRunStatus.PROCESSING, PayrollRunStatus.COMPUTED, PayrollRunStatus.FOR_REVIEW, PayrollRunStatus.APPROVED, PayrollRunStatus.FOR_PAYMENT] } },
        select: { id: true, runNumber: true },
      },
    },
  })

  if (!period) {
    return { ok: false, error: "Pay period not found for active company." }
  }

  if (period.statusCode !== "OPEN") {
    return { ok: false, error: "Selected pay period is not open." }
  }

  if (period.payrollRuns.length > 0) {
    return { ok: false, error: `A payroll run is already in progress for this period (${period.payrollRuns[0].runNumber}).` }
  }

  const where: Prisma.EmployeeWhereInput = {
    companyId: context.companyId,
    isActive: true,
    deletedAt: null,
    payPeriodPatternId: period.patternId,
  }

  if (payload.departmentIds && payload.departmentIds.length > 0) {
    where.departmentId = { in: payload.departmentIds }
  }
  if (payload.branchIds && payload.branchIds.length > 0) {
    where.branchId = { in: payload.branchIds }
  }
  if (payload.employeeIds && payload.employeeIds.length > 0) {
    where.id = { in: payload.employeeIds }
  }

  const eligibleEmployeeCount = await db.employee.count({ where })
  if (eligibleEmployeeCount === 0) {
    return { ok: false, error: "No eligible employees matched this payroll run scope." }
  }

  try {
    const runNumber = await getNextRunNumber(context.companyId)

    const created = await db.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId: context.companyId,
          payPeriodId: period.id,
          runNumber,
          runTypeCode: payload.runTypeCode,
          statusCode: PayrollRunStatus.DRAFT,
          totalEmployees: eligibleEmployeeCount,
          currentStepNumber: 2,
          currentStepName: PayrollProcessStepName.VALIDATE_DATA,
          createdById: context.userId,
          remarks: JSON.stringify({
            filters: {
              departmentIds: payload.departmentIds ?? [],
              branchIds: payload.branchIds ?? [],
              employeeIds: payload.employeeIds ?? [],
            },
          }),
        },
        select: { id: true, runNumber: true },
      })

      await tx.payrollProcessStep.createMany({
        data: stepBlueprint.map((step) => ({
          payrollRunId: run.id,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          status:
            step.stepNumber === 1
              ? PayrollProcessStepStatus.COMPLETED
              : step.stepNumber === 2
                ? PayrollProcessStepStatus.IN_PROGRESS
                : PayrollProcessStepStatus.PENDING,
          isCompleted: step.stepNumber === 1,
          completedAt: step.stepNumber === 1 ? new Date() : null,
          notes:
            step.stepNumber === 1
              ? JSON.stringify({
                  filters: {
                    departmentIds: payload.departmentIds ?? [],
                    branchIds: payload.branchIds ?? [],
                    employeeIds: payload.employeeIds ?? [],
                  },
                })
              : null,
        })),
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "CREATE",
          userId: context.userId,
          reason: "CREATE_PAYROLL_RUN",
          changes: [
            { fieldName: "runNumber", newValue: run.runNumber },
            { fieldName: "runTypeCode", newValue: payload.runTypeCode },
            { fieldName: "payPeriodId", newValue: payload.payPeriodId },
            { fieldName: "totalEmployees", newValue: eligibleEmployeeCount },
          ],
        },
        tx
      )

      return run
    })

    writeRunRevalidation(context.companyId, created.id)
    return { ok: true, message: `Payroll run ${created.runNumber} created.`, runId: created.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to create payroll run: ${message}` }
  }
}

export async function validatePayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const filters = (() => {
    try {
      const parsedRemarks = run.remarks ? (JSON.parse(run.remarks) as { filters?: { departmentIds?: string[]; branchIds?: string[]; employeeIds?: string[] } }) : null
      return {
        departmentIds: parsedRemarks?.filters?.departmentIds ?? [],
        branchIds: parsedRemarks?.filters?.branchIds ?? [],
        employeeIds: parsedRemarks?.filters?.employeeIds ?? [],
      }
    } catch {
      return { departmentIds: [], branchIds: [], employeeIds: [] }
    }
  })()

  const validationResult = await validatePayrollRun(run, filters)
  const errors = validationResult.errors
  const warnings = validationResult.warnings

  const validationStatutorySchedule = parseStatutoryDeductionSchedule(
    (run.payPeriod.pattern as unknown as { statutoryDeductionSchedule?: Prisma.JsonValue | null }).statutoryDeductionSchedule
  )

  const validationTaxTableType =
    run.payPeriod.pattern.payFrequencyCode === PayFrequencyType.SEMI_MONTHLY ? TaxTableType.SEMI_MONTHLY : TaxTableType.MONTHLY

  const [activeSssCount, activePhilHealthCount, activePagIbigCount, activeTaxCount] = await Promise.all([
    db.sSSContributionTable.count({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
    }),
    db.philHealthContributionTable.count({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
    }),
    db.pagIBIGContributionTable.count({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
    }),
    db.taxTable.count({
      where: {
        taxTableTypeCode: validationTaxTableType,
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
    }),
  ])

  const runHalf = run.payPeriod.periodHalf
  const applySssThisRun = shouldApplyByTiming(validationStatutorySchedule.sss, run.payPeriod.pattern.payFrequencyCode, runHalf)
  const applyPhilHealthThisRun = shouldApplyByTiming(
    validationStatutorySchedule.philHealth,
    run.payPeriod.pattern.payFrequencyCode,
    runHalf
  )
  const applyPagIbigThisRun = shouldApplyByTiming(
    validationStatutorySchedule.pagIbig,
    run.payPeriod.pattern.payFrequencyCode,
    runHalf
  )
  const applyWtaxThisRun = shouldApplyByTiming(
    validationStatutorySchedule.withholdingTax,
    run.payPeriod.pattern.payFrequencyCode,
    runHalf
  )

  if (applySssThisRun && activeSssCount === 0) {
    warnings.push("No active SSS statutory table matched this payroll cutoff; SSS deductions may be zero.")
  }
  if (applyPhilHealthThisRun && activePhilHealthCount === 0) {
    warnings.push("No active PhilHealth statutory table matched this payroll cutoff; PhilHealth deductions may be zero.")
  }
  if (applyPagIbigThisRun && activePagIbigCount === 0) {
    warnings.push("No active Pag-IBIG statutory table matched this payroll cutoff; Pag-IBIG deductions may be zero.")
  }
  if (applyWtaxThisRun && activeTaxCount === 0) {
    warnings.push("No active withholding tax table matched this payroll cutoff/frequency; WTAX may be zero.")
  }

  const validationStatutoryDiagnostics = {
    schedule: validationStatutorySchedule,
    applicableThisRun: {
      sss: applySssThisRun,
      philHealth: applyPhilHealthThisRun,
      pagIbig: applyPagIbigThisRun,
      withholdingTax: applyWtaxThisRun,
    },
    activeTableCounts: {
      sss: activeSssCount,
      philHealth: activePhilHealthCount,
      pagIbig: activePagIbigCount,
      withholdingTax: activeTaxCount,
    },
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: errors.length > 0 ? PayrollRunStatus.DRAFT : PayrollRunStatus.VALIDATING,
          currentStepNumber: 2,
          currentStepName: PayrollProcessStepName.VALIDATE_DATA,
          totalEmployees: validationResult.employeeCount,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 2 } },
        data: {
          status: errors.length > 0 ? PayrollProcessStepStatus.FAILED : PayrollProcessStepStatus.COMPLETED,
          isCompleted: errors.length === 0,
          completedAt: errors.length === 0 ? new Date() : null,
          validationErrors: errors,
          validationWarnings: warnings,
          notes: JSON.stringify({
            validatedAt: new Date().toISOString(),
            errorCount: errors.length,
            warningCount: warnings.length,
            employeeCount: validationResult.employeeCount,
            dtrSummary: validationResult.dtrSummary,
            prePayrollReport: validationResult.prePayrollReport,
            statutoryDiagnostics: validationStatutoryDiagnostics,
          }),
        },
      })

      if (errors.length > 0) {
        await tx.payrollProcessStep.update({
          where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 3 } },
          data: { status: PayrollProcessStepStatus.PENDING, isCompleted: false, completedAt: null },
        })
      }

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "VALIDATE_PAYROLL_RUN",
          changes: [
            { fieldName: "validationErrorCount", newValue: errors.length },
            { fieldName: "validationWarningCount", newValue: warnings.length },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)

    if (errors.length > 0) {
      return { ok: false, error: `Validation failed (${errors.length}): ${errors[0]}` }
    }

    return { ok: true, message: `Validation completed with ${warnings.length} warning(s).` }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to validate payroll run: ${message}` }
  }
}

export async function proceedToCalculatePayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const step2 = run.processSteps.find((step) => step.stepNumber === 2)
  if (!step2?.isCompleted) {
    return { ok: false, error: "Validate step must be completed first." }
  }

  const validationErrors = Array.isArray(step2.validationErrors) ? step2.validationErrors : []
  if (validationErrors.length > 0) {
    return { ok: false, error: "Validation errors still exist. Resolve them before proceeding." }
  }

  if (run.currentStepNumber > 2) {
    return { ok: false, error: "Run is already beyond validation step." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.VALIDATING,
          currentStepNumber: 3,
          currentStepName: PayrollProcessStepName.CALCULATE_PAYROLL,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 3 } },
        data: {
          status: PayrollProcessStepStatus.IN_PROGRESS,
          isCompleted: false,
          completedAt: null,
        },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "PROCEED_TO_CALCULATE_PAYROLL",
          changes: [
            { fieldName: "currentStepNumber", oldValue: run.currentStepNumber, newValue: 3 },
            { fieldName: "currentStepName", oldValue: run.currentStepName, newValue: PayrollProcessStepName.CALCULATE_PAYROLL },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Validation reviewed. Proceeded to calculation step." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to proceed to calculation: ${message}` }
  }
}

export async function calculatePayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid payload." }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) return { ok: false, error: "Payroll run not found." }

  const step2 = run.processSteps.find((step) => step.stepNumber === 2)
  if (!step2?.isCompleted) return { ok: false, error: "Payroll run must pass validation before calculation." }

  const filters = parseRunFilters(run.remarks)
  const isThirteenthMonthRun = run.runTypeCode === "THIRTEENTH_MONTH"
  const isMidYearBonusRun = run.runTypeCode === "MID_YEAR_BONUS"
  const isBonusOnlyRun = isThirteenthMonthRun || isMidYearBonusRun
  const yearStartDate = new Date(Date.UTC(run.payPeriod.year, 0, 1))
  const yearEndDate = new Date(Date.UTC(run.payPeriod.year, 11, 31))
  const employeeWhere: Prisma.EmployeeWhereInput = {
    companyId: run.companyId,
    deletedAt: null,
    payPeriodPatternId: run.payPeriod.patternId,
    ...(isThirteenthMonthRun
      ? {
          OR: [{ isActive: true }, { separationDate: { gte: yearStartDate, lte: yearEndDate } }],
        }
      : { isActive: true }),
  }
  if (filters.departmentIds.length > 0) employeeWhere.departmentId = { in: filters.departmentIds }
  if (filters.branchIds.length > 0) employeeWhere.branchId = { in: filters.branchIds }
  if (filters.employeeIds.length > 0) employeeWhere.id = { in: filters.employeeIds }

  const employees = await db.employee.findMany({
    where: employeeWhere,
    include: {
      salary: {
        select: {
          baseSalary: true,
          dailyRate: true,
          hourlyRate: true,
          monthlyDivisor: true,
          hoursPerDay: true,
          salaryRateTypeCode: true,
          isActive: true,
        },
      },
      workSchedule: { select: { restDays: true } },
      employmentType: { select: { has13thMonth: true } },
      earnings: {
        where: {
          isActive: true,
          effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
        },
        include: { earningType: { select: { id: true, name: true, isTaxable: true } } },
      },
      recurringDeductions: {
        where: {
          statusCode: "ACTIVE",
          effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
        },
        include: {
          deductionType: {
            select: {
              id: true,
              name: true,
              payPeriodApplicability: true,
              percentageBase: true,
              maxDeductionLimit: true,
              isPreTax: true,
            },
          },
        },
      },
    },
  })

  if (employees.length === 0) return { ok: false, error: "No eligible employees found for payroll calculation." }

  const employeeIds = employees.map((employee) => employee.id)
  const datesInPeriod = getDateRange(run.payPeriod.cutoffStartDate, run.payPeriod.cutoffEndDate)

  const regularRunStatusesFor13th: PayrollRunStatus[] = [
    PayrollRunStatus.COMPUTED,
    PayrollRunStatus.FOR_REVIEW,
    PayrollRunStatus.APPROVED,
    PayrollRunStatus.FOR_PAYMENT,
    PayrollRunStatus.PAID,
  ]

  const [holidays, dtrRows, approvedLeaves, approvedOvertimeRequests, overtimeRates, attendanceRules, sssTables, philHealthTable, pagIbigTables, taxTables, ytdContributions, paidPayslipTotals, regularPayslipBasicYtd, paidBonusBenefitsYtd, paidPreTaxRecurringYtd, dueLoanAmortizations, priorRunAdjustments, nightDiffConfig] = await Promise.all([
    db.holiday.findMany({
      where: {
        holidayDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
        isActive: true,
        OR: [{ companyId: null }, { companyId: run.companyId }],
      },
      select: { holidayDate: true, holidayTypeCode: true, payMultiplier: true },
    }),
    db.dailyTimeRecord.findMany({
      where: { employeeId: { in: employeeIds }, attendanceDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate } },
      select: {
        employeeId: true,
        attendanceDate: true,
        attendanceStatus: true,
        hoursWorked: true,
        overtimeHours: true,
        nightDiffHours: true,
        tardinessMins: true,
        undertimeMins: true,
        remarks: true,
      },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        statusCode: RequestStatus.APPROVED,
        startDate: { lte: run.payPeriod.cutoffEndDate },
        endDate: { gte: run.payPeriod.cutoffStartDate },
      },
      select: { employeeId: true, startDate: true, endDate: true, isHalfDay: true, leaveType: { select: { isPaid: true } } },
    }),
    db.overtimeRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        overtimeDate: { gte: run.payPeriod.cutoffStartDate, lte: run.payPeriod.cutoffEndDate },
        statusCode: RequestStatus.APPROVED,
      },
      select: { employeeId: true, overtimeDate: true, hours: true },
    }),
    db.overtimeRate.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { overtimeTypeCode: true, rateMultiplier: true },
    }),
    db.attendanceDeductionRule.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { ruleType: true, calculationBasis: true, thresholdMins: true },
    }),
    db.sSSContributionTable.findMany({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { salaryBracketMin: "asc" }],
    }),
    db.philHealthContributionTable.findFirst({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.pagIBIGContributionTable.findMany({
      where: {
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { salaryBracketMin: "asc" }],
    }),
    db.taxTable.findMany({
      where: {
        taxTableTypeCode: { in: [TaxTableType.SEMI_MONTHLY, TaxTableType.MONTHLY, TaxTableType.ANNUAL] },
        effectiveFrom: { lte: run.payPeriod.cutoffEndDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.payPeriod.cutoffStartDate } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { bracketOver: "asc" }],
    }),
    db.employeeYTDContribution.findMany({ where: { employeeId: { in: employeeIds }, year: run.payPeriod.year } }),
    db.payslip.groupBy({
      by: ["employeeId"],
      where: {
        employeeId: { in: employeeIds },
        payrollRun: {
          companyId: run.companyId,
          statusCode: PayrollRunStatus.PAID,
          payPeriod: { year: run.payPeriod.year, cutoffEndDate: { lt: run.payPeriod.cutoffStartDate } },
        },
      },
      _sum: { grossPay: true, netPay: true, withholdingTax: true },
    }),
    db.payslip.groupBy({
      by: ["employeeId"],
      where: {
        employeeId: { in: employeeIds },
        payrollRun: {
          companyId: run.companyId,
          runTypeCode: "REGULAR",
          statusCode: { in: regularRunStatusesFor13th },
          payPeriod: {
            year: run.payPeriod.year,
            cutoffEndDate: { lte: run.payPeriod.cutoffEndDate },
          },
        },
      },
      _sum: { basicPay: true },
    }),
    db.payslip.groupBy({
      by: ["employeeId"],
      where: {
        employeeId: { in: employeeIds },
        payrollRun: {
          companyId: run.companyId,
          runTypeCode: { in: ["THIRTEENTH_MONTH", "MID_YEAR_BONUS"] },
          statusCode: PayrollRunStatus.PAID,
          payPeriod: {
            year: run.payPeriod.year,
            cutoffEndDate: { lt: run.payPeriod.cutoffStartDate },
          },
        },
      },
      _sum: { grossPay: true },
    }),
    db.payslip.findMany({
      where: {
        employeeId: { in: employeeIds },
        payrollRun: {
          companyId: run.companyId,
          runTypeCode: "REGULAR",
          statusCode: PayrollRunStatus.PAID,
          payPeriod: {
            year: run.payPeriod.year,
            cutoffEndDate: { lt: run.payPeriod.cutoffStartDate },
          },
        },
      },
      select: {
        employeeId: true,
        deductions: {
          where: {
            referenceType: "RECURRING",
            deductionType: {
              isPreTax: true,
            },
          },
          select: {
            amount: true,
          },
        },
      },
    }),
    db.loanAmortization.findMany({
      where: {
        loan: {
          employeeId: { in: employeeIds },
          statusCode: "ACTIVE",
        },
        dueDate: { lte: run.payPeriod.cutoffEndDate },
        isPaid: false,
      },
      include: {
        loan: {
          include: {
            loanType: {
              select: {
                name: true,
                deductionPriority: true,
              },
            },
          },
        },
      },
      orderBy: {
        loan: {
          loanType: {
            deductionPriority: "asc",
          },
        },
      },
    }),
    db.payslip.findMany({
      where: { payrollRunId: run.id },
      select: {
        employeeId: true,
        earnings: {
          where: {
            earningType: { code: "ADJUSTMENT" },
          },
          select: {
            description: true,
            amount: true,
            isTaxable: true,
          },
        },
        deductions: {
          where: {
            OR: [{ referenceType: "ADJUSTMENT" }, { deductionType: { code: "ADJUSTMENT" } }],
          },
          select: {
            description: true,
            amount: true,
            referenceType: true,
          },
        },
      },
    }),
    db.systemConfig.findUnique({ where: { key: "NIGHT_DIFF_RATE" }, select: { value: true } }),
  ])

  const holidaysByDate = new Map(
    holidays.map((holiday) => [toDateKey(holiday.holidayDate), { holidayTypeCode: holiday.holidayTypeCode, payMultiplier: toNumber(holiday.payMultiplier) }])
  )
  const dtrsByEmployeeId = new Map<string, typeof dtrRows>()
  for (const row of dtrRows) {
    const list = dtrsByEmployeeId.get(row.employeeId)
    if (list) list.push(row)
    else dtrsByEmployeeId.set(row.employeeId, [row])
  }

  const approvedLeavesByEmployeeId = new Map<string, Array<{ startDate: Date; endDate: Date; isHalfDay: boolean; isPaid: boolean }>>()
  for (const leave of approvedLeaves) {
    const list = approvedLeavesByEmployeeId.get(leave.employeeId)
    const normalized = { startDate: leave.startDate, endDate: leave.endDate, isHalfDay: leave.isHalfDay, isPaid: leave.leaveType?.isPaid ?? false }
    if (list) list.push(normalized)
    else approvedLeavesByEmployeeId.set(leave.employeeId, [normalized])
  }

  const approvedOvertimeByEmployeeDate = new Map<string, Map<string, number>>()
  for (const overtime of approvedOvertimeRequests) {
    const employeeMap = approvedOvertimeByEmployeeDate.get(overtime.employeeId) ?? new Map<string, number>()
    const key = toDateKey(overtime.overtimeDate)
    employeeMap.set(key, roundQuantity((employeeMap.get(key) ?? 0) + toNumber(overtime.hours)))
    approvedOvertimeByEmployeeDate.set(overtime.employeeId, employeeMap)
  }

  const overtimeRateByType = new Map<string, number>()
  for (const rate of overtimeRates) {
    if (!overtimeRateByType.has(rate.overtimeTypeCode)) overtimeRateByType.set(rate.overtimeTypeCode, toNumber(rate.rateMultiplier))
  }

  const attendanceRuleByType = new Map(attendanceRules.map((rule) => [rule.ruleType, rule]))
  const ytdContributionsByEmployee = new Map<string, Map<string, number>>()
  for (const row of ytdContributions) {
    const map = ytdContributionsByEmployee.get(row.employeeId) ?? new Map<string, number>()
    map.set(row.contributionType, toNumber(row.totalEmployee))
    ytdContributionsByEmployee.set(row.employeeId, map)
  }

  const paidPayslipTotalsByEmployee = new Map(
    paidPayslipTotals.map((row) => [row.employeeId, { grossPay: toNumber(row._sum.grossPay), netPay: toNumber(row._sum.netPay), withholdingTax: toNumber(row._sum.withholdingTax) }])
  )

  const regularBasicYtdByEmployee = new Map(
    regularPayslipBasicYtd.map((row) => [row.employeeId, toNumber(row._sum.basicPay)])
  )

  const paidBonusBenefitsYtdByEmployee = new Map(
    paidBonusBenefitsYtd.map((row) => [row.employeeId, toNumber(row._sum.grossPay)])
  )

  const paidPreTaxRecurringYtdByEmployee = paidPreTaxRecurringYtd.reduce((map, payslip) => {
    const current = map.get(payslip.employeeId) ?? 0
    const deductionTotal = payslip.deductions.reduce((sum, item) => sum + toNumber(item.amount), 0)
    map.set(payslip.employeeId, roundCurrency(current + deductionTotal))
    return map
  }, new Map<string, number>())

  const dueLoanAmortizationsByEmployee = new Map<string, typeof dueLoanAmortizations>()
  for (const amortization of dueLoanAmortizations) {
    const list = dueLoanAmortizationsByEmployee.get(amortization.loan.employeeId)
    if (list) list.push(amortization)
    else dueLoanAmortizationsByEmployee.set(amortization.loan.employeeId, [amortization])
  }

  const adjustmentsByEmployee = new Map<string, AdjustmentCarryOver>()
  for (const snapshot of priorRunAdjustments) {
    adjustmentsByEmployee.set(snapshot.employeeId, {
      earnings: snapshot.earnings.map((item) => ({
        description: item.description ?? "Manual Adjustment",
        amount: toNumber(item.amount),
        isTaxable: item.isTaxable,
      })),
      deductions: snapshot.deductions.map((item) => ({
        description: item.description ?? "Manual Adjustment",
        amount: toNumber(item.amount),
        referenceType: item.referenceType ?? "ADJUSTMENT",
      })),
    })
  }

  const nightDiffRate = (() => {
    const parsedRate = Number(nightDiffConfig?.value ?? "0.10")
    if (Number.isNaN(parsedRate) || parsedRate < 0) return 0.1
    return parsedRate
  })()

  const secondHalfPeriod = isSecondHalfPeriod(run)
  const statutorySchedule = parseStatutoryDeductionSchedule(
    (run.payPeriod.pattern as unknown as { statutoryDeductionSchedule?: Prisma.JsonValue | null }).statutoryDeductionSchedule
  )
  const taxTableType = run.payPeriod.pattern.payFrequencyCode === PayFrequencyType.SEMI_MONTHLY ? TaxTableType.SEMI_MONTHLY : TaxTableType.MONTHLY
  const taxRowsForType = taxTables.filter((row) => row.taxTableTypeCode === taxTableType)
  const latestTaxEffectiveFrom = taxRowsForType[0]?.effectiveFrom ?? null
  const activeTaxRows = latestTaxEffectiveFrom
    ? taxRowsForType.filter((row) => row.effectiveFrom.getTime() === latestTaxEffectiveFrom.getTime())
    : taxRowsForType

  const annualRowsForYear = taxTables
    .filter((row) => row.taxTableTypeCode === TaxTableType.ANNUAL && row.effectiveYear === run.payPeriod.year)
    .sort((a, b) => {
      if (a.effectiveFrom.getTime() !== b.effectiveFrom.getTime()) {
        return b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
      }

      return toNumber(a.bracketOver) - toNumber(b.bracketOver)
    })
  const latestAnnualEffectiveFrom = annualRowsForYear[0]?.effectiveFrom ?? null
  const activeAnnualTaxRows = latestAnnualEffectiveFrom
    ? annualRowsForYear.filter((row) => row.effectiveFrom.getTime() === latestAnnualEffectiveFrom.getTime())
    : []

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.PROCESSING,
          currentStepNumber: 3,
          currentStepName: PayrollProcessStepName.CALCULATE_PAYROLL,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 3 } },
        data: {
          status: PayrollProcessStepStatus.IN_PROGRESS,
          isCompleted: false,
          completedAt: null,
        },
      })

      await tx.payslip.deleteMany({ where: { payrollRunId: run.id } })

      const existingEarningTypes = await tx.earningType.findMany({
        where: { code: { in: ["BASIC_PAY", "OVERTIME", "NIGHT_DIFF", "HOLIDAY_PAY"] }, OR: [{ companyId: run.companyId }, { companyId: null }] },
        select: { id: true, code: true },
      })
      const existingDeductionTypes = await tx.deductionType.findMany({
        where: { code: { in: ["TARDINESS", "UNDERTIME", "SSS", "PHILHEALTH", "PAGIBIG", "WTAX"] }, OR: [{ companyId: run.companyId }, { companyId: null }] },
        select: { id: true, code: true },
      })

      const earningTypeByCode = new Map(existingEarningTypes.map((type) => [type.code, type.id]))
      const deductionTypeByCode = new Map(existingDeductionTypes.map((type) => [type.code, type.id]))

      const getOrCreateEarningTypeId = async (code: string, name: string): Promise<string> => {
        const existing = earningTypeByCode.get(code)
        if (existing) return existing

        const created = await tx.earningType.create({
          data: { companyId: run.companyId, code, name, isTaxable: true, isIncludedInGross: true },
          select: { id: true },
        })
        earningTypeByCode.set(code, created.id)
        return created.id
      }

      const getOrCreateDeductionTypeId = async (code: string, name: string): Promise<string> => {
        const existing = deductionTypeByCode.get(code)
        if (existing) return existing

        const created = await tx.deductionType.create({
          data: { companyId: run.companyId, code, name, isMandatory: true, isPreTax: code !== "WTAX" },
          select: { id: true },
        })
        deductionTypeByCode.set(code, created.id)
        return created.id
      }

      let processedEmployeeCount = 0
      let skippedEmployeeCount = 0
      let totalGross = 0
      let totalDeductions = 0
      let totalNet = 0
      let totalEmployerContributions = 0
      const employeeSummaries: Array<{
        employeeId: string
        employeeNumber: string
        employeeName: string
        grossPay: number
        totalDeductions: number
        netPay: number
      }> = []
      const employeeCalculationTraces: Array<{
        employeeId: string
        employeeNumber: string
        employeeName: string
        attendance: {
          workingDays: number
          payableDays: number
          unpaidAbsences: number
          tardinessMins: number
          undertimeMins: number
          overtimeHours: number
          nightDiffHours: number
        }
        rates: {
          salaryRateType: string
          baseSalary: number
          dailyRate: number
          hourlyRate: number
        }
        earnings: {
          basicPay: number
          ytdRegularBasicFor13th?: number
          overtimePay: number
          nightDiffPay: number
          holidayPay: number
          recurringEarnings: number
          adjustmentEarnings: number
          grossPay: number
        }
        deductions: {
          tardiness: number
          undertime: number
          sss: number
          philHealth: number
          pagIbig: number
          preTaxRecurring: number
          withholdingTax: number
          recurring: number
          adjustments: number
          loans: number
          totalDeductions: number
          netPay: number
        }
      }> = []

      const statutoryDiagnostics = {
        schedule: statutorySchedule,
        applicableThisRun: {
          sss: shouldApplyByTiming(statutorySchedule.sss, run.payPeriod.pattern.payFrequencyCode, run.payPeriod.periodHalf),
          philHealth: shouldApplyByTiming(
            statutorySchedule.philHealth,
            run.payPeriod.pattern.payFrequencyCode,
            run.payPeriod.periodHalf
          ),
          pagIbig: shouldApplyByTiming(
            statutorySchedule.pagIbig,
            run.payPeriod.pattern.payFrequencyCode,
            run.payPeriod.periodHalf
          ),
          withholdingTax: shouldApplyByTiming(
            statutorySchedule.withholdingTax,
            run.payPeriod.pattern.payFrequencyCode,
            run.payPeriod.periodHalf
          ),
        },
        activeTableCounts: {
          sss: sssTables.length,
          philHealth: philHealthTable ? 1 : 0,
          pagIbig: pagIbigTables.length,
          withholdingTax: activeAnnualTaxRows.length > 0 ? activeAnnualTaxRows.length : activeTaxRows.length,
        },
        employeeStats: {
          sssApplied: 0,
          philHealthApplied: 0,
          pagIbigApplied: 0,
          withholdingTaxApplied: 0,
          sssSkippedByTiming: 0,
          philHealthSkippedByTiming: 0,
          pagIbigSkippedByTiming: 0,
          withholdingTaxSkippedByTiming: 0,
          sssNoBracketMatch: 0,
          pagIbigNoBracketMatch: 0,
          philHealthNoActiveConfig: 0,
          withholdingTaxNoBracketMatch: 0,
        },
      }

      for (const employee of employees) {
        const salary = employee.salary
        if (!salary?.isActive) {
          skippedEmployeeCount += 1
          continue
        }

        const baseSalary = toNumber(salary.baseSalary)
        const monthlyDivisor = salary.monthlyDivisor || 365
        const hoursPerDay = toNumber(salary.hoursPerDay) || 8
        const dailyRate = salary.dailyRate ? toNumber(salary.dailyRate) : (baseSalary * 12) / monthlyDivisor
        const hourlyRate = salary.hourlyRate ? toNumber(salary.hourlyRate) : dailyRate / hoursPerDay

        if (isThirteenthMonthRun && employee.employmentType && !employee.employmentType.has13thMonth) {
          skippedEmployeeCount += 1
          continue
        }

        const attendanceSnapshot = isBonusOnlyRun
          ? {
              totalWorkingDays: 0,
              totalPayableDays: 0,
              unpaidAbsences: 0,
              tardinessMins: 0,
              undertimeMins: 0,
              overtimeHours: 0,
              overtimePay: 0,
              nightDiffHours: 0,
              holidayPremiumPay: 0,
              hoursWorked: 0,
            }
          : calculateAttendanceSnapshot({
              workScheduleRestDays: employee.workSchedule?.restDays ?? null,
              dailyRate,
              hourlyRate,
              holidaysByDate,
              dtrs: dtrsByEmployeeId.get(employee.id) ?? [],
              approvedLeaves: approvedLeavesByEmployeeId.get(employee.id) ?? [],
              approvedOvertimeByDate: approvedOvertimeByEmployeeDate.get(employee.id) ?? new Map<string, number>(),
              overtimeRateByType,
              isOvertimeEligible: employee.isOvertimeEligible,
              isNightDiffEligible: employee.isNightDiffEligible,
              datesInPeriod,
            })

        const periodBaseSalary = (baseSalary * 12) / Math.max(run.payPeriod.pattern.periodsPerYear, 1)
        const regularBasicPay = roundCurrency(
          salary.salaryRateTypeCode === "MONTHLY"
            ? Math.max(0, periodBaseSalary - attendanceSnapshot.unpaidAbsences * dailyRate)
            : attendanceSnapshot.totalPayableDays * dailyRate
        )

        const ytdRegularBasic = regularBasicYtdByEmployee.get(employee.id) ?? 0
        const employeeHireDate = toUtcDateOnly(employee.hireDate)
        const employeeSeparationDate = employee.separationDate ? toUtcDateOnly(employee.separationDate) : null
        const coverageStart = employeeHireDate > yearStartDate ? employeeHireDate : yearStartDate
        const runCoverageEnd = toUtcDateOnly(run.payPeriod.cutoffEndDate)
        const coverageEnd = employeeSeparationDate && employeeSeparationDate < runCoverageEnd ? employeeSeparationDate : runCoverageEnd
        const fallback13thProrated = roundCurrency(baseSalary * (getInclusiveDayCount(coverageStart, coverageEnd) / 365))

        const thirteenthMonthPay = roundCurrency(ytdRegularBasic > 0 ? ytdRegularBasic / 12 : fallback13thProrated)

        const midYearBonusPay = roundCurrency(baseSalary / 2)
        const basicPay = isThirteenthMonthRun ? thirteenthMonthPay : isMidYearBonusRun ? midYearBonusPay : regularBasicPay

        const overtimePay = isBonusOnlyRun ? 0 : roundCurrency(attendanceSnapshot.overtimePay)
        const nightDiffPay = isBonusOnlyRun ? 0 : roundCurrency(attendanceSnapshot.nightDiffHours * hourlyRate * nightDiffRate)
        const holidayPay = isBonusOnlyRun ? 0 : roundCurrency(attendanceSnapshot.holidayPremiumPay)

        const recurringEarningLines: EarningLine[] = []
        let recurringEarningsTotal = 0
        for (const earning of isBonusOnlyRun ? [] : employee.earnings) {
          if (earning.frequency === "MONTHLY" && !secondHalfPeriod) continue

          let amount = toNumber(earning.amount)
          if (earning.prorationRule === "PRORATED_DAYS" && attendanceSnapshot.totalWorkingDays > 0) {
            amount = amount * (attendanceSnapshot.totalPayableDays / attendanceSnapshot.totalWorkingDays)
          } else if (earning.prorationRule === "PRORATED_HOURS" && attendanceSnapshot.totalWorkingDays > 0) {
            const scheduledHours = attendanceSnapshot.totalWorkingDays * hoursPerDay
            const actualHours = attendanceSnapshot.totalPayableDays * hoursPerDay
            amount = amount * (scheduledHours > 0 ? actualHours / scheduledHours : 1)
          }

          const normalizedAmount = roundCurrency(Math.max(amount, 0))
          if (normalizedAmount <= 0) continue

          recurringEarningsTotal += normalizedAmount
          recurringEarningLines.push({
            earningTypeId: earning.earningTypeId,
            description: earning.earningType.name,
            amount: normalizedAmount,
            isTaxable: earning.isTaxableOverride ?? earning.earningType.isTaxable,
          })
        }

        const manualAdjustments = adjustmentsByEmployee.get(employee.id)
        const manualAdjustmentEarnings: EarningLine[] = (manualAdjustments?.earnings ?? []).map((item) => ({
          earningTypeId: "",
          description: item.description,
          amount: roundCurrency(Math.max(item.amount, 0)),
          isTaxable: item.isTaxable,
        }))
        const manualAdjustmentEarningsTotal = roundCurrency(
          manualAdjustmentEarnings.reduce((sum, item) => sum + item.amount, 0)
        )

        const grossPay = roundCurrency(
          basicPay + overtimePay + nightDiffPay + holidayPay + recurringEarningsTotal + manualAdjustmentEarningsTotal
        )
        const tardinessDeduction = isBonusOnlyRun
          ? 0
          : calculateAttendanceRuleDeduction(
              attendanceSnapshot.tardinessMins,
              hourlyRate,
              dailyRate,
              attendanceRuleByType.get("TARDINESS")
            )
        const undertimeDeduction = isBonusOnlyRun
          ? 0
          : calculateAttendanceRuleDeduction(
              attendanceSnapshot.undertimeMins,
              hourlyRate,
              dailyRate,
              attendanceRuleByType.get("UNDERTIME")
            )

        let sssEmployee = 0
        let sssEmployer = 0
        let philHealthEmployee = 0
        let philHealthEmployer = 0
        let pagIbigEmployee = 0
        let pagIbigEmployer = 0

        const matchingSss = sssTables.find((table) => baseSalary >= toNumber(table.salaryBracketMin) && baseSalary <= toNumber(table.salaryBracketMax))
        const matchingPagIbig = pagIbigTables.find((table) => baseSalary >= toNumber(table.salaryBracketMin) && baseSalary <= toNumber(table.salaryBracketMax))

        const applySss =
          !isBonusOnlyRun &&
          shouldApplyByTiming(
          statutorySchedule.sss,
          run.payPeriod.pattern.payFrequencyCode,
          run.payPeriod.periodHalf
        )
        if (applySss) {
          if (matchingSss) {
            sssEmployee = roundCurrency(toNumber(matchingSss.employeeShare) + toNumber(matchingSss.wispEmployee))
            sssEmployer = roundCurrency(toNumber(matchingSss.employerShare) + toNumber(matchingSss.wispEmployer))
            if (sssEmployee > 0) {
              statutoryDiagnostics.employeeStats.sssApplied += 1
            }
          } else {
            statutoryDiagnostics.employeeStats.sssNoBracketMatch += 1
          }
        } else {
          statutoryDiagnostics.employeeStats.sssSkippedByTiming += 1
        }

        const applyPhilHealth =
          !isBonusOnlyRun &&
          shouldApplyByTiming(
          statutorySchedule.philHealth,
          run.payPeriod.pattern.payFrequencyCode,
          run.payPeriod.periodHalf
        )
        if (applyPhilHealth) {
          if (philHealthTable) {
            const compensationBase = Math.min(Math.max(baseSalary, toNumber(philHealthTable.monthlyFloor)), toNumber(philHealthTable.monthlyCeiling))
            const totalPremium = compensationBase * toNumber(philHealthTable.premiumRate)
            philHealthEmployee = roundCurrency(totalPremium * toNumber(philHealthTable.employeeSharePercent))
            philHealthEmployer = roundCurrency(totalPremium * toNumber(philHealthTable.employerSharePercent))
            if (philHealthEmployee > 0) {
              statutoryDiagnostics.employeeStats.philHealthApplied += 1
            }
          } else {
            statutoryDiagnostics.employeeStats.philHealthNoActiveConfig += 1
          }
        } else {
          statutoryDiagnostics.employeeStats.philHealthSkippedByTiming += 1
        }

        const applyPagIbig =
          !isBonusOnlyRun &&
          shouldApplyByTiming(
          statutorySchedule.pagIbig,
          run.payPeriod.pattern.payFrequencyCode,
          run.payPeriod.periodHalf
        )
        if (applyPagIbig) {
          if (matchingPagIbig) {
            const cappedCompensation = Math.min(baseSalary, toNumber(matchingPagIbig.maxMonthlyCompensation))
            pagIbigEmployee = roundCurrency(cappedCompensation * toNumber(matchingPagIbig.employeeRatePercent))
            pagIbigEmployer = roundCurrency(cappedCompensation * toNumber(matchingPagIbig.employerRatePercent))
            if (pagIbigEmployee > 0) {
              statutoryDiagnostics.employeeStats.pagIbigApplied += 1
            }
          } else {
            statutoryDiagnostics.employeeStats.pagIbigNoBracketMatch += 1
          }
        } else {
          statutoryDiagnostics.employeeStats.pagIbigSkippedByTiming += 1
        }

        const provisionalTaxableIncome = roundCurrency(
          Math.max(0, grossPay - (sssEmployee + philHealthEmployee + pagIbigEmployee))
        )
        const previousPaidTotals = paidPayslipTotalsByEmployee.get(employee.id) ?? { grossPay: 0, netPay: 0, withholdingTax: 0 }
        const ytdContributionMap = ytdContributionsByEmployee.get(employee.id) ?? new Map<string, number>()

        const recurringDeductionLines: DeductionLine[] = []
        const netBaseForRecurring = Math.max(
          0,
          grossPay - (tardinessDeduction + undertimeDeduction + sssEmployee + philHealthEmployee + pagIbigEmployee)
        )

        for (const recurring of isBonusOnlyRun ? [] : employee.recurringDeductions) {
          const periodApplicability = recurring.deductionType.payPeriodApplicability
          if (periodApplicability === "FIRST_HALF" && run.payPeriod.periodHalf !== "FIRST") continue
          if (periodApplicability === "SECOND_HALF" && run.payPeriod.periodHalf !== "SECOND") continue
          if (recurring.frequency === "MONTHLY" && !secondHalfPeriod) continue

          let amount = toNumber(recurring.amount)
          if (recurring.isPercentage && recurring.percentageRate) {
            const rate = toNumber(recurring.percentageRate)
            if (recurring.deductionType.percentageBase === "BASIC") amount = basicPay * rate
            else if (recurring.deductionType.percentageBase === "NET") amount = netBaseForRecurring * rate
            else amount = grossPay * rate
          }

          if (recurring.deductionType.maxDeductionLimit) amount = Math.min(amount, toNumber(recurring.deductionType.maxDeductionLimit))
          const normalizedAmount = roundCurrency(Math.max(amount, 0))
          if (normalizedAmount <= 0) continue

          recurringDeductionLines.push({
            deductionTypeId: recurring.deductionTypeId,
            description: recurring.description || recurring.deductionType.name,
            amount: normalizedAmount,
            isPreTax: recurring.deductionType.isPreTax,
            referenceType: "RECURRING",
            referenceId: recurring.id,
          })
        }

        const preTaxRecurringTotal = roundCurrency(
          recurringDeductionLines
            .filter((line) => line.isPreTax)
            .reduce((sum, line) => sum + line.amount, 0)
        )

        const taxableIncome = roundCurrency(Math.max(0, provisionalTaxableIncome - preTaxRecurringTotal))

        let withholdingTax = 0
        const applyWithholdingTax =
          !isBonusOnlyRun &&
          shouldApplyByTiming(
          statutorySchedule.withholdingTax,
          run.payPeriod.pattern.payFrequencyCode,
          run.payPeriod.periodHalf
        )
        if (applyWithholdingTax) {
          if (employee.isSubstitutedFiling) {
            withholdingTax = roundCurrency(taxableIncome * 0.08)
            if (withholdingTax > 0) {
              statutoryDiagnostics.employeeStats.withholdingTaxApplied += 1
            }
          } else {
            const mandatoryContributionsBeforeCurrentRun =
              (ytdContributionMap.get("SSS") ?? 0) +
              (ytdContributionMap.get("PHILHEALTH") ?? 0) +
              (ytdContributionMap.get("PAGIBIG") ?? 0)
            const mandatoryContributionsProjected =
              mandatoryContributionsBeforeCurrentRun + sssEmployee + philHealthEmployee + pagIbigEmployee

            const bonusBenefitsBeforeCurrentRun = paidBonusBenefitsYtdByEmployee.get(employee.id) ?? 0
            const bonusBenefitsProjected = Math.min(90000, bonusBenefitsBeforeCurrentRun)

            const preTaxRecurringBeforeCurrentRun = paidPreTaxRecurringYtdByEmployee.get(employee.id) ?? 0
            const preTaxRecurringProjected = preTaxRecurringBeforeCurrentRun + preTaxRecurringTotal

            const annualGrossProjected = previousPaidTotals.grossPay + grossPay
            const annualTaxableProjected = Math.max(
              0,
              annualGrossProjected - mandatoryContributionsProjected - bonusBenefitsProjected - preTaxRecurringProjected
            )

            if (activeAnnualTaxRows.length > 0) {
              const annualTaxDueProjected = computeAnnualTaxFromBracketRows(
                annualTaxableProjected,
                activeAnnualTaxRows
              )
              withholdingTax = roundCurrency(Math.max(0, annualTaxDueProjected - previousPaidTotals.withholdingTax))
              if (withholdingTax > 0) {
                statutoryDiagnostics.employeeStats.withholdingTaxApplied += 1
              }
            } else {
              const taxBracket = activeTaxRows.find(
                (table) =>
                  taxableIncome >= toNumber(table.bracketOver) &&
                  taxableIncome <= toNumber(table.bracketNotOver)
              )

              if (taxBracket) {
                withholdingTax = roundCurrency(
                  toNumber(taxBracket.baseTax) +
                    (taxableIncome - toNumber(taxBracket.excessOver)) * toNumber(taxBracket.taxRatePercent)
                )
                if (withholdingTax > 0) {
                  statutoryDiagnostics.employeeStats.withholdingTaxApplied += 1
                }
              } else if (taxableIncome > 0) {
                statutoryDiagnostics.employeeStats.withholdingTaxNoBracketMatch += 1
              }
            }
          }
        } else {
          statutoryDiagnostics.employeeStats.withholdingTaxSkippedByTiming += 1
        }

        const manualAdjustmentDeductions: DeductionLine[] = (manualAdjustments?.deductions ?? []).map((item) => ({
          deductionTypeId: "",
          description: item.description,
          amount: roundCurrency(Math.max(item.amount, 0)),
          referenceType: item.referenceType ?? "ADJUSTMENT",
        }))

        const baseNetBeforeLoans = Math.max(
          0,
          grossPay -
            (tardinessDeduction +
              undertimeDeduction +
              sssEmployee +
              philHealthEmployee +
              pagIbigEmployee +
              withholdingTax +
              recurringDeductionLines.reduce((sum, item) => sum + item.amount, 0) +
              manualAdjustmentDeductions.reduce((sum, item) => sum + item.amount, 0))
        )

        const loanDeductionLines: DeductionLine[] = []
        const appliedLoanAmortizations: Array<{
          amortizationId: string
          loanId: string
          loanNumber: string
          amount: number
          principalAmount: number
          interestAmount: number
        }> = []

        let availableNetForLoans = baseNetBeforeLoans
        for (const amortization of isBonusOnlyRun ? [] : dueLoanAmortizationsByEmployee.get(employee.id) ?? []) {
          const amortizationAmount = roundCurrency(toNumber(amortization.totalPayment))
          if (amortizationAmount <= 0) {
            continue
          }

          if (availableNetForLoans < amortizationAmount) {
            continue
          }

          loanDeductionLines.push({
            deductionTypeId: "",
            description: `Loan Amortization (${amortization.loan.loanNumber})`,
            amount: amortizationAmount,
            referenceType: "LOAN",
            referenceId: amortization.loanId,
          })

          appliedLoanAmortizations.push({
            amortizationId: amortization.id,
            loanId: amortization.loanId,
            loanNumber: amortization.loan.loanNumber,
            amount: amortizationAmount,
            principalAmount: toNumber(amortization.principalAmount),
            interestAmount: toNumber(amortization.interestAmount),
          })

          availableNetForLoans = roundCurrency(Math.max(availableNetForLoans - amortizationAmount, 0))
        }

        const deductionLines: DeductionLine[] = []
        if (tardinessDeduction > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("TARDINESS", "Tardiness Deduction"),
            description: "Tardiness Deduction",
            amount: tardinessDeduction,
            referenceType: "ATTENDANCE",
          })
        }
        if (undertimeDeduction > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("UNDERTIME", "Undertime Deduction"),
            description: "Undertime Deduction",
            amount: undertimeDeduction,
            referenceType: "ATTENDANCE",
          })
        }
        if (sssEmployee > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("SSS", "SSS Contribution"),
            description: "SSS Contribution",
            amount: sssEmployee,
            employerShare: sssEmployer,
            referenceType: "GOVERNMENT",
          })
        }
        if (philHealthEmployee > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("PHILHEALTH", "PhilHealth Contribution"),
            description: "PhilHealth Contribution",
            amount: philHealthEmployee,
            employerShare: philHealthEmployer,
            referenceType: "GOVERNMENT",
          })
        }
        if (pagIbigEmployee > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("PAGIBIG", "Pag-IBIG Contribution"),
            description: "Pag-IBIG Contribution",
            amount: pagIbigEmployee,
            employerShare: pagIbigEmployer,
            referenceType: "GOVERNMENT",
          })
        }
        if (withholdingTax > 0) {
          deductionLines.push({
            deductionTypeId: await getOrCreateDeductionTypeId("WTAX", "Withholding Tax"),
            description: "Withholding Tax",
            amount: withholdingTax,
            referenceType: "TAX",
          })
        }
        deductionLines.push(...recurringDeductionLines)

        for (const item of manualAdjustmentDeductions) {
          deductionLines.push({
            ...item,
            deductionTypeId: await getOrCreateDeductionTypeId("ADJUSTMENT", "Manual Adjustment"),
          })
        }

        for (const item of loanDeductionLines) {
          deductionLines.push({
            ...item,
            deductionTypeId: await getOrCreateDeductionTypeId("LOAN_PAYMENT", "Loan Payment"),
          })
        }

        const totalDeductionsForPayslip = roundCurrency(deductionLines.reduce((sum, line) => sum + line.amount, 0))
        const netPay = roundCurrency(Math.max(grossPay - totalDeductionsForPayslip, 0))
        const totalEarnings = roundCurrency(grossPay - basicPay)

        const payslip = await tx.payslip.create({
          data: {
            payslipNumber: `PSL-${run.runNumber.replace(/^RUN-/, "")}-${employee.id.slice(0, 6).toUpperCase()}`,
            payrollRunId: run.id,
            employeeId: employee.id,
            baseSalary: toDecimalText(roundCurrency(baseSalary)),
            dailyRate: roundQuantity(dailyRate).toFixed(4),
            hourlyRate: roundQuantity(hourlyRate).toFixed(4),
            workingDays: toDecimalText(
              isBonusOnlyRun ? 0 : (run.payPeriod.workingDays ?? attendanceSnapshot.totalWorkingDays)
            ),
            daysWorked: toDecimalText(isBonusOnlyRun ? 0 : attendanceSnapshot.totalPayableDays),
            daysAbsent: toDecimalText(attendanceSnapshot.unpaidAbsences),
            hoursWorked: attendanceSnapshot.hoursWorked > 0 ? toDecimalText(attendanceSnapshot.hoursWorked) : null,
            overtimeHours: toDecimalText(attendanceSnapshot.overtimeHours),
            tardinessMins: attendanceSnapshot.tardinessMins,
            undertimeMins: attendanceSnapshot.undertimeMins,
            nightDiffHours: toDecimalText(attendanceSnapshot.nightDiffHours),
            basicPay: toDecimalText(basicPay),
            grossPay: toDecimalText(grossPay),
            totalEarnings: toDecimalText(totalEarnings),
            totalDeductions: toDecimalText(totalDeductionsForPayslip),
            netPay: toDecimalText(netPay),
            sssEmployee: toDecimalText(sssEmployee),
            sssEmployer: toDecimalText(sssEmployer),
            philHealthEmployee: toDecimalText(philHealthEmployee),
            philHealthEmployer: toDecimalText(philHealthEmployer),
            pagIbigEmployee: toDecimalText(pagIbigEmployee),
            pagIbigEmployer: toDecimalText(pagIbigEmployer),
            withholdingTax: toDecimalText(withholdingTax),
            ytdGrossPay: toDecimalText(previousPaidTotals.grossPay + grossPay),
            ytdTaxableIncome: toDecimalText(previousPaidTotals.grossPay + taxableIncome),
            ytdTaxWithheld: toDecimalText(previousPaidTotals.withholdingTax + withholdingTax),
            ytdSSS: toDecimalText((ytdContributionMap.get("SSS") ?? 0) + sssEmployee),
            ytdPhilHealth: toDecimalText((ytdContributionMap.get("PHILHEALTH") ?? 0) + philHealthEmployee),
            ytdPagIbig: toDecimalText((ytdContributionMap.get("PAGIBIG") ?? 0) + pagIbigEmployee),
            ytdNetPay: toDecimalText(previousPaidTotals.netPay + netPay),
          },
          select: { id: true },
        })

        const earningLines: EarningLine[] = [
          {
            earningTypeId: await getOrCreateEarningTypeId(
              isThirteenthMonthRun
                ? "THIRTEENTH_MONTH"
                : isMidYearBonusRun
                  ? "MID_YEAR_BONUS"
                  : "BASIC_PAY",
              isThirteenthMonthRun ? "13th Month Pay" : isMidYearBonusRun ? "Mid-Year Bonus" : "Basic Pay"
            ),
            description: isThirteenthMonthRun ? "13th Month Pay" : isMidYearBonusRun ? "Mid-Year Bonus" : "Basic Pay",
            amount: basicPay,
            days: isBonusOnlyRun ? undefined : attendanceSnapshot.totalPayableDays,
            rate: isBonusOnlyRun ? undefined : dailyRate,
            isTaxable: true,
          },
          ...recurringEarningLines,
          ...manualAdjustmentEarnings.map((line) => ({
            ...line,
            earningTypeId: "",
          })),
        ]
        if (overtimePay > 0) {
          earningLines.push({
            earningTypeId: await getOrCreateEarningTypeId("OVERTIME", "Overtime Pay"),
            description: "Overtime Pay",
            amount: overtimePay,
            hours: attendanceSnapshot.overtimeHours,
            rate: hourlyRate,
            isTaxable: true,
          })
        }
        if (nightDiffPay > 0) {
          earningLines.push({
            earningTypeId: await getOrCreateEarningTypeId("NIGHT_DIFF", "Night Differential"),
            description: "Night Differential",
            amount: nightDiffPay,
            hours: attendanceSnapshot.nightDiffHours,
            rate: hourlyRate,
            isTaxable: true,
          })
        }
        if (holidayPay > 0) {
          earningLines.push({
            earningTypeId: await getOrCreateEarningTypeId("HOLIDAY_PAY", "Holiday Premium"),
            description: "Holiday Premium",
            amount: holidayPay,
            isTaxable: true,
          })
        }

        for (let index = 0; index < earningLines.length; index += 1) {
          if (earningLines[index].earningTypeId) continue
          earningLines[index] = {
            ...earningLines[index],
            earningTypeId: await getOrCreateEarningTypeId("ADJUSTMENT", "Manual Adjustment"),
          }
        }

        await tx.payslipEarning.createMany({
          data: earningLines.map((line) => ({
            payslipId: payslip.id,
            earningTypeId: line.earningTypeId,
            description: line.description,
            amount: toDecimalText(line.amount),
            hours: line.hours ? toDecimalText(line.hours) : null,
            days: line.days ? toDecimalText(line.days) : null,
            rate: line.rate ? roundQuantity(line.rate).toFixed(4) : null,
            isTaxable: line.isTaxable,
          })),
        })

        await tx.payslipDeduction.createMany({
          data: deductionLines.map((line) => ({
            payslipId: payslip.id,
            deductionTypeId: line.deductionTypeId,
            description: line.description,
            amount: toDecimalText(line.amount),
            employerShare: line.employerShare ? toDecimalText(line.employerShare) : null,
            referenceType: line.referenceType ?? null,
            referenceId: line.referenceId ?? null,
          })),
        })

        for (const loan of appliedLoanAmortizations) {
          await tx.loanPayment.create({
            data: {
              loanId: loan.loanId,
              paymentDate: run.payPeriod.cutoffEndDate,
              amountPaid: toDecimalText(loan.amount),
              principalPaid: toDecimalText(loan.principalAmount),
              interestPaid: toDecimalText(loan.interestAmount),
              balanceAfter: toDecimalText(0),
              paymentSourceCode: "PAYROLL",
              statusCode: "DEDUCTED",
              payrollRunId: run.id,
              remarks: `Auto-deducted from payroll run ${run.runNumber}`,
            },
          })

          await tx.loanAmortization.update({
            where: { id: loan.amortizationId },
            data: {
              isPaid: true,
              paidDate: run.payPeriod.cutoffEndDate,
              paidAmount: toDecimalText(loan.amount),
            },
          })

          const currentLoan = await tx.loan.findUnique({
            where: { id: loan.loanId },
            select: { principalBalance: true, interestBalance: true },
          })

          if (currentLoan) {
            const nextPrincipalBalance = roundCurrency(
              Math.max(toNumber(currentLoan.principalBalance) - loan.principalAmount, 0)
            )
            const nextInterestBalance = roundCurrency(
              Math.max(toNumber(currentLoan.interestBalance) - loan.interestAmount, 0)
            )
            const nextTotalBalance = roundCurrency(nextPrincipalBalance + nextInterestBalance)

            await tx.loan.update({
              where: { id: loan.loanId },
              data: {
                principalBalance: toDecimalText(nextPrincipalBalance),
                interestBalance: toDecimalText(nextInterestBalance),
                totalBalance: toDecimalText(nextTotalBalance),
                statusCode: nextTotalBalance <= 0 ? "FULLY_PAID" : "ACTIVE",
              },
            })

            await tx.loanPayment.updateMany({
              where: {
                loanId: loan.loanId,
                payrollRunId: run.id,
                paymentDate: run.payPeriod.cutoffEndDate,
              },
              data: {
                balanceAfter: toDecimalText(nextTotalBalance),
              },
            })
          }
        }

        processedEmployeeCount += 1
        totalGross += grossPay
        totalDeductions += totalDeductionsForPayslip
        totalNet += netPay
        totalEmployerContributions += sssEmployer + philHealthEmployer + pagIbigEmployer

        employeeCalculationTraces.push({
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employeeName: `${employee.lastName}, ${employee.firstName}`,
          attendance: {
            workingDays: attendanceSnapshot.totalWorkingDays,
            payableDays: attendanceSnapshot.totalPayableDays,
            unpaidAbsences: attendanceSnapshot.unpaidAbsences,
            tardinessMins: attendanceSnapshot.tardinessMins,
            undertimeMins: attendanceSnapshot.undertimeMins,
            overtimeHours: attendanceSnapshot.overtimeHours,
            nightDiffHours: attendanceSnapshot.nightDiffHours,
          },
          rates: {
            salaryRateType: salary.salaryRateTypeCode,
            baseSalary,
            dailyRate,
            hourlyRate,
          },
          earnings: {
            basicPay,
            ...(isThirteenthMonthRun ? { ytdRegularBasicFor13th: ytdRegularBasic } : {}),
            overtimePay,
            nightDiffPay,
            holidayPay,
            recurringEarnings: recurringEarningLines.reduce((sum, line) => sum + line.amount, 0),
            adjustmentEarnings: manualAdjustmentEarnings.reduce((sum, line) => sum + line.amount, 0),
            grossPay,
          },
          deductions: {
            tardiness: tardinessDeduction,
            undertime: undertimeDeduction,
            sss: sssEmployee,
            philHealth: philHealthEmployee,
            pagIbig: pagIbigEmployee,
            preTaxRecurring: preTaxRecurringTotal,
            withholdingTax,
            recurring: recurringDeductionLines.reduce((sum, line) => sum + line.amount, 0),
            adjustments: manualAdjustmentDeductions.reduce((sum, line) => sum + line.amount, 0),
            loans: loanDeductionLines.reduce((sum, line) => sum + line.amount, 0),
            totalDeductions: totalDeductionsForPayslip,
            netPay,
          },
        })

        employeeSummaries.push({
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          employeeName: `${employee.lastName}, ${employee.firstName}`,
          grossPay,
          totalDeductions: totalDeductionsForPayslip,
          netPay,
        })
      }

      if (processedEmployeeCount === 0) {
        throw new Error("No employees were processed. Ensure active salary records exist for all selected employees.")
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.COMPUTED,
          currentStepNumber: 3,
          currentStepName: PayrollProcessStepName.CALCULATE_PAYROLL,
          totalEmployees: processedEmployeeCount,
          totalGrossPay: toDecimalText(roundCurrency(totalGross)),
          totalDeductions: toDecimalText(roundCurrency(totalDeductions)),
          totalNetPay: toDecimalText(roundCurrency(totalNet)),
          totalEmployerContributions: toDecimalText(roundCurrency(totalEmployerContributions)),
          totalEmployerCost: toDecimalText(roundCurrency(totalGross + totalEmployerContributions)),
          processedAt: new Date(),
          processedById: context.userId,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 3 } },
        data: {
          status: PayrollProcessStepStatus.COMPLETED,
          isCompleted: true,
          completedAt: new Date(),
          notes: JSON.stringify({
            calculationVersion: PAYROLL_CALCULATION_VERSION,
            formulaPolicy: {
              locale: "PH",
              timezone: "Asia/Manila",
              preTaxRecurringReducesTaxableIncome: true,
              leaveFallbackOnUnmatchedOnLeave: "UNPAID",
              runTypeCode: run.runTypeCode,
              thirteenthMonthFormula: isThirteenthMonthRun ? "(ytdRegularBasicOrProratedFallback) / 12" : undefined,
              midYearBonusFormula: isMidYearBonusRun ? "baseSalary / 2" : undefined,
            },
            processedEmployeeCount,
            skippedEmployeeCount,
            statutoryDiagnostics,
            employeeSummaries,
            employeeCalculationTraces,
          }),
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 4 } },
        data: { status: PayrollProcessStepStatus.PENDING, isCompleted: false, completedAt: null },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "CALCULATE_PAYROLL_RUN",
          changes: [
            { fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.COMPUTED },
            { fieldName: "processedEmployeeCount", newValue: processedEmployeeCount },
            { fieldName: "totalGrossPay", newValue: roundCurrency(totalGross) },
            { fieldName: "totalDeductions", newValue: roundCurrency(totalDeductions) },
            { fieldName: "totalNetPay", newValue: roundCurrency(totalNet) },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Payroll calculation completed." }
  } catch (error) {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.VALIDATING,
          currentStepNumber: 3,
          currentStepName: PayrollProcessStepName.CALCULATE_PAYROLL,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 3 } },
        data: {
          status: PayrollProcessStepStatus.FAILED,
          isCompleted: false,
          completedAt: null,
          notes: error instanceof Error ? error.message : "Unknown error",
        },
      })
    })

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to calculate payroll run: ${message}` }
  }
}

export async function proceedToReviewPayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const step3 = run.processSteps.find((step) => step.stepNumber === 3)
  if (!step3?.isCompleted) {
    return { ok: false, error: "Calculation step must be completed before proceeding." }
  }

  if (run.currentStepNumber > 3 || run.statusCode === PayrollRunStatus.PAID) {
    return { ok: false, error: "Run is already beyond calculation step." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.FOR_REVIEW,
          currentStepNumber: 4,
          currentStepName: PayrollProcessStepName.REVIEW_ADJUST,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 4 } },
        data: {
          status: PayrollProcessStepStatus.IN_PROGRESS,
          isCompleted: false,
          completedAt: null,
        },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "PROCEED_TO_REVIEW_PAYROLL",
          changes: [
            { fieldName: "currentStepNumber", oldValue: run.currentStepNumber, newValue: 4 },
            { fieldName: "currentStepName", oldValue: run.currentStepName, newValue: PayrollProcessStepName.REVIEW_ADJUST },
            { fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.FOR_REVIEW },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Calculation reviewed. Proceeded to review/adjust step." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to proceed to review: ${message}` }
  }
}

export async function completeReviewPayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const step3 = run.processSteps.find((step) => step.stepNumber === 3)
  if (!step3?.isCompleted) {
    return { ok: false, error: "Payroll must be calculated before review completion." }
  }

  if (run.currentStepNumber > 4 || run.statusCode === PayrollRunStatus.PAID) {
    return { ok: false, error: "Review step is no longer editable for this run." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.FOR_REVIEW,
          currentStepNumber: 5,
          currentStepName: PayrollProcessStepName.GENERATE_PAYSLIPS,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 4 } },
        data: {
          status: PayrollProcessStepStatus.COMPLETED,
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 5 } },
        data: {
          status: PayrollProcessStepStatus.IN_PROGRESS,
          isCompleted: false,
          completedAt: null,
        },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "COMPLETE_PAYROLL_REVIEW",
          changes: [
            { fieldName: "currentStepNumber", oldValue: run.currentStepNumber, newValue: 5 },
            { fieldName: "currentStepName", oldValue: run.currentStepName, newValue: PayrollProcessStepName.GENERATE_PAYSLIPS },
            { fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.FOR_REVIEW },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Payroll review completed. Ready to generate payslips." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to complete review: ${message}` }
  }
}

export async function generatePayslipsPayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const step4 = run.processSteps.find((step) => step.stepNumber === 4)
  if (!step4?.isCompleted) {
    return { ok: false, error: "Review and adjustment step must be completed first." }
  }

  if (run.currentStepNumber > 5 || run.statusCode === PayrollRunStatus.PAID) {
    return { ok: false, error: "Payslip generation is no longer available for this run." }
  }

  const payslipCount = await db.payslip.count({ where: { payrollRunId: run.id } })
  if (payslipCount === 0) {
    return { ok: false, error: "No payslips found. Run calculation first." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payslip.updateMany({
        where: {
          payrollRunId: run.id,
        },
        data: {
          generatedAt: new Date(),
        },
      })

      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          approvedAt: run.approvedAt ?? new Date(),
          approvedById: run.approvedById ?? context.userId,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 5 } },
        data: {
          status: PayrollProcessStepStatus.COMPLETED,
          isCompleted: true,
          completedAt: new Date(),
          notes: JSON.stringify({ payslipCount }),
        },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "GENERATE_PAYSLIPS",
          changes: [{ fieldName: "payslipCount", newValue: payslipCount }],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Payslips generated. Review and proceed when ready." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to generate payslips: ${message}` }
  }
}

export async function proceedToClosePayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const step5 = run.processSteps.find((step) => step.stepNumber === 5)
  if (!step5?.isCompleted) {
    return { ok: false, error: "Generate payslips step must be completed before proceeding." }
  }

  if (run.currentStepNumber > 5 || run.statusCode === PayrollRunStatus.PAID) {
    return { ok: false, error: "Run is already beyond payslip generation." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.FOR_PAYMENT,
          currentStepNumber: 6,
          currentStepName: PayrollProcessStepName.CLOSE_RUN,
          approvedAt: run.approvedAt ?? new Date(),
          approvedById: run.approvedById ?? context.userId,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 6 } },
        data: {
          status: PayrollProcessStepStatus.IN_PROGRESS,
          isCompleted: false,
          completedAt: null,
        },
      })

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "PROCEED_TO_CLOSE_PAYROLL",
          changes: [
            { fieldName: "currentStepNumber", oldValue: run.currentStepNumber, newValue: 6 },
            { fieldName: "currentStepName", oldValue: run.currentStepName, newValue: PayrollProcessStepName.CLOSE_RUN },
            { fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.FOR_PAYMENT },
          ],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Proceeded to close period step." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to proceed to close step: ${message}` }
  }
}

export async function closePayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  if (run.statusCode === PayrollRunStatus.PAID) {
    return { ok: true, message: "Payroll run is already closed and locked." }
  }

  const closableStatuses = new Set<PayrollRunStatus>([PayrollRunStatus.FOR_PAYMENT, PayrollRunStatus.APPROVED])

  if (!closableStatuses.has(run.statusCode)) {
    return { ok: false, error: "Payroll run is not in a closable state." }
  }

  const step5 = run.processSteps.find((step) => step.stepNumber === 5)
  if (!step5?.isCompleted) {
    return { ok: false, error: "Generate payslips step must be completed before closing run." }
  }

  try {
    await db.$transaction(async (tx) => {
      const transition = await tx.payrollRun.updateMany({
        where: {
          id: run.id,
          statusCode: { in: [PayrollRunStatus.FOR_PAYMENT, PayrollRunStatus.APPROVED] },
        },
        data: {
          statusCode: PayrollRunStatus.PAID,
          currentStepNumber: 6,
          currentStepName: PayrollProcessStepName.CLOSE_RUN,
          paidAt: new Date(),
          paidById: context.userId,
          approvedAt: run.approvedAt ?? new Date(),
          approvedById: run.approvedById ?? context.userId,
        },
      })

      if (transition.count === 0) {
        throw new Error("Payroll run was already closed by another request.")
      }

      await tx.payrollProcessStep.updateMany({
        where: { payrollRunId: run.id, stepNumber: { in: [4, 5] }, isCompleted: false },
        data: {
          status: PayrollProcessStepStatus.COMPLETED,
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 6 } },
        data: {
          status: PayrollProcessStepStatus.COMPLETED,
          isCompleted: true,
          completedAt: new Date(),
        },
      })

      if (run.runTypeCode === "REGULAR") {
        await tx.payPeriod.update({
          where: { id: run.payPeriodId },
          data: {
            statusCode: "LOCKED",
            lockedAt: new Date(),
            lockedById: context.userId,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "CLOSE_PAYROLL_RUN",
          changes: [{ fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.PAID }],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Payroll run closed successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to close payroll run: ${message}` }
  }
}

export async function reopenPayrollRunAction(input: PayrollRunActionInput): Promise<ActionResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access
  const { context } = access

  const run = await ensureRunForCompany(payload.runId, context.companyId)
  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  const reopenableStatuses = new Set<PayrollRunStatus>([
    PayrollRunStatus.PAID,
    PayrollRunStatus.APPROVED,
    PayrollRunStatus.FOR_PAYMENT,
  ])

  if (!reopenableStatuses.has(run.statusCode)) {
    return { ok: false, error: "Only approved/paid payroll runs can be reopened." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          statusCode: PayrollRunStatus.FOR_REVIEW,
          currentStepNumber: 4,
          currentStepName: PayrollProcessStepName.REVIEW_ADJUST,
          paidAt: null,
          paidById: null,
        },
      })

      await tx.payrollProcessStep.update({
        where: { payrollRunId_stepNumber: { payrollRunId: run.id, stepNumber: 4 } },
        data: { status: PayrollProcessStepStatus.IN_PROGRESS, isCompleted: false, completedAt: null },
      })

      await tx.payrollProcessStep.updateMany({
        where: { payrollRunId: run.id, stepNumber: { in: [5, 6] } },
        data: { status: PayrollProcessStepStatus.PENDING, isCompleted: false, completedAt: null },
      })

      if (run.runTypeCode === "REGULAR") {
        await tx.payPeriod.update({
          where: { id: run.payPeriodId },
          data: {
            statusCode: "OPEN",
            lockedAt: null,
            lockedById: null,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "PayrollRun",
          recordId: run.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "REOPEN_PAYROLL_RUN",
          changes: [{ fieldName: "statusCode", oldValue: run.statusCode, newValue: PayrollRunStatus.FOR_REVIEW }],
        },
        tx
      )
    })

    writeRunRevalidation(context.companyId, run.id)
    return { ok: true, message: "Payroll run reopened for review." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reopen payroll run: ${message}` }
  }
}
