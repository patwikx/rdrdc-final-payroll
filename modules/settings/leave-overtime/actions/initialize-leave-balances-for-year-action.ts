"use server"

import { revalidatePath } from "next/cache"

import { LeaveProrationMethod, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  initializeLeaveBalancesForYearInputSchema,
  type InitializeLeaveBalancesForYearInput,
} from "@/modules/settings/leave-overtime/schemas/initialize-leave-balances-action-schema"

type InitializationStats = {
  employeesConsidered: number
  leaveTypesConsidered: number
  balancesCreated: number
  balancesSkippedExisting: number
  balancesSkippedNoPolicy: number
}

type InitializeLeaveBalancesForYearActionResult =
  | { ok: true; message: string; stats: InitializationStats }
  | { ok: false; error: string }

const toYearBoundsUtc = (year: number): { start: Date; end: Date } => {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  }
}

const roundTo2 = (value: number): number => {
  return Math.round(value * 100) / 100
}

const toDecimalText = (value: number): string => {
  return roundTo2(value).toFixed(2)
}

const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (!value) return 0
  return Number(value)
}

const daysInYear = (year: number): number => {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

const dayDiffInclusive = (start: Date, end: Date): number => {
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

const monthDiffInclusive = (start: Date, end: Date): number => {
  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear()
  const monthDelta = end.getUTCMonth() - start.getUTCMonth()
  return yearDelta * 12 + monthDelta + 1
}

const computeProratedEntitlement = ({
  annualEntitlement,
  prorationMethod,
  hireDate,
  year,
}: {
  annualEntitlement: number
  prorationMethod: LeaveProrationMethod
  hireDate: Date
  year: number
}): number => {
  const { start: yearStart, end: yearEnd } = toYearBoundsUtc(year)

  if (hireDate <= yearStart) {
    return roundTo2(annualEntitlement)
  }

  if (hireDate > yearEnd) {
    return 0
  }

  if (prorationMethod === LeaveProrationMethod.FULL) {
    return roundTo2(annualEntitlement)
  }

  if (prorationMethod === LeaveProrationMethod.PRORATED_DAY) {
    const eligibleDays = dayDiffInclusive(hireDate, yearEnd)
    return roundTo2((annualEntitlement * eligibleDays) / daysInYear(year))
  }

  const eligibleMonths = monthDiffInclusive(hireDate, yearEnd)
  return roundTo2((annualEntitlement * eligibleMonths) / 12)
}

export async function initializeLeaveBalancesForYearAction(
  input: InitializeLeaveBalancesForYearInput
): Promise<InitializeLeaveBalancesForYearActionResult> {
  const parsed = initializeLeaveBalancesForYearInputSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid initialization payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid initialization payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to leave policy settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  const { start: yearStart, end: yearEnd } = toYearBoundsUtc(payload.year)
  const previousYear = payload.year - 1

  try {
    const transactionResult = await db.$transaction(async (tx) => {
      const [employees, leaveTypes] = await Promise.all([
        tx.employee.findMany({
          where: {
            companyId: context.companyId,
            deletedAt: null,
            isActive: true,
            hireDate: { lte: yearEnd },
            OR: [{ separationDate: null }, { separationDate: { gte: yearStart } }],
          },
          select: {
            id: true,
            hireDate: true,
            employmentStatusId: true,
          },
        }),
        tx.leaveType.findMany({
          where: {
            isActive: true,
            OR: [{ companyId: context.companyId }, { companyId: null }],
            AND: [
              {
                OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: yearEnd } }],
              },
              {
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: yearStart } }],
              },
            ],
          },
          select: {
            id: true,
            isCarriedOver: true,
            maxCarryOverDays: true,
          },
        }),
      ])

      if (employees.length === 0) {
        return {
          ok: true as const,
          stats: {
            employeesConsidered: 0,
            leaveTypesConsidered: leaveTypes.length,
            balancesCreated: 0,
            balancesSkippedExisting: 0,
            balancesSkippedNoPolicy: 0,
          },
          message: `No eligible employees found for ${payload.year}.`,
        }
      }

      if (leaveTypes.length === 0) {
        return {
          ok: true as const,
          stats: {
            employeesConsidered: employees.length,
            leaveTypesConsidered: 0,
            balancesCreated: 0,
            balancesSkippedExisting: 0,
            balancesSkippedNoPolicy: 0,
          },
          message: "No active leave types found for this company.",
        }
      }

      const employmentStatusIds = Array.from(
        new Set(employees.map((employee) => employee.employmentStatusId).filter((value): value is string => Boolean(value)))
      )

      const [policies, previousYearBalances, existingYearBalances] = await Promise.all([
        employmentStatusIds.length === 0
          ? Promise.resolve([])
          : tx.leavePolicy.findMany({
              where: {
                leaveTypeId: { in: leaveTypes.map((leaveType) => leaveType.id) },
                employmentStatusId: { in: employmentStatusIds },
                isActive: true,
                effectiveFrom: { lte: yearEnd },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: yearStart } }],
              },
              orderBy: [{ effectiveFrom: "desc" }],
              select: {
                leaveTypeId: true,
                employmentStatusId: true,
                annualEntitlement: true,
                prorationMethodCode: true,
              },
            }),
        tx.leaveBalance.findMany({
          where: {
            year: previousYear,
            employeeId: { in: employees.map((employee) => employee.id) },
            leaveTypeId: { in: leaveTypes.map((leaveType) => leaveType.id) },
          },
          select: {
            employeeId: true,
            leaveTypeId: true,
            availableBalance: true,
          },
        }),
        tx.leaveBalance.findMany({
          where: {
            year: payload.year,
            employeeId: { in: employees.map((employee) => employee.id) },
            leaveTypeId: { in: leaveTypes.map((leaveType) => leaveType.id) },
          },
          select: {
            employeeId: true,
            leaveTypeId: true,
          },
        }),
      ])

      const policyByLeaveTypeAndStatus = new Map<string, (typeof policies)[number]>()
      for (const policy of policies) {
        const key = `${policy.leaveTypeId}:${policy.employmentStatusId}`
        if (!policyByLeaveTypeAndStatus.has(key)) {
          policyByLeaveTypeAndStatus.set(key, policy)
        }
      }

      const previousBalanceByEmployeeAndType = new Map<string, number>()
      for (const previousBalance of previousYearBalances) {
        const key = `${previousBalance.employeeId}:${previousBalance.leaveTypeId}`
        previousBalanceByEmployeeAndType.set(key, toNumber(previousBalance.availableBalance))
      }

      const existingBalanceKeys = new Set<string>()
      for (const existing of existingYearBalances) {
        existingBalanceKeys.add(`${existing.employeeId}:${existing.leaveTypeId}`)
      }

      const stats: InitializationStats = {
        employeesConsidered: employees.length,
        leaveTypesConsidered: leaveTypes.length,
        balancesCreated: 0,
        balancesSkippedExisting: 0,
        balancesSkippedNoPolicy: 0,
      }

      for (const employee of employees) {
        for (const leaveType of leaveTypes) {
          const balanceKey = `${employee.id}:${leaveType.id}`
          if (existingBalanceKeys.has(balanceKey)) {
            stats.balancesSkippedExisting += 1
            continue
          }

          const policyKey = employee.employmentStatusId ? `${leaveType.id}:${employee.employmentStatusId}` : null
          const matchedPolicy = policyKey ? policyByLeaveTypeAndStatus.get(policyKey) : undefined

          const previousAvailable = previousBalanceByEmployeeAndType.get(balanceKey) ?? 0
          const carryOverRaw = leaveType.isCarriedOver ? Math.max(previousAvailable, 0) : 0
          const hasCarryOverCap = leaveType.maxCarryOverDays !== null
          const carryOverCap = hasCarryOverCap ? toNumber(leaveType.maxCarryOverDays) : null
          const creditsCarriedOver =
            leaveType.isCarriedOver && carryOverCap !== null ? Math.min(carryOverRaw, Math.max(carryOverCap, 0)) : carryOverRaw

          if (!matchedPolicy && creditsCarriedOver <= 0) {
            stats.balancesSkippedNoPolicy += 1
            continue
          }

          const annualEntitlement = matchedPolicy ? toNumber(matchedPolicy.annualEntitlement) : 0
          const creditsEarned = matchedPolicy
            ? computeProratedEntitlement({
                annualEntitlement,
                prorationMethod: matchedPolicy.prorationMethodCode,
                hireDate: employee.hireDate,
                year: payload.year,
              })
            : 0

          const openingBalance = roundTo2(creditsCarriedOver)
          const currentBalance = roundTo2(openingBalance + creditsEarned)

          const createdBalance = await tx.leaveBalance.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: payload.year,
              openingBalance: toDecimalText(openingBalance),
              creditsEarned: toDecimalText(creditsEarned),
              creditsUsed: "0.00",
              creditsForfeited: "0.00",
              creditsConverted: "0.00",
              creditsCarriedOver: toDecimalText(openingBalance),
              currentBalance: toDecimalText(currentBalance),
              pendingRequests: "0.00",
              availableBalance: toDecimalText(currentBalance),
            },
            select: { id: true },
          })

          const transactionRows: Array<{
            leaveBalanceId: string
            transactionType: "CARRY_OVER" | "ACCRUAL"
            amount: string
            runningBalance: string
            referenceType: string
            remarks: string
            processedById: string
          }> = []

          if (openingBalance > 0) {
            transactionRows.push({
              leaveBalanceId: createdBalance.id,
              transactionType: "CARRY_OVER",
              amount: toDecimalText(openingBalance),
              runningBalance: toDecimalText(openingBalance),
              referenceType: "YEAR_INITIALIZATION",
              remarks: `Carry-over from ${previousYear}`,
              processedById: context.userId,
            })
          }

          if (creditsEarned > 0) {
            transactionRows.push({
              leaveBalanceId: createdBalance.id,
              transactionType: "ACCRUAL",
              amount: toDecimalText(creditsEarned),
              runningBalance: toDecimalText(currentBalance),
              referenceType: "YEAR_INITIALIZATION",
              remarks: `Year ${payload.year} entitlement initialization`,
              processedById: context.userId,
            })
          }

          if (transactionRows.length > 0) {
            await tx.leaveBalanceTransaction.createMany({
              data: transactionRows,
            })
          }

          stats.balancesCreated += 1
        }
      }

      await createAuditLog(
        {
          tableName: "LeaveBalance",
          recordId: `${context.companyId}:${payload.year}`,
          action: "CREATE",
          userId: context.userId,
          reason: "INITIALIZE_LEAVE_BALANCES_FOR_YEAR",
          changes: [
            { fieldName: "year", newValue: payload.year },
            { fieldName: "employeesConsidered", newValue: stats.employeesConsidered },
            { fieldName: "leaveTypesConsidered", newValue: stats.leaveTypesConsidered },
            { fieldName: "balancesCreated", newValue: stats.balancesCreated },
            { fieldName: "balancesSkippedExisting", newValue: stats.balancesSkippedExisting },
            { fieldName: "balancesSkippedNoPolicy", newValue: stats.balancesSkippedNoPolicy },
          ],
        },
        tx
      )

      return {
        ok: true as const,
        stats,
        message: `Initialized ${stats.balancesCreated} leave balance row(s) for ${payload.year}.`,
      }
    })

    if (!transactionResult.ok) {
      return transactionResult
    }

    revalidatePath(`/${context.companyId}/settings/leave-overtime`)
    revalidatePath(`/${context.companyId}/employee-portal`)
    revalidatePath(`/${context.companyId}/employee-portal/leaves`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return transactionResult
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to initialize leave balances: ${message}` }
  }
}
