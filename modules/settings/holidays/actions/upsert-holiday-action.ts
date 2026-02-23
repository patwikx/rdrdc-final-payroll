"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { parsePhDateInputToUtcDateOnly, toPhDateOnlyUtc } from "@/lib/ph-time"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  holidaySettingsInputSchema,
  type HolidaySettingsInput,
} from "@/modules/settings/holidays/schemas/holiday-settings-schema"

type UpsertHolidayActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

export async function upsertHolidayAction(input: HolidaySettingsInput): Promise<UpsertHolidayActionResult> {
  const parsed = holidaySettingsInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid holiday data at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid holiday payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to holiday settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  const holidayDate = parsePhDateInputToUtcDateOnly(payload.holidayDate)
  if (!holidayDate) {
    return { ok: false, error: "Invalid holiday date." }
  }
  const todayPhDateOnly = toPhDateOnlyUtc()

  try {
    await db.$transaction(async (tx) => {
      const savePayload = {
        companyId: context.companyId,
        holidayDate,
        name: payload.name,
        description: toNullable(payload.description),
        holidayTypeCode: payload.holidayTypeCode,
        payMultiplier: payload.payMultiplier,
        applicability: payload.applicability,
        region: payload.applicability === "REGIONAL" ? toNullable(payload.region) : null,
        isActive: payload.isActive,
      }

      if (payload.holidayId) {
        const existing = await tx.holiday.findUnique({
          where: { id: payload.holidayId },
          select: { id: true, companyId: true, holidayDate: true },
        })

        if (!existing || existing.companyId !== context.companyId) {
          throw new Error("Only company-owned holidays can be edited.")
        }
        if (existing.holidayDate.getTime() < todayPhDateOnly.getTime()) {
          throw new Error("Past holidays can no longer be edited.")
        }
        if (holidayDate.getTime() < todayPhDateOnly.getTime()) {
          throw new Error("Holiday date cannot be set to a past date.")
        }

        const updated = await tx.holiday.update({
          where: { id: existing.id },
          data: savePayload,
          select: {
            id: true,
          },
        })

        await createAuditLog(
          {
            tableName: "Holiday",
            recordId: updated.id,
            action: "UPDATE",
            userId: context.userId,
            reason: "HOLIDAY_UPDATED",
            changes: [
              { fieldName: "holidayDate", newValue: payload.holidayDate },
              { fieldName: "name", newValue: payload.name },
              { fieldName: "holidayTypeCode", newValue: payload.holidayTypeCode },
              { fieldName: "payMultiplier", newValue: payload.payMultiplier },
              { fieldName: "applicability", newValue: payload.applicability },
              { fieldName: "region", newValue: payload.region ?? null },
              { fieldName: "isActive", newValue: payload.isActive },
            ],
          },
          tx
        )

        return
      }

      const created = await tx.holiday.create({
        data: savePayload,
        select: {
          id: true,
        },
      })

      await createAuditLog(
        {
          tableName: "Holiday",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "HOLIDAY_CREATED",
          changes: [
            { fieldName: "holidayDate", newValue: payload.holidayDate },
            { fieldName: "name", newValue: payload.name },
            { fieldName: "holidayTypeCode", newValue: payload.holidayTypeCode },
            { fieldName: "payMultiplier", newValue: payload.payMultiplier },
            { fieldName: "applicability", newValue: payload.applicability },
            { fieldName: "region", newValue: payload.region ?? null },
            { fieldName: "isActive", newValue: payload.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/holidays`)
    revalidatePath(`/${context.companyId}/employee-portal`)

    return {
      ok: true,
      message: payload.holidayId ? "Holiday updated successfully." : "Holiday created successfully.",
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: "A holiday with the same date, applicability, and region already exists.",
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save holiday: ${message}` }
  }
}
