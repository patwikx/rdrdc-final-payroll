"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  statutoryTablesInputSchema,
  type StatutoryTablesInput,
} from "@/modules/settings/statutory/schemas/statutory-tables-schema"

type UpsertStatutoryTablesActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parsePhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const decimalText = (value: number): string => value.toString()

const getVersionCode = (): string => {
  const now = new Date()
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ]

  return `MANUAL_${parts.join("")}`
}

export async function upsertStatutoryTablesAction(
  input: StatutoryTablesInput
): Promise<UpsertStatutoryTablesActionResult> {
  const parsed = statutoryTablesInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid statutory tables at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid statutory tables payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to statutory tables." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      const version = getVersionCode()
      const effectiveFrom = parsePhDate(payload.effectiveFrom)
      const effectiveYear = Number(
        new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          timeZone: "Asia/Manila",
        }).format(effectiveFrom)
      )

      await Promise.all([
        tx.sSSContributionTable.updateMany({ where: { isActive: true }, data: { isActive: false, effectiveTo: effectiveFrom } }),
        tx.philHealthContributionTable.updateMany({ where: { isActive: true }, data: { isActive: false, effectiveTo: effectiveFrom } }),
        tx.pagIBIGContributionTable.updateMany({ where: { isActive: true }, data: { isActive: false, effectiveTo: effectiveFrom } }),
        tx.taxTable.updateMany({
          where: { isActive: true, taxTableTypeCode: "SEMI_MONTHLY" },
          data: { isActive: false, effectiveTo: effectiveFrom },
        }),
      ])

      await tx.sSSContributionTable.createMany({
        data: payload.sssRows.map((row) => ({
          version,
          salaryBracketMin: decimalText(row.salaryBracketMin),
          salaryBracketMax: decimalText(row.salaryBracketMax),
          monthlySalaryCredit: decimalText(row.monthlySalaryCredit),
          employeeShare: decimalText(row.employeeShare),
          employerShare: decimalText(row.employerShare),
          ecContribution: decimalText(row.ecContribution),
          totalContribution: decimalText(row.totalContribution),
          wispEmployee: row.wispEmployee !== undefined ? decimalText(row.wispEmployee) : null,
          wispEmployer: row.wispEmployer !== undefined ? decimalText(row.wispEmployer) : null,
          effectiveFrom,
          isActive: true,
        })),
      })

      await tx.philHealthContributionTable.createMany({
        data: payload.philHealthRows.map((row) => ({
          version,
          premiumRate: decimalText(row.premiumRate),
          monthlyFloor: decimalText(row.monthlyFloor),
          monthlyCeiling: decimalText(row.monthlyCeiling),
          employeeSharePercent: decimalText(row.employeeSharePercent),
          employerSharePercent: decimalText(row.employerSharePercent),
          membershipCategory: row.membershipCategory ?? null,
          effectiveFrom,
          isActive: true,
        })),
      })

      await tx.pagIBIGContributionTable.createMany({
        data: payload.pagIbigRows.map((row) => ({
          version,
          salaryBracketMin: decimalText(row.salaryBracketMin),
          salaryBracketMax: decimalText(row.salaryBracketMax),
          employeeRatePercent: decimalText(row.employeeRatePercent),
          employerRatePercent: decimalText(row.employerRatePercent),
          maxMonthlyCompensation: decimalText(row.maxMonthlyCompensation),
          effectiveFrom,
          isActive: true,
        })),
      })

      await tx.taxTable.createMany({
        data: payload.taxRows.map((row) => ({
          version,
          taxTableTypeCode: "SEMI_MONTHLY",
          bracketOver: decimalText(row.bracketOver),
          bracketNotOver: decimalText(row.bracketNotOver),
          baseTax: decimalText(row.baseTax),
          taxRatePercent: decimalText(row.taxRatePercent),
          excessOver: decimalText(row.excessOver),
          effectiveYear,
          effectiveFrom,
          isActive: true,
        })),
      })

      await createAuditLog(
        {
          tableName: "TaxTable",
          recordId: `SEMI_MONTHLY:${version}`,
          action: "UPDATE",
          userId: context.userId,
          reason: "STATUTORY_TABLES_UPDATED",
          changes: [
            { fieldName: "version", newValue: version },
            { fieldName: "effectiveFrom", newValue: payload.effectiveFrom },
            { fieldName: "effectiveYear", newValue: effectiveYear },
            { fieldName: "sssRows", newValue: payload.sssRows.length },
            { fieldName: "philHealthRows", newValue: payload.philHealthRows.length },
            { fieldName: "pagIbigRows", newValue: payload.pagIbigRows.length },
            { fieldName: "taxRows", newValue: payload.taxRows.length },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/statutory`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Statutory tables saved successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save statutory tables: ${message}` }
  }
}
