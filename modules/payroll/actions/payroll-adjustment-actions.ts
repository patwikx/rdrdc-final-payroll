"use server"

import { revalidatePath } from "next/cache"
import { PayrollRunStatus, type Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  payslipAdjustmentsListInputSchema,
  removePayslipAdjustmentInputSchema,
  upsertPayslipAdjustmentInputSchema,
  type PayslipAdjustmentsListInput,
  type RemovePayslipAdjustmentInput,
  type UpsertPayslipAdjustmentInput,
} from "@/modules/payroll/schemas/payroll-adjustment-schema"

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

type GetAdjustmentsResult =
  | {
      ok: true
      data: Array<{
        id: string
        type: "EARNING" | "DEDUCTION"
        description: string
        amount: number
        isTaxable: boolean
        createdAt: string
      }>
    }
  | { ok: false; error: string }

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const toDecimalText = (value: number): string => value.toFixed(2)

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

const ensurePayrollAccess = async (companyId: string) => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(context.companyRole as CompanyRole, "payroll")) {
    return { ok: false as const, error: "You do not have payroll access." }
  }
  return { ok: true as const, context }
}

const isRunAdjustable = (statusCode: PayrollRunStatus): boolean => {
  return statusCode === PayrollRunStatus.COMPUTED || statusCode === PayrollRunStatus.FOR_REVIEW
}

const recalculatePayslipTotals = async (tx: Prisma.TransactionClient, payslipId: string) => {
  const payslip = await tx.payslip.findUnique({
    where: { id: payslipId },
    select: {
      basicPay: true,
      payrollRunId: true,
    },
  })

  if (!payslip) {
    throw new Error("Payslip not found during recalculation.")
  }

  const [earnings, deductions] = await Promise.all([
    tx.payslipEarning.aggregate({
      where: { payslipId },
      _sum: { amount: true },
    }),
    tx.payslipDeduction.aggregate({
      where: { payslipId },
      _sum: { amount: true },
    }),
  ])

  const grossPay = toNumber(earnings._sum.amount)
  const totalDeductions = toNumber(deductions._sum.amount)
  const basicPay = toNumber(payslip.basicPay)
  const totalEarnings = Math.max(grossPay - basicPay, 0)
  const netPay = Math.max(grossPay - totalDeductions, 0)

  await tx.payslip.update({
    where: { id: payslipId },
    data: {
      grossPay: toDecimalText(grossPay),
      totalEarnings: toDecimalText(totalEarnings),
      totalDeductions: toDecimalText(totalDeductions),
      netPay: toDecimalText(netPay),
    },
  })

  return {
    payrollRunId: payslip.payrollRunId,
    grossPay,
    totalDeductions,
    netPay,
  }
}

const recalculatePayrollRunTotals = async (tx: Prisma.TransactionClient, payrollRunId: string) => {
  const [aggregate, run] = await Promise.all([
    tx.payslip.aggregate({
      where: { payrollRunId },
      _sum: {
        grossPay: true,
        totalDeductions: true,
        netPay: true,
      },
      _count: { id: true },
    }),
    tx.payrollRun.findUnique({
      where: { id: payrollRunId },
      select: {
        totalEmployerContributions: true,
      },
    }),
  ])

  if (!run) {
    throw new Error("Payroll run not found during total recalculation.")
  }

  const totalGrossPay = toNumber(aggregate._sum.grossPay)
  const totalDeductions = toNumber(aggregate._sum.totalDeductions)
  const totalNetPay = toNumber(aggregate._sum.netPay)
  const totalEmployerContributions = toNumber(run.totalEmployerContributions)
  const totalEmployerCost = totalGrossPay + totalEmployerContributions

  await tx.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      totalEmployees: aggregate._count.id,
      totalGrossPay: toDecimalText(totalGrossPay),
      totalDeductions: toDecimalText(totalDeductions),
      totalNetPay: toDecimalText(totalNetPay),
      totalEmployerCost: toDecimalText(totalEmployerCost),
    },
  })
}

export async function getPayslipAdjustmentsAction(input: PayslipAdjustmentsListInput): Promise<GetAdjustmentsResult> {
  const parsed = payslipAdjustmentsListInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access

  const payslip = await db.payslip.findFirst({
    where: {
      id: payload.payslipId,
      payrollRun: {
        companyId: access.context.companyId,
      },
    },
    include: {
      earnings: {
        where: {
          earningType: { code: "ADJUSTMENT" },
        },
        orderBy: { createdAt: "desc" },
      },
      deductions: {
        where: {
          OR: [{ referenceType: "ADJUSTMENT" }, { deductionType: { code: "ADJUSTMENT" } }],
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!payslip) {
    return { ok: false, error: "Payslip not found." }
  }

  const adjustments = [
    ...payslip.earnings.map((entry) => ({
      id: entry.id,
      type: "EARNING" as const,
      description: entry.description ?? "Manual Adjustment",
      amount: toNumber(entry.amount),
      isTaxable: entry.isTaxable,
      createdAtRaw: entry.createdAt,
    })),
    ...payslip.deductions.map((entry) => ({
      id: entry.id,
      type: "DEDUCTION" as const,
      description: entry.description ?? "Manual Adjustment",
      amount: toNumber(entry.amount),
      isTaxable: false,
      createdAtRaw: entry.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAtRaw.getTime() - a.createdAtRaw.getTime())
    .map((entry) => ({
      id: entry.id,
      type: entry.type,
      description: entry.description,
      amount: entry.amount,
      isTaxable: entry.isTaxable,
      createdAt: toDateTimeLabel(entry.createdAtRaw),
    }))

  return {
    ok: true,
    data: adjustments,
  }
}

export async function upsertPayslipAdjustmentAction(input: UpsertPayslipAdjustmentInput): Promise<ActionResult> {
  const parsed = upsertPayslipAdjustmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access

  const payslip = await db.payslip.findFirst({
    where: {
      id: payload.payslipId,
      payrollRun: {
        companyId: access.context.companyId,
      },
    },
    select: {
      id: true,
      grossPay: true,
      netPay: true,
      employeeId: true,
      payrollRun: {
        select: {
          id: true,
          runNumber: true,
          statusCode: true,
        },
      },
    },
  })

  if (!payslip) {
    return { ok: false, error: "Payslip not found." }
  }

  if (!isRunAdjustable(payslip.payrollRun.statusCode)) {
    return { ok: false, error: `Adjustments are not allowed for ${payslip.payrollRun.statusCode} runs.` }
  }

  const previousGrossPay = toNumber(payslip.grossPay)
  const previousNetPay = toNumber(payslip.netPay)

  try {
    const result = await db.$transaction(async (tx) => {
      if (payload.type === "EARNING") {
        let adjustmentEarningType = await tx.earningType.findFirst({
          where: {
            code: "ADJUSTMENT",
            OR: [{ companyId: access.context.companyId }, { companyId: null }],
          },
          select: { id: true },
        })

        if (!adjustmentEarningType) {
          adjustmentEarningType = await tx.earningType.create({
            data: {
              companyId: access.context.companyId,
              code: "ADJUSTMENT",
              name: "Manual Adjustment",
              isTaxable: true,
              isIncludedInGross: true,
            },
            select: { id: true },
          })
        }

        await tx.payslipEarning.create({
          data: {
            payslipId: payload.payslipId,
            earningTypeId: adjustmentEarningType.id,
            description: payload.description,
            amount: toDecimalText(payload.amount),
            isTaxable: payload.isTaxable,
          },
        })
      } else {
        let adjustmentDeductionType = await tx.deductionType.findFirst({
          where: {
            code: "ADJUSTMENT",
            OR: [{ companyId: access.context.companyId }, { companyId: null }],
          },
          select: { id: true },
        })

        if (!adjustmentDeductionType) {
          adjustmentDeductionType = await tx.deductionType.create({
            data: {
              companyId: access.context.companyId,
              code: "ADJUSTMENT",
              name: "Manual Adjustment",
              isMandatory: false,
              isPreTax: false,
            },
            select: { id: true },
          })
        }

        await tx.payslipDeduction.create({
          data: {
            payslipId: payload.payslipId,
            deductionTypeId: adjustmentDeductionType.id,
            description: payload.description,
            amount: toDecimalText(payload.amount),
            referenceType: "ADJUSTMENT",
          },
        })
      }

      const totals = await recalculatePayslipTotals(tx, payload.payslipId)
      await recalculatePayrollRunTotals(tx, totals.payrollRunId)

      await createAuditLog(
        {
          tableName: "Payslip",
          recordId: payload.payslipId,
          action: "UPDATE",
          userId: access.context.userId,
          reason: "PAYSLIP_ADJUSTMENT_UPSERT",
          changes: [
            { fieldName: "adjustmentType", newValue: payload.type },
            { fieldName: "description", newValue: payload.description },
            { fieldName: "amount", newValue: payload.amount },
            { fieldName: "grossPay", oldValue: previousGrossPay, newValue: totals.grossPay },
            { fieldName: "netPay", oldValue: previousNetPay, newValue: totals.netPay },
          ],
        },
        tx
      )

      return totals
    })

    revalidatePath(`/${access.context.companyId}/payroll/runs/${payslip.payrollRun.id}`)
    revalidatePath(`/${access.context.companyId}/payroll/adjustments`)

    return {
      ok: true,
      message: `Adjustment added. New net pay is PHP ${result.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to add adjustment: ${message}` }
  }
}

export async function removePayslipAdjustmentAction(input: RemovePayslipAdjustmentInput): Promise<ActionResult> {
  const parsed = removePayslipAdjustmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const payload = parsed.data
  const access = await ensurePayrollAccess(payload.companyId)
  if (!access.ok) return access

  const payslip = await db.payslip.findFirst({
    where: {
      id: payload.payslipId,
      payrollRun: {
        companyId: access.context.companyId,
      },
    },
    select: {
      id: true,
      grossPay: true,
      netPay: true,
      payrollRun: {
        select: {
          id: true,
          statusCode: true,
        },
      },
    },
  })

  if (!payslip) {
    return { ok: false, error: "Payslip not found." }
  }

  if (!isRunAdjustable(payslip.payrollRun.statusCode)) {
    return { ok: false, error: `Adjustments are not allowed for ${payslip.payrollRun.statusCode} runs.` }
  }

  const previousGrossPay = toNumber(payslip.grossPay)
  const previousNetPay = toNumber(payslip.netPay)

  try {
    const result = await db.$transaction(async (tx) => {
      if (payload.type === "EARNING") {
        const existing = await tx.payslipEarning.findFirst({
          where: {
            id: payload.adjustmentId,
            payslipId: payload.payslipId,
            earningType: { code: "ADJUSTMENT" },
          },
          select: { id: true },
        })

        if (!existing) {
          throw new Error("Adjustment line item not found.")
        }

        await tx.payslipEarning.delete({ where: { id: payload.adjustmentId } })
      } else {
        const existing = await tx.payslipDeduction.findFirst({
          where: {
            id: payload.adjustmentId,
            payslipId: payload.payslipId,
            OR: [{ referenceType: "ADJUSTMENT" }, { deductionType: { code: "ADJUSTMENT" } }],
          },
          select: { id: true },
        })

        if (!existing) {
          throw new Error("Adjustment line item not found.")
        }

        await tx.payslipDeduction.delete({ where: { id: payload.adjustmentId } })
      }

      const totals = await recalculatePayslipTotals(tx, payload.payslipId)
      await recalculatePayrollRunTotals(tx, totals.payrollRunId)

      await createAuditLog(
        {
          tableName: "Payslip",
          recordId: payload.payslipId,
          action: "UPDATE",
          userId: access.context.userId,
          reason: "PAYSLIP_ADJUSTMENT_REMOVE",
          changes: [
            { fieldName: "adjustmentType", oldValue: payload.type },
            { fieldName: "adjustmentId", oldValue: payload.adjustmentId },
            { fieldName: "grossPay", oldValue: previousGrossPay, newValue: totals.grossPay },
            { fieldName: "netPay", oldValue: previousNetPay, newValue: totals.netPay },
          ],
        },
        tx
      )

      return totals
    })

    revalidatePath(`/${access.context.companyId}/payroll/runs/${payslip.payrollRun.id}`)
    revalidatePath(`/${access.context.companyId}/payroll/adjustments`)

    return {
      ok: true,
      message: `Adjustment removed. New net pay is PHP ${result.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to remove adjustment: ${message}` }
  }
}
