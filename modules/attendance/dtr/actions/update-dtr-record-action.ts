"use server"

import { revalidatePath } from "next/cache"

import { DtrSource, type Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  updateDtrRecordInputSchema,
  type UpdateDtrRecordInput,
} from "@/modules/attendance/dtr/schemas/dtr-actions-schema"
import {
  createWallClockDateTime,
  extractDtrLeaveTypeIdFromRemarks,
  ensureEndAfterStart,
  formatWallClockTime,
  isHalfDayRemarks,
  normalizeDtrLeaveTypeToken,
  normalizeHalfDayToken,
  parsePhDateInput,
} from "@/modules/attendance/dtr/utils/wall-clock"
import { DTR_MANUAL_LEAVE_REFERENCE_TYPE } from "@/modules/attendance/dtr/utils/manual-dtr-leave"

type UpdateDtrRecordActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

type DayOverride = {
  isWorkingDay?: boolean
  timeIn?: string
  timeOut?: string
}

type ExistingRecordSnapshot = {
  id: string
  attendanceDate: Date
  actualTimeIn: Date | null
  actualTimeOut: Date | null
  attendanceStatus: string
  remarks: string | null
  hoursWorked: Prisma.Decimal | null
  tardinessMins: number
  undertimeMins: number
  overtimeHours: Prisma.Decimal | null
  nightDiffHours: Prisma.Decimal | null
  approvalStatusCode: string
}

type UpdatedRecordSnapshot = {
  id: string
  actualTimeIn: Date | null
  actualTimeOut: Date | null
  attendanceStatus: string
  remarks: string | null
  hoursWorked: Prisma.Decimal | null
  tardinessMins: number
  undertimeMins: number
  overtimeHours: Prisma.Decimal | null
  nightDiffHours: Prisma.Decimal | null
  approvalStatusCode: string
}

type ManualDtrLeaveState = {
  leaveBalanceId: string
  leaveTypeId: string
  employeeId: string
  year: number
  numberOfDays: number
}

type AppliedManualDtrLeaveState = {
  leaveTypeId: string
  numberOfDays: number
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const

const toDateTimeOnAttendanceDate = (attendanceDate: Date, value: string | undefined): Date | null => {
  if (!value) return null
  return createWallClockDateTime(attendanceDate, value)
}

const parseTimeOnAttendanceDate = (attendanceDate: Date, value: Date): Date => {
  const parsed = createWallClockDateTime(attendanceDate, formatWallClockTime(value))
  if (!parsed) {
    throw new Error("Invalid work schedule time.")
  }
  return parsed
}

const parseTimeStringOnAttendanceDate = (attendanceDate: Date, value: string): Date => {
  const parsed = createWallClockDateTime(attendanceDate, value)
  if (!parsed) {
    throw new Error("Invalid work schedule override time.")
  }
  return parsed
}

const toNumber = (value: { toString(): string } | null | undefined): number => {
  if (!value) return 0
  return Number(value.toString())
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100
const toDecimalText = (value: number): string => roundTo2(value).toFixed(2)
const toLeaveDays = (dayFraction: "FULL" | "HALF"): number => (dayFraction === "HALF" ? 0.5 : 1)

const calculateNightDiffHours = (timeIn: Date, timeOut: Date): number => {
  if (timeOut <= timeIn) return 0

  let totalMs = 0
  const startDay = new Date(timeIn)
  startDay.setUTCHours(0, 0, 0, 0)

  const endDay = new Date(timeOut)
  endDay.setUTCHours(0, 0, 0, 0)

  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const ndStart = new Date(cursor)
    ndStart.setUTCHours(22, 0, 0, 0)

    const ndEnd = new Date(cursor)
    ndEnd.setUTCDate(ndEnd.getUTCDate() + 1)
    ndEnd.setUTCHours(6, 0, 0, 0)

    const overlapStart = Math.max(timeIn.getTime(), ndStart.getTime())
    const overlapEnd = Math.min(timeOut.getTime(), ndEnd.getTime())

    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return totalMs / (1000 * 60 * 60)
}

const getScheduleTimes = (
  attendanceDate: Date,
  workSchedule: {
    workStartTime: Date
    workEndTime: Date
    dayOverrides: unknown
  } | null
): { scheduledIn: Date | null; scheduledOut: Date | null } => {
  if (!workSchedule) {
    return { scheduledIn: null, scheduledOut: null }
  }

  const dayOfWeek = new Date(attendanceDate).getUTCDay()
  const dayName = DAY_NAMES[dayOfWeek]
  const overrides =
    workSchedule.dayOverrides && typeof workSchedule.dayOverrides === "object" && !Array.isArray(workSchedule.dayOverrides)
      ? (workSchedule.dayOverrides as Record<string, DayOverride>)
      : null
  const dayOverride = overrides?.[dayName]

  if (dayOverride?.isWorkingDay === false) {
    return { scheduledIn: null, scheduledOut: null }
  }

  if (dayOverride?.timeIn && dayOverride?.timeOut) {
    const scheduledIn = parseTimeStringOnAttendanceDate(attendanceDate, dayOverride.timeIn)
    const scheduledOut = parseTimeStringOnAttendanceDate(attendanceDate, dayOverride.timeOut)
    return {
      scheduledIn,
      scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut),
    }
  }

  const scheduledIn = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workStartTime)
  const scheduledOut = parseTimeOnAttendanceDate(attendanceDate, workSchedule.workEndTime)
  return { scheduledIn, scheduledOut: ensureEndAfterStart(scheduledIn, scheduledOut) }
}

const resolveActiveManualDtrLeaveState = async (
  tx: Prisma.TransactionClient,
  dtrId: string
): Promise<ManualDtrLeaveState | null> => {
  const latestTransaction = await tx.leaveBalanceTransaction.findFirst({
    where: {
      referenceType: DTR_MANUAL_LEAVE_REFERENCE_TYPE,
      referenceId: dtrId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      leaveBalanceId: true,
      transactionType: true,
      amount: true,
      leaveBalance: {
        select: {
          employeeId: true,
          leaveTypeId: true,
          year: true,
        },
      },
    },
  })

  if (!latestTransaction || latestTransaction.transactionType !== "USAGE") {
    return null
  }

  const numberOfDays = roundTo2(Math.abs(toNumber(latestTransaction.amount)))
  if (numberOfDays <= 0) {
    return null
  }

  return {
    leaveBalanceId: latestTransaction.leaveBalanceId,
    leaveTypeId: latestTransaction.leaveBalance.leaveTypeId,
    employeeId: latestTransaction.leaveBalance.employeeId,
    year: latestTransaction.leaveBalance.year,
    numberOfDays,
  }
}

const applyManualDtrLeaveUsage = async (params: {
  tx: Prisma.TransactionClient
  employeeId: string
  leaveTypeId: string
  year: number
  numberOfDays: number
  dtrId: string
  processedById: string
}): Promise<AppliedManualDtrLeaveState> => {
  const leaveBalance = await params.tx.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year: params.year,
      },
    },
    select: {
      id: true,
      currentBalance: true,
      pendingRequests: true,
      creditsUsed: true,
    },
  })

  if (!leaveBalance) {
    throw new Error(`No leave balance found for ${params.year}. Please initialize yearly leave balances first.`)
  }

  const numberOfDays = roundTo2(params.numberOfDays)
  const currentBalance = toNumber(leaveBalance.currentBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const creditsUsed = toNumber(leaveBalance.creditsUsed)

  if (currentBalance < numberOfDays) {
    throw new Error("Insufficient leave balance for the selected leave type.")
  }

  const nextCurrentBalance = roundTo2(currentBalance - numberOfDays)
  const nextCreditsUsed = roundTo2(creditsUsed + numberOfDays)
  const nextAvailableBalance = roundTo2(nextCurrentBalance - pendingRequests)

  if (nextAvailableBalance < 0) {
    throw new Error("Leave balance is insufficient after pending requests are considered.")
  }

  await params.tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      currentBalance: toDecimalText(nextCurrentBalance),
      creditsUsed: toDecimalText(nextCreditsUsed),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await params.tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "USAGE",
      amount: toDecimalText(numberOfDays),
      runningBalance: toDecimalText(nextCurrentBalance),
      referenceType: DTR_MANUAL_LEAVE_REFERENCE_TYPE,
      referenceId: params.dtrId,
      remarks: `Applied ${toDecimalText(numberOfDays)} day(s) for manual DTR ON_LEAVE adjustment.`,
      processedById: params.processedById,
    },
  })

  return {
    leaveTypeId: params.leaveTypeId,
    numberOfDays,
  }
}

const reverseManualDtrLeaveUsage = async (params: {
  tx: Prisma.TransactionClient
  state: ManualDtrLeaveState
  dtrId: string
  processedById: string
}): Promise<void> => {
  const leaveBalance = await params.tx.leaveBalance.findUnique({
    where: { id: params.state.leaveBalanceId },
    select: {
      id: true,
      currentBalance: true,
      pendingRequests: true,
      creditsUsed: true,
    },
  })

  if (!leaveBalance) {
    throw new Error("Unable to reverse prior DTR leave deduction because the leave balance row no longer exists.")
  }

  const numberOfDays = roundTo2(params.state.numberOfDays)
  const currentBalance = toNumber(leaveBalance.currentBalance)
  const pendingRequests = toNumber(leaveBalance.pendingRequests)
  const creditsUsed = toNumber(leaveBalance.creditsUsed)

  if (creditsUsed < numberOfDays) {
    throw new Error("Unable to reverse prior DTR leave deduction because used credits are lower than expected.")
  }

  const nextCurrentBalance = roundTo2(currentBalance + numberOfDays)
  const nextCreditsUsed = roundTo2(Math.max(0, creditsUsed - numberOfDays))
  const nextAvailableBalance = roundTo2(nextCurrentBalance - pendingRequests)

  await params.tx.leaveBalance.update({
    where: { id: leaveBalance.id },
    data: {
      currentBalance: toDecimalText(nextCurrentBalance),
      creditsUsed: toDecimalText(nextCreditsUsed),
      availableBalance: toDecimalText(nextAvailableBalance),
    },
  })

  await params.tx.leaveBalanceTransaction.create({
    data: {
      leaveBalanceId: leaveBalance.id,
      transactionType: "ADJUSTMENT",
      amount: toDecimalText(numberOfDays),
      runningBalance: toDecimalText(nextCurrentBalance),
      referenceType: DTR_MANUAL_LEAVE_REFERENCE_TYPE,
      referenceId: params.dtrId,
      remarks: `Reversed ${toDecimalText(numberOfDays)} day(s) from manual DTR ON_LEAVE adjustment.`,
      processedById: params.processedById,
    },
  })
}

export async function updateDtrRecordAction(input: UpdateDtrRecordInput): Promise<UpdateDtrRecordActionResult> {
  const parsed = updateDtrRecordInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid DTR update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  if (!hasAttendanceSensitiveAccess(companyRole) && !isSuperAdmin) {
    return { ok: false, error: "You do not have permission to update DTR records." }
  }

  const canManuallyApproveDtr = companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || isSuperAdmin
  if (!canManuallyApproveDtr) {
    return { ok: false, error: "Only Company Admin, HR Admin, or Super Admin can manually modify DTR records." }
  }

  const attendanceDate = parsePhDateInput(payload.attendanceDate)
  if (!attendanceDate) {
    return { ok: false, error: "Invalid attendance date." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: payload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
    },
    include: {
      workSchedule: {
        select: {
          workStartTime: true,
          workEndTime: true,
          dayOverrides: true,
          breakDurationMins: true,
          gracePeriodMins: true,
        },
      },
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee not found for this company." }
  }

  let record: ExistingRecordSnapshot | null = null

  if (payload.dtrId) {
    record = await db.dailyTimeRecord.findFirst({
      where: {
        id: payload.dtrId,
        employee: { companyId: context.companyId },
      },
      select: {
        id: true,
        attendanceDate: true,
        actualTimeIn: true,
        actualTimeOut: true,
        attendanceStatus: true,
        remarks: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        approvalStatusCode: true,
      },
    })
  }

  if (!record) {
    record = await db.dailyTimeRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: payload.employeeId,
          attendanceDate,
        },
      },
      select: {
        id: true,
        attendanceDate: true,
        actualTimeIn: true,
        actualTimeOut: true,
        attendanceStatus: true,
        remarks: true,
        hoursWorked: true,
        tardinessMins: true,
        undertimeMins: true,
        overtimeHours: true,
        nightDiffHours: true,
        approvalStatusCode: true,
      },
    })
  }

  const effectiveAttendanceDate = record?.attendanceDate ?? attendanceDate
  const effectiveAttendanceYear = effectiveAttendanceDate.getUTCFullYear()

  const actualTimeIn = toDateTimeOnAttendanceDate(effectiveAttendanceDate, payload.actualTimeIn || undefined)
  const rawActualTimeOut = toDateTimeOnAttendanceDate(effectiveAttendanceDate, payload.actualTimeOut || undefined)

  if ((actualTimeIn && !rawActualTimeOut) || (!actualTimeIn && rawActualTimeOut)) {
    return { ok: false, error: "Both time in and time out are required when providing attendance time." }
  }

  const actualTimeOut = actualTimeIn && rawActualTimeOut ? ensureEndAfterStart(actualTimeIn, rawActualTimeOut) : rawActualTimeOut

  if (payload.attendanceStatus === "PRESENT" && (!actualTimeIn || !actualTimeOut)) {
    return { ok: false, error: "Present status requires both time in and time out." }
  }

  let hoursWorked = 0
  let overtimeHours = 0
  let nightDiffHours = 0
  let tardinessMins = 0
  let undertimeMins = 0

  if (actualTimeIn && actualTimeOut) {
    const breakMins = employee.workSchedule?.breakDurationMins ?? 60
    const totalMs = actualTimeOut.getTime() - actualTimeIn.getTime()
    hoursWorked = Math.max(0, (totalMs - breakMins * 60 * 1000) / (1000 * 60 * 60))
    nightDiffHours = calculateNightDiffHours(actualTimeIn, actualTimeOut)

    const scheduleTimes = getScheduleTimes(effectiveAttendanceDate, employee.workSchedule)

    if (scheduleTimes.scheduledIn && scheduleTimes.scheduledOut) {
      const gracePeriod = employee.workSchedule?.gracePeriodMins ?? 0
      const lateBy = (actualTimeIn.getTime() - scheduleTimes.scheduledIn.getTime()) / (1000 * 60)
      if (lateBy > gracePeriod) {
        tardinessMins = Math.round(lateBy - gracePeriod)
      }

      const earlyBy = (scheduleTimes.scheduledOut.getTime() - actualTimeOut.getTime()) / (1000 * 60)
      if (earlyBy > 0) {
        undertimeMins = Math.round(earlyBy)
      }

      const overtimeMins = (actualTimeOut.getTime() - scheduleTimes.scheduledOut.getTime()) / (1000 * 60)
      if (overtimeMins > 0) {
        overtimeHours = overtimeMins / 60
      }
    }
  }

  const resolvedDayFraction: "FULL" | "HALF" =
    payload.dayFraction ??
    (isHalfDayRemarks(payload.remarks) || isHalfDayRemarks(record?.remarks) ? "HALF" : "FULL")
  const baseRemarks = normalizeHalfDayToken(payload.remarks?.trim() || null, resolvedDayFraction)
  const recordLeaveTypeId = extractDtrLeaveTypeIdFromRemarks(record?.remarks)
  const requestedLeaveTypeId = payload.attendanceStatus === "ON_LEAVE" ? payload.leaveTypeId ?? null : null

  const expectedLeaveDays = toLeaveDays(resolvedDayFraction)
  let updated: UpdatedRecordSnapshot
  let previousManualLeaveState: ManualDtrLeaveState | null = null
  let finalManualLeaveState: AppliedManualDtrLeaveState | null = null

  try {
    const transactionResult = await db.$transaction(async (tx) => {
      const existingManualLeaveState = record ? await resolveActiveManualDtrLeaveState(tx, record.id) : null
      const desiredLeaveTypeId =
        payload.attendanceStatus === "ON_LEAVE"
          ? requestedLeaveTypeId ?? recordLeaveTypeId ?? existingManualLeaveState?.leaveTypeId ?? null
          : null

      if (payload.attendanceStatus === "ON_LEAVE" && !desiredLeaveTypeId) {
        throw new Error("Leave type is required when attendance status is ON_LEAVE.")
      }

      const selectedLeaveType = desiredLeaveTypeId
        ? await tx.leaveType.findFirst({
            where: {
              id: desiredLeaveTypeId,
              isActive: true,
              OR: [{ companyId: context.companyId }, { companyId: null }],
            },
            select: {
              id: true,
              isPaid: true,
            },
          })
        : null

      if (desiredLeaveTypeId && !selectedLeaveType) {
        throw new Error("Leave type is not available for this company.")
      }

      const remarks = normalizeDtrLeaveTypeToken(baseRemarks, desiredLeaveTypeId)

      const updatedRecord = record
        ? await tx.dailyTimeRecord.update({
            where: { id: record.id },
            data: {
              actualTimeIn,
              actualTimeOut,
              attendanceStatus: payload.attendanceStatus,
              remarks,
              hoursWorked,
              tardinessMins,
              undertimeMins,
              overtimeHours,
              nightDiffHours,
              approvalStatusCode: "APPROVED",
              approvedById: context.userId,
              approvedAt: new Date(),
              timeInSourceCode: actualTimeIn ? DtrSource.MANUAL : null,
              timeOutSourceCode: actualTimeOut ? DtrSource.MANUAL : null,
            },
            select: {
              id: true,
              actualTimeIn: true,
              actualTimeOut: true,
              attendanceStatus: true,
              remarks: true,
              hoursWorked: true,
              tardinessMins: true,
              undertimeMins: true,
              overtimeHours: true,
              nightDiffHours: true,
              approvalStatusCode: true,
            },
          })
        : await tx.dailyTimeRecord.create({
            data: {
              employeeId: payload.employeeId,
              attendanceDate: effectiveAttendanceDate,
              actualTimeIn,
              actualTimeOut,
              attendanceStatus: payload.attendanceStatus,
              remarks,
              hoursWorked,
              tardinessMins,
              undertimeMins,
              overtimeHours,
              nightDiffHours,
              approvalStatusCode: "APPROVED",
              approvedById: context.userId,
              approvedAt: new Date(),
              timeInSourceCode: actualTimeIn ? DtrSource.MANUAL : null,
              timeOutSourceCode: actualTimeOut ? DtrSource.MANUAL : null,
            },
            select: {
              id: true,
              actualTimeIn: true,
              actualTimeOut: true,
              attendanceStatus: true,
              remarks: true,
              hoursWorked: true,
              tardinessMins: true,
              undertimeMins: true,
              overtimeHours: true,
              nightDiffHours: true,
              approvalStatusCode: true,
            },
          })

      const sameManualLeaveState =
        Boolean(selectedLeaveType?.isPaid) &&
        Boolean(existingManualLeaveState) &&
        Boolean(desiredLeaveTypeId) &&
        existingManualLeaveState?.leaveTypeId === desiredLeaveTypeId &&
        existingManualLeaveState?.year === effectiveAttendanceYear &&
        Math.abs((existingManualLeaveState?.numberOfDays ?? 0) - expectedLeaveDays) < 0.001

      if (existingManualLeaveState && !sameManualLeaveState) {
        await reverseManualDtrLeaveUsage({
          tx,
          state: existingManualLeaveState,
          dtrId: updatedRecord.id,
          processedById: context.userId,
        })
      }

      const nextManualLeaveState = desiredLeaveTypeId && selectedLeaveType?.isPaid
        ? sameManualLeaveState && existingManualLeaveState
          ? { leaveTypeId: existingManualLeaveState.leaveTypeId, numberOfDays: existingManualLeaveState.numberOfDays }
          : await applyManualDtrLeaveUsage({
              tx,
              employeeId: payload.employeeId,
              leaveTypeId: desiredLeaveTypeId,
              year: effectiveAttendanceYear,
              numberOfDays: expectedLeaveDays,
              dtrId: updatedRecord.id,
              processedById: context.userId,
            })
        : null

      return {
        updatedRecord,
        existingManualLeaveState,
        nextManualLeaveState,
      }
    })

    updated = transactionResult.updatedRecord
    previousManualLeaveState = transactionResult.existingManualLeaveState
    finalManualLeaveState = transactionResult.nextManualLeaveState
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update DTR record: ${message}` }
  }

  const changes = [
    { fieldName: "actualTimeIn", oldValue: record?.actualTimeIn ?? null, newValue: updated.actualTimeIn },
    { fieldName: "actualTimeOut", oldValue: record?.actualTimeOut ?? null, newValue: updated.actualTimeOut },
    { fieldName: "attendanceStatus", oldValue: record?.attendanceStatus ?? null, newValue: updated.attendanceStatus },
    { fieldName: "remarks", oldValue: record?.remarks ?? null, newValue: updated.remarks },
    { fieldName: "hoursWorked", oldValue: toNumber(record?.hoursWorked ?? null), newValue: toNumber(updated.hoursWorked) },
    { fieldName: "tardinessMins", oldValue: record?.tardinessMins ?? 0, newValue: updated.tardinessMins },
    { fieldName: "undertimeMins", oldValue: record?.undertimeMins ?? 0, newValue: updated.undertimeMins },
    { fieldName: "overtimeHours", oldValue: toNumber(record?.overtimeHours ?? null), newValue: toNumber(updated.overtimeHours) },
    { fieldName: "nightDiffHours", oldValue: toNumber(record?.nightDiffHours ?? null), newValue: toNumber(updated.nightDiffHours) },
    {
      fieldName: "approvalStatusCode",
      oldValue: record?.approvalStatusCode ?? null,
      newValue: updated.approvalStatusCode,
    },
    {
      fieldName: "manualLeaveTypeId",
      oldValue: previousManualLeaveState?.leaveTypeId ?? null,
      newValue: finalManualLeaveState?.leaveTypeId ?? null,
    },
    {
      fieldName: "manualLeaveDays",
      oldValue: previousManualLeaveState?.numberOfDays ?? 0,
      newValue: finalManualLeaveState?.numberOfDays ?? 0,
    },
  ].filter((change) => JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue))

  await createAuditLog({
    tableName: "DailyTimeRecord",
    recordId: updated.id,
    action: record ? "UPDATE" : "CREATE",
    userId: context.userId,
    reason: record ? "DTR_RECORD_MANUAL_CORRECTION" : "DTR_RECORD_MANUAL_CREATION",
    changes,
  })

  revalidatePath(`/${context.companyId}/attendance/dtr`)
  revalidatePath(`/${context.companyId}/attendance/sync-biometrics`)
  revalidatePath(`/${context.companyId}/dashboard`)
  revalidatePath(`/${context.companyId}/leave/balances`)
  revalidatePath(`/${context.companyId}/employee-portal`)
  revalidatePath(`/${context.companyId}/employee-portal/leaves`)

  return {
    ok: true,
    message: record
      ? "DTR record updated and approved."
      : "DTR record created and approved.",
  }
}
