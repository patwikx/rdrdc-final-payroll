import { type EarningFrequency } from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { isDisallowedRecurringEarningType } from "@/modules/payroll/utils/recurring-earning-eligibility"

type RecurringEarningStatus = "ACTIVE" | "INACTIVE"

type GetRecurringEarningsViewModelInput = {
  page?: number
  query?: string
  status?: RecurringEarningStatus | "ALL"
}

const PAGE_SIZE = 10

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

const normalizeFrequencyCode = (
  value: EarningFrequency | null
): "PER_PAYROLL" | "MONTHLY" => {
  if (value === "MONTHLY") return "MONTHLY"
  return "PER_PAYROLL"
}

const toTaxTreatment = (
  isTaxableOverride: boolean | null
): "DEFAULT" | "TAXABLE" | "NON_TAXABLE" => {
  if (isTaxableOverride === true) return "TAXABLE"
  if (isTaxableOverride === false) return "NON_TAXABLE"
  return "DEFAULT"
}

export type RecurringEarningsViewModel = {
  companyId: string
  companyName: string
  filters: {
    query: string
    status: RecurringEarningStatus | "ALL"
  }
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalItems: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  employees: Array<{ id: string; label: string }>
  earningTypes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isTaxable: boolean
    isIncludedIn13thMonth: boolean
    frequencyCode: "PER_PAYROLL" | "MONTHLY"
    isCompanyOwned: boolean
  }>
  records: Array<{
    id: string
    employeeId: string
    employeeName: string
    employeeNumber: string
    employeePhotoUrl: string | null
    earningTypeId: string
    earningTypeName: string
    statusCode: RecurringEarningStatus
    amount: number
    amountLabel: string
    frequency: "PER_PAYROLL" | "MONTHLY"
    effectiveFromValue: string
    effectiveToValue: string
    effectiveFrom: string
    effectiveTo: string
    taxTreatment: "DEFAULT" | "TAXABLE" | "NON_TAXABLE"
    remarks: string | null
  }>
}

export async function getRecurringEarningsViewModel(
  companyId: string,
  input?: GetRecurringEarningsViewModelInput
): Promise<RecurringEarningsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const query = input?.query?.trim() ?? ""
  const status = input?.status && input.status !== "ALL" ? input.status : "ALL"
  const page = Number.isFinite(input?.page) ? Math.max(1, Number(input?.page)) : 1

  const listWhere = {
    employee: { companyId: context.companyId },
    ...(status !== "ALL" ? { isActive: status === "ACTIVE" } : {}),
    ...(query
      ? {
          OR: [
            { employee: { firstName: { contains: query, mode: "insensitive" as const } } },
            { employee: { lastName: { contains: query, mode: "insensitive" as const } } },
            { employee: { employeeNumber: { contains: query, mode: "insensitive" as const } } },
            { earningType: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }

  const [employees, allEarningTypes, totalItems, recurringEarnings] = await Promise.all([
    db.employee.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.earningType.findMany({
      where: {
        isActive: true,
        isIncludedInGross: true,
        OR: [{ companyId: context.companyId }, { companyId: null }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isTaxable: true,
        isIncludedIn13thMonth: true,
        frequencyCode: true,
        companyId: true,
      },
      orderBy: [{ code: "asc" }],
    }),
    db.employeeEarning.count({ where: listWhere }),
    db.employeeEarning.findMany({
      where: listWhere,
      include: {
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
        earningType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const earningTypes = allEarningTypes.filter((type) => !isDisallowedRecurringEarningType(type.code, type.name))
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pagedRecords =
    safePage === page
      ? recurringEarnings
      : await db.employeeEarning.findMany({
          where: listWhere,
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
            earningType: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          skip: (safePage - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    filters: {
      query,
      status,
    },
    pagination: {
      page: safePage,
      pageSize: PAGE_SIZE,
      totalPages,
      totalItems,
      hasPrevPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
    employees: employees.map((employee) => ({
      id: employee.id,
      label: `${employee.lastName}, ${employee.firstName} (${employee.employeeNumber})`,
    })),
    earningTypes: earningTypes.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      description: type.description,
      isTaxable: type.isTaxable,
      isIncludedIn13thMonth: type.isIncludedIn13thMonth,
      frequencyCode: normalizeFrequencyCode(type.frequencyCode),
      isCompanyOwned: type.companyId === context.companyId,
    })),
    records: pagedRecords.map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeName: `${record.employee.lastName}, ${record.employee.firstName}`,
      employeeNumber: record.employee.employeeNumber,
      employeePhotoUrl: record.employee.photoUrl,
      earningTypeId: record.earningTypeId,
      earningTypeName: record.earningType.name,
      statusCode: record.isActive ? "ACTIVE" : "INACTIVE",
      amount: toNumber(record.amount),
      amountLabel: money.format(toNumber(record.amount)),
      frequency: normalizeFrequencyCode(record.frequency),
      effectiveFromValue: toDateInputValue(record.effectiveFrom),
      effectiveToValue: toDateInputValue(record.effectiveTo),
      effectiveFrom: toDateLabel(record.effectiveFrom),
      effectiveTo: toDateLabel(record.effectiveTo),
      taxTreatment: toTaxTreatment(record.isTaxableOverride),
      remarks: record.remarks,
    })),
  }
}
