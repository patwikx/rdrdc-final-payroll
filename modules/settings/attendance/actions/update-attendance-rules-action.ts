"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  attendanceRulesInputSchema,
  type AttendanceRulesInput,
} from "@/modules/settings/attendance/schemas/attendance-rules-schema"

type UpdateAttendanceRulesActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const parsePhDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

const parseTime = (value: string | undefined): Date | null => {
  if (!value) {
    return null
  }

  const [hourString, minuteString] = value.split(":")
  const hour = Number(hourString)
  const minute = Number(minuteString)
  const result = new Date("1970-01-01T00:00:00.000Z")
  result.setUTCHours(hour, minute, 0, 0)
  return result
}

const getFirstWorkingDay = (rows: AttendanceRulesInput["daySchedules"]) => {
  return rows.find((row) => row.isWorkingDay)
}

export async function updateAttendanceRulesAction(
  input: AttendanceRulesInput
): Promise<UpdateAttendanceRulesActionResult> {
  const parsed = attendanceRulesInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid attendance rules at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid attendance rules payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to work schedules." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    await db.$transaction(async (tx) => {
      const firstWorkingDay = getFirstWorkingDay(payload.daySchedules)

      if (!firstWorkingDay?.timeIn || !firstWorkingDay.timeOut) {
        throw new Error("At least one working day with complete time in/out is required.")
      }

      const restDays = payload.daySchedules
        .filter((row) => !row.isWorkingDay)
        .map((row) => row.dayOfWeek)

      const dayOverrides = payload.daySchedules.reduce<Record<string, { isWorkingDay: boolean; timeIn?: string; timeOut?: string }>>(
        (accumulator, row) => {
          accumulator[row.dayOfWeek] = {
            isWorkingDay: row.isWorkingDay,
            timeIn: row.timeIn,
            timeOut: row.timeOut,
          }
          return accumulator
        },
        {}
      )

      const savePayload = {
        companyId: context.companyId,
        code: payload.code,
        name: payload.name,
        description: toNullable(payload.description),
        scheduleTypeCode: payload.scheduleTypeCode,
        workStartTime: parseTime(firstWorkingDay.timeIn)!,
        workEndTime: parseTime(firstWorkingDay.timeOut)!,
        breakStartTime: parseTime(payload.breakStartTime),
        breakEndTime: parseTime(payload.breakEndTime),
        breakDurationMins: payload.breakDurationMins,
        gracePeriodMins: payload.gracePeriodMins,
        requiredHoursPerDay: payload.requiredHoursPerDay.toString(),
        restDays,
        dayOverrides,
        effectiveFrom: parsePhDate(payload.effectiveFrom),
        effectiveTo: payload.effectiveTo ? parsePhDate(payload.effectiveTo) : null,
        isActive: payload.isActive,
      }

      let record: { id: string }

      if (payload.workScheduleId) {
        const existing = await tx.workSchedule.findFirst({
          where: { id: payload.workScheduleId, companyId: context.companyId },
          select: { id: true },
        })

        if (!existing) {
          throw new Error("Selected work schedule was not found for this company.")
        }

        record = await tx.workSchedule.update({
          where: { id: payload.workScheduleId },
          data: savePayload,
          select: { id: true },
        })
      } else {
        record = await tx.workSchedule.create({
          data: savePayload,
          select: { id: true },
        })
      }

      await createAuditLog(
        {
          tableName: "WorkSchedule",
          recordId: record.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "ATTENDANCE_RULES_UPDATED",
          changes: [
            { fieldName: "code", newValue: payload.code },
            { fieldName: "name", newValue: payload.name },
            { fieldName: "scheduleTypeCode", newValue: payload.scheduleTypeCode },
            { fieldName: "gracePeriodMins", newValue: payload.gracePeriodMins },
            { fieldName: "requiredHoursPerDay", newValue: payload.requiredHoursPerDay },
            { fieldName: "isActive", newValue: payload.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/attendance`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: payload.workScheduleId ? "Work schedule updated successfully." : "Work schedule created successfully." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Schedule code already exists for this company." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save work schedule: ${message}` }
  }
}
