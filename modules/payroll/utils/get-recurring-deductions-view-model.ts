import { RecurringDeductionStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "code" })

const toDateLabel = (value: Date | null): string => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

const toDateInputValue = (value: Date | null): string => {
  if (!value) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(value)
}

export type RecurringDeductionsViewModel = {
  companyId: string
  companyName: string
  employees: Array<{ id: string; label: string }>
  deductionTypes: Array<{ id: string; code: string; name: string }>
  records: Array<{
    id: string
    employeeId: string
    employeeName: string
    employeeNumber: string
    deductionTypeId: string
    deductionTypeName: string
    statusCode: RecurringDeductionStatus
    amount: number
    amountLabel: string
    frequency: string
    effectiveFromValue: string
    effectiveToValue: string
    effectiveFrom: string
    effectiveTo: string
    percentageRate: number | null
    isPercentage: boolean
    remarks: string | null
    description: string | null
  }>
}

export async function getRecurringDeductionsViewModel(companyId: string): Promise<RecurringDeductionsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const blockedDeductionCodes = [
    "SSS",
    "PHILHEALTH",
    "PAGIBIG",
    "WTAX",
    "TARDINESS",
    "UNDERTIME",
    "LOAN_PAYMENT",
    "ADJUSTMENT",
  ]

  const [employees, deductionTypes, recurringDeductions] = await Promise.all([
    db.employee.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.deductionType.findMany({
      where: {
        isActive: true,
        isMandatory: false,
        code: { notIn: blockedDeductionCodes },
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: "asc" }],
    }),
    db.recurringDeduction.findMany({
      where: {
        employee: { companyId: context.companyId },
      },
      include: {
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        deductionType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ])

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    employees: employees.map((employee) => ({
      id: employee.id,
      label: `${employee.lastName}, ${employee.firstName} (${employee.employeeNumber})`,
    })),
    deductionTypes: deductionTypes.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
    })),
    records: recurringDeductions.map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeName: `${record.employee.lastName}, ${record.employee.firstName}`,
      employeeNumber: record.employee.employeeNumber,
      deductionTypeId: record.deductionTypeId,
      deductionTypeName: record.deductionType.name,
      statusCode: record.statusCode,
      amount: toNumber(record.amount),
      amountLabel: money.format(toNumber(record.amount)),
      frequency: record.frequency,
      effectiveFromValue: toDateInputValue(record.effectiveFrom),
      effectiveToValue: toDateInputValue(record.effectiveTo),
      effectiveFrom: toDateLabel(record.effectiveFrom),
      effectiveTo: toDateLabel(record.effectiveTo),
      percentageRate: record.percentageRate ? toNumber(record.percentageRate) : null,
      isPercentage: record.isPercentage,
      remarks: record.remarks,
      description: record.description,
    })),
  }
}
