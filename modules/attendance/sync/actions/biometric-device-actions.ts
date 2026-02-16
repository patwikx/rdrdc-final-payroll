"use server"

import { BiometricSyncStatus, Prisma, type CompanyRole } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasAttendanceSensitiveAccess } from "@/modules/auth/utils/authorization-policy"
import { syncBiometricsAction } from "@/modules/attendance/sync/actions/sync-biometrics-action"
import {
  applyBiometricDeviceSyncInputSchema,
  cancelBiometricDeviceEnrollmentInputSchema,
  checkBiometricDeviceUserInputSchema,
  connectBiometricDeviceInputSchema,
  detectBiometricEnrollmentResultInputSchema,
  startBiometricDeviceEnrollmentInputSchema,
  startBiometricEnrollmentSessionInputSchema,
  syncBiometricDeviceInputSchema,
  upsertBiometricDeviceInputSchema,
  type ApplyBiometricDeviceSyncInput,
  type CancelBiometricDeviceEnrollmentInput,
  type CheckBiometricDeviceUserInput,
  type ConnectBiometricDeviceInput,
  type DetectBiometricEnrollmentResultInput,
  type StartBiometricDeviceEnrollmentInput,
  type StartBiometricEnrollmentSessionInput,
  type SyncBiometricDeviceInput,
  type UpsertBiometricDeviceInput,
} from "@/modules/attendance/sync/schemas/biometric-device-actions-schema"
import { decryptBiometricCredential, encryptBiometricCredential } from "@/modules/attendance/sync/utils/biometric-credential-crypto"
import { toDeviceCardItem, type DeviceCardItem } from "@/modules/attendance/sync/utils/device-sync-shared"
import {
  cancelDeviceFingerprintEnrollment,
  checkDeviceUserExists,
  extractDeviceRawLogEvent,
  listDeviceUsers,
  normalizeDeviceRawLogToPunchLine,
  pullDeviceAttendanceLogs,
  startDeviceFingerprintEnrollment,
  testDeviceConnection,
} from "@/modules/attendance/sync/utils/zkteco-direct-client"

type DeviceActionResult = { ok: true; message: string; device: DeviceCardItem } | { ok: false; error: string }

type SyncSummary = {
  pulledLogs: number
  inRangeLogs: number
  outOfRangeLogs: number
  invalidLogs: number
  linesPrepared: number
  skippedLogs: number
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  parseErrors: Array<{ line: string; reason: string }>
  validationErrors: Array<{ employeeNumber: string; date: string; reason: string }>
  previewLines: string[]
  previewTruncated: boolean
  streamMode: "RAW" | "NORMALIZED"
}

type PullDeviceActionResult =
  | {
      ok: true
      message: string
      device: DeviceCardItem
      syncLogId: string
      summary: SyncSummary
    }
  | { ok: false; error: string }

type ApplyDeviceActionResult =
  | {
      ok: true
      message: string
      device: DeviceCardItem
      summary: SyncSummary
    }
  | { ok: false; error: string }

type DeviceUserLookupActionResult =
  | {
      ok: true
      message: string
      found: boolean
      employeeNumber: string
      deviceUserId: string | null
      deviceUid: string | null
      displayName: string | null
      totalUsers: number
      device: DeviceCardItem
    }
  | { ok: false; error: string }

type StartEnrollmentActionResult =
  | {
      ok: true
      message: string
      employeeNumber: string
      deviceUserId: string | null
      deviceUid: string | null
      displayName: string | null
      device: DeviceCardItem
    }
  | { ok: false; error: string }

type EnrollmentSessionActionResult =
  | {
      ok: true
      message: string
      sessionId: string
      employeeId: string
      employeeNumber: string
      employeeName: string
      baselineUserCount: number
      device: DeviceCardItem
    }
  | { ok: false; error: string }

type DetectEnrollmentActionResult =
  | {
      ok: true
      status: "detected"
      message: string
      employeeId: string
      employeeNumber: string
      employeeName: string
      biometricId: string
      deviceUserId: string | null
      deviceUid: string | null
      device: DeviceCardItem
    }
  | {
      ok: true
      status: "pending"
      message: string
      employeeId: string
      employeeNumber: string
      employeeName: string
      device: DeviceCardItem
    }
  | { ok: false; error: string }

const getScopedDevice = async (companyId: string, deviceId: string) => {
  return db.biometricDevice.findFirst({
    where: {
      id: deviceId,
      companyId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })
}

const normalizeSyncStatus = (result: {
  parseErrors: Array<{ line: string; reason: string }>
  validationErrors: Array<{ employeeNumber: string; date: string; reason: string }>
  recordsSkipped: number
}): BiometricSyncStatus => {
  if (
    result.parseErrors.length > 0 ||
    result.validationErrors.length > 0 ||
    result.recordsSkipped > 0
  ) {
    return BiometricSyncStatus.PARTIAL
  }
  return BiometricSyncStatus.SUCCESS
}

const updateRouteCache = (companyId: string) => {
  revalidatePath(`/${companyId}/attendance/sync-biometrics/device`)
  revalidatePath(`/${companyId}/attendance/sync-biometrics`)
}

const formatRawPreviewLine = (row: Record<string, unknown>): string => {
  const employee =
    String(
      row.employeeNumber ??
        row.employeeNo ??
        row.empNo ??
        row.acNo ??
        row.acno ??
        row.enrollNo ??
        row.enrollNumber ??
        row.pin ??
        row.userId ??
        row.userid ??
        row.user_id ??
        row.deviceUserId ??
        row.uid ??
        row.id ??
        "-"
    )
  const timestamp =
    row.timestamp ??
    row.dateTime ??
    row.datetime ??
    row.punchAt ??
    row.punchTime ??
    row.recordTime ??
    row.attTime ??
    row.date ??
    "-"
  const type = row.type ?? row.punchType ?? row.punch_state ?? row.state ?? row.status ?? "-"
  return `${employee} | ${String(timestamp)} | ${String(type)}`
}

type StagedSyncPayload = {
  dateFrom: string
  dateTo: string
  pulledLogs: number
  inRangeLogs: number
  outOfRangeLogs: number
  invalidLogs: number
  skippedLogs: number
  normalizedLines: string[]
  previewLines: string[]
  previewTruncated: boolean
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

const parseStagedSyncPayload = (value: Prisma.JsonValue | null): StagedSyncPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const payload = value as Record<string, unknown>
  if (
    typeof payload.dateFrom !== "string" ||
    typeof payload.dateTo !== "string" ||
    typeof payload.pulledLogs !== "number" ||
    typeof payload.skippedLogs !== "number" ||
    typeof payload.previewTruncated !== "boolean" ||
    !isStringArray(payload.normalizedLines) ||
    !isStringArray(payload.previewLines)
  ) {
    return null
  }

  return {
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    pulledLogs: payload.pulledLogs,
    inRangeLogs: typeof payload.inRangeLogs === "number" ? payload.inRangeLogs : 0,
    outOfRangeLogs: typeof payload.outOfRangeLogs === "number" ? payload.outOfRangeLogs : 0,
    invalidLogs: typeof payload.invalidLogs === "number" ? payload.invalidLogs : 0,
    skippedLogs: payload.skippedLogs,
    normalizedLines: payload.normalizedLines,
    previewLines: payload.previewLines,
    previewTruncated: payload.previewTruncated,
  }
}

type EnrollmentSessionPayload = {
  kind: "ENROLLMENT_SESSION"
  employeeId: string
  employeeNumber: string
  employeeName: string
  baselineKeys: string[]
}

const normalizeIdentifier = (value: string | null | undefined): string => {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  const upper = raw.toUpperCase()
  if (/^\d+$/.test(upper)) {
    const compact = upper.replace(/^0+(?=\d)/, "")
    return compact || "0"
  }
  return upper
}

const buildDeviceUserKey = (userId?: string | null, uid?: string | null): string => {
  const userPart = normalizeIdentifier(userId)
  const uidPart = normalizeIdentifier(uid)
  if (userPart && uidPart) return `${userPart}::${uidPart}`
  return userPart || uidPart
}

const parseEnrollmentSessionPayload = (value: Prisma.JsonValue | null): EnrollmentSessionPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const payload = value as Record<string, unknown>
  if (
    payload.kind !== "ENROLLMENT_SESSION" ||
    typeof payload.employeeId !== "string" ||
    typeof payload.employeeNumber !== "string" ||
    typeof payload.employeeName !== "string" ||
    !Array.isArray(payload.baselineKeys) ||
    !payload.baselineKeys.every((entry) => typeof entry === "string")
  ) {
    return null
  }

  return {
    kind: "ENROLLMENT_SESSION",
    employeeId: payload.employeeId,
    employeeNumber: payload.employeeNumber,
    employeeName: payload.employeeName,
    baselineKeys: payload.baselineKeys as string[],
  }
}

export async function upsertBiometricDeviceAction(input: UpsertBiometricDeviceInput): Promise<DeviceActionResult> {
  const parsed = upsertBiometricDeviceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid biometric device payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to manage biometric devices." }
  }

  const credentialEncrypted = encryptBiometricCredential(payload.commKey)

  try {
    const saved = await db.$transaction(async (tx) => {
      if (payload.deviceId) {
        const existing = await tx.biometricDevice.findFirst({
          where: {
            id: payload.deviceId,
            companyId: context.companyId,
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            code: true,
            name: true,
            deviceModel: true,
            ipAddress: true,
            port: true,
            timeout: true,
            inport: true,
            locationName: true,
            isOnline: true,
            lastOnlineAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncRecordCount: true,
            password: true,
          },
        })

        if (!existing) {
          throw new Error("Biometric device not found.")
        }

        const updated = await tx.biometricDevice.update({
          where: { id: payload.deviceId },
          data: {
            code: payload.code,
            name: payload.name,
            deviceModel: payload.deviceModel,
            ipAddress: payload.ipAddress,
            port: payload.port,
            timeout: payload.timeoutMs,
            inport: payload.inport ?? null,
            locationName: payload.locationName?.trim() || null,
            ...(payload.clearCommKey
              ? { password: null }
              : credentialEncrypted
                ? { password: credentialEncrypted }
                : {}),
            updatedById: context.userId,
          },
          select: {
            id: true,
            code: true,
            name: true,
            deviceModel: true,
            ipAddress: true,
            port: true,
            timeout: true,
            inport: true,
            locationName: true,
            isOnline: true,
            lastOnlineAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncRecordCount: true,
            password: true,
          },
        })

        await createAuditLog(
          {
            tableName: "BiometricDevice",
            recordId: updated.id,
            action: "UPDATE",
            userId: context.userId,
            reason: "BIOMETRIC_DEVICE_UPDATED",
            changes: [
              { fieldName: "code", oldValue: existing.code, newValue: updated.code },
              { fieldName: "name", oldValue: existing.name, newValue: updated.name },
              { fieldName: "ipAddress", oldValue: existing.ipAddress, newValue: updated.ipAddress },
              { fieldName: "port", oldValue: existing.port, newValue: updated.port },
            ],
          },
          tx
        )

        return updated
      }

      const created = await tx.biometricDevice.create({
        data: {
          companyId: context.companyId,
          code: payload.code,
          name: payload.name,
          deviceModel: payload.deviceModel,
          ipAddress: payload.ipAddress,
          port: payload.port,
          timeout: payload.timeoutMs,
          inport: payload.inport ?? null,
          locationName: payload.locationName?.trim() || null,
          password: payload.clearCommKey ? null : credentialEncrypted,
          autoSyncEnabled: false,
          createdById: context.userId,
          updatedById: context.userId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          deviceModel: true,
          ipAddress: true,
          port: true,
          timeout: true,
          inport: true,
          locationName: true,
          isOnline: true,
          lastOnlineAt: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastSyncRecordCount: true,
          password: true,
        },
      })

      await createAuditLog(
        {
          tableName: "BiometricDevice",
          recordId: created.id,
          action: "CREATE",
          userId: context.userId,
          reason: "BIOMETRIC_DEVICE_CREATED",
          changes: [
            { fieldName: "code", newValue: created.code },
            { fieldName: "name", newValue: created.name },
            { fieldName: "ipAddress", newValue: created.ipAddress },
            { fieldName: "port", newValue: created.port },
          ],
        },
        tx
      )

      return created
    })

    updateRouteCache(context.companyId)
    return {
      ok: true,
      message: payload.deviceId ? "Biometric device updated." : "Biometric device created.",
      device: toDeviceCardItem(saved),
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Device code already exists in this company." }
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save biometric device.",
    }
  }
}

export async function connectBiometricDeviceAction(input: ConnectBiometricDeviceInput): Promise<DeviceActionResult> {
  const parsed = connectBiometricDeviceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid device connect payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to connect biometric devices." }
  }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) {
    return { ok: false, error: "Biometric device not found." }
  }

  const result = await testDeviceConnection({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
  })

  const now = new Date()
  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: result.ok
      ? {
          isOnline: true,
          lastOnlineAt: now,
          updatedById: context.userId,
        }
      : {
          isOnline: false,
          updatedById: context.userId,
        },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })

  updateRouteCache(context.companyId)

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return {
    ok: true,
    message: `Connected to ${updated.name} (${updated.ipAddress}:${String(updated.port)}).`,
    device: toDeviceCardItem(updated),
  }
}

export async function startBiometricEnrollmentSessionAction(
  input: StartBiometricEnrollmentSessionInput
): Promise<EnrollmentSessionActionResult> {
  const parsed = startBiometricEnrollmentSessionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid enrollment session payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to start biometric enrollment sessions." }
  }

  const [device, employee] = await Promise.all([
    getScopedDevice(context.companyId, payload.deviceId),
    db.employee.findFirst({
      where: {
        id: payload.employeeId,
        companyId: context.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
    }),
  ])

  if (!device) return { ok: false, error: "Biometric device not found." }
  if (!employee) return { ok: false, error: "Employee not found in active company." }

  const usersResult = await listDeviceUsers({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
  })

  const now = new Date()
  if (!usersResult.ok) {
    await db.biometricDevice.update({
      where: { id: device.id },
      data: { isOnline: false, updatedById: context.userId },
    })
    updateRouteCache(context.companyId)
    return { ok: false, error: usersResult.error }
  }

  const baselineKeys = Array.from(
    new Set(
      usersResult.users
        .map((user) => buildDeviceUserKey(user.userId ?? null, user.uid ?? null))
        .filter((key) => key.length > 0)
    )
  )

  const employeeName = `${employee.lastName}, ${employee.firstName}`

  const syncLog = await db.biometricSyncLog.create({
    data: {
      deviceId: device.id,
      syncStartedAt: now,
      status: BiometricSyncStatus.STARTED,
      syncType: "ENROLLMENT_SESSION",
      triggeredById: context.userId,
      recordsFetched: baselineKeys.length,
      errorDetails: {
        kind: "ENROLLMENT_SESSION",
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        employeeName,
        baselineKeys,
      },
      errorMessage: `Enrollment session started for ${employee.employeeNumber}.`,
    },
    select: { id: true },
  })

  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: {
      isOnline: true,
      lastOnlineAt: now,
      updatedById: context.userId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })

  await createAuditLog({
    tableName: "BiometricSyncLog",
    recordId: syncLog.id,
    action: "CREATE",
    userId: context.userId,
    reason: "BIOMETRIC_ENROLLMENT_SESSION_STARTED",
    changes: [
      { fieldName: "deviceId", newValue: device.id },
      { fieldName: "employeeId", newValue: employee.id },
      { fieldName: "employeeNumber", newValue: employee.employeeNumber },
      { fieldName: "baselineUsers", newValue: baselineKeys.length },
    ],
  })

  updateRouteCache(context.companyId)

  return {
    ok: true,
    message: `Session started for ${employeeName}. Enroll fingerprint on device now, then click Detect Result.`,
    sessionId: syncLog.id,
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    employeeName,
    baselineUserCount: baselineKeys.length,
    device: toDeviceCardItem(updated),
  }
}

export async function detectBiometricEnrollmentResultAction(
  input: DetectBiometricEnrollmentResultInput
): Promise<DetectEnrollmentActionResult> {
  const parsed = detectBiometricEnrollmentResultInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid enrollment detect payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to detect enrollment results." }
  }

  const [device, session] = await Promise.all([
    getScopedDevice(context.companyId, payload.deviceId),
    db.biometricSyncLog.findFirst({
      where: {
        id: payload.sessionId,
        deviceId: payload.deviceId,
        syncType: "ENROLLMENT_SESSION",
        device: { companyId: context.companyId },
      },
      select: {
        id: true,
        status: true,
        errorDetails: true,
      },
    }),
  ])

  if (!device) return { ok: false, error: "Biometric device not found." }
  if (!session) return { ok: false, error: "Enrollment session not found." }
  if (session.status !== BiometricSyncStatus.STARTED) {
    return { ok: false, error: "Enrollment session is already completed. Start a new session for another scan." }
  }

  const sessionPayload = parseEnrollmentSessionPayload(session.errorDetails)
  if (!sessionPayload) {
    return { ok: false, error: "Enrollment session payload is invalid or corrupted." }
  }

  const employee = await db.employee.findFirst({
    where: {
      id: sessionPayload.employeeId,
      companyId: context.companyId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      biometricId: true,
    },
  })

  if (!employee) {
    return { ok: false, error: "Employee linked to this enrollment session is no longer available." }
  }
  const employeeName = `${employee.lastName}, ${employee.firstName}`

  const usersResult = await listDeviceUsers({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
  })

  const now = new Date()
  if (!usersResult.ok) {
    await db.biometricDevice.update({
      where: { id: device.id },
      data: { isOnline: false, updatedById: context.userId },
    })
    updateRouteCache(context.companyId)
    return { ok: false, error: usersResult.error }
  }

  const baselineSet = new Set(sessionPayload.baselineKeys)
  const currentUsers = usersResult.users
    .map((user) => ({
      userId: user.userId ?? null,
      uid: user.uid ?? null,
      name: user.name ?? null,
      key: buildDeviceUserKey(user.userId ?? null, user.uid ?? null),
    }))
    .filter((user) => user.key.length > 0)

  const addedUsers = currentUsers.filter((user) => !baselineSet.has(user.key))
  let detected = addedUsers.length === 1 ? addedUsers[0] : null

  if (!detected && addedUsers.length === 0) {
    const employeeNumberMatch = currentUsers.filter(
      (user) =>
        normalizeIdentifier(user.userId) === normalizeIdentifier(employee.employeeNumber) ||
        normalizeIdentifier(user.uid) === normalizeIdentifier(employee.employeeNumber)
    )
    if (employeeNumberMatch.length === 1) {
      detected = employeeNumberMatch[0]
    }
  }

  if (!detected && addedUsers.length > 1) {
    return {
      ok: false,
      error: `Multiple new device users detected (${addedUsers.length}). Please re-run with one employee enrolling at a time.`,
    }
  }

  if (!detected) {
    const updated = await db.biometricDevice.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastOnlineAt: now,
        updatedById: context.userId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        deviceModel: true,
        ipAddress: true,
        port: true,
        timeout: true,
        inport: true,
        locationName: true,
        isOnline: true,
        lastOnlineAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncRecordCount: true,
        password: true,
      },
    })

    return {
      ok: true,
      status: "pending",
      message: "Waiting for enrollment scans on device (up to 3 scans).",
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName,
      device: toDeviceCardItem(updated),
    }
  }

  const resolvedBiometricId = (detected.userId ?? detected.uid ?? "").trim()
  if (!resolvedBiometricId) {
    return { ok: false, error: "Detected device user has no usable AC No / user identifier." }
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        biometricId: resolvedBiometricId,
        updatedById: context.userId,
      },
    })

    await tx.biometricSyncLog.update({
      where: { id: session.id },
      data: {
        status: BiometricSyncStatus.SUCCESS,
        syncCompletedAt: now,
        recordsFetched: currentUsers.length,
        recordsProcessed: 1,
        recordsUpdated: employee.biometricId ? 1 : 0,
        recordsCreated: employee.biometricId ? 0 : 1,
        errorDetails: {
          ...sessionPayload,
          detected: {
            userId: detected.userId,
            uid: detected.uid,
            name: detected.name,
          },
        },
        errorMessage: null,
      },
    })

    return tx.biometricDevice.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastOnlineAt: now,
        updatedById: context.userId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        deviceModel: true,
        ipAddress: true,
        port: true,
        timeout: true,
        inport: true,
        locationName: true,
        isOnline: true,
        lastOnlineAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncRecordCount: true,
        password: true,
      },
    })
  })

  await createAuditLog({
    tableName: "Employee",
    recordId: employee.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "EMPLOYEE_BIOMETRIC_ID_ASSIGNED_FROM_DEVICE_ENROLLMENT",
    changes: [
      { fieldName: "employeeNumber", newValue: employee.employeeNumber },
      { fieldName: "biometricId", oldValue: employee.biometricId ?? null, newValue: resolvedBiometricId },
      { fieldName: "deviceId", newValue: device.id },
    ],
  })

  updateRouteCache(context.companyId)

  return {
    ok: true,
    status: "detected",
    message: `Enrollment detected. ${employeeName} is now linked to biometric ID ${resolvedBiometricId}.`,
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    employeeName,
    biometricId: resolvedBiometricId,
    deviceUserId: detected.userId,
    deviceUid: detected.uid,
    device: toDeviceCardItem(updated),
  }
}

export async function checkBiometricDeviceUserAction(input: CheckBiometricDeviceUserInput): Promise<DeviceUserLookupActionResult> {
  const parsed = checkBiometricDeviceUserInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid device user check payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to check biometric device users." }
  }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) {
    return { ok: false, error: "Biometric device not found." }
  }

  const lookup = await checkDeviceUserExists({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
    employeeNumber: payload.employeeNumber,
  })

  const now = new Date()
  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: lookup.ok
      ? {
          isOnline: true,
          lastOnlineAt: now,
          updatedById: context.userId,
        }
      : {
          isOnline: false,
          updatedById: context.userId,
        },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })

  updateRouteCache(context.companyId)

  if (!lookup.ok) {
    return { ok: false, error: lookup.error }
  }

  const matched = lookup.matchedUser
  const message = lookup.found
    ? `Employee ${payload.employeeNumber} exists on device.`
    : `Employee ${payload.employeeNumber} was not found on device users.`

  return {
    ok: true,
    message,
    found: lookup.found,
    employeeNumber: payload.employeeNumber,
    deviceUserId: matched?.userId ?? null,
    deviceUid: matched?.uid ?? null,
    displayName: matched?.name ?? null,
    totalUsers: lookup.totalUsers,
    device: toDeviceCardItem(updated),
  }
}

export async function startBiometricDeviceEnrollmentAction(input: StartBiometricDeviceEnrollmentInput): Promise<StartEnrollmentActionResult> {
  const parsed = startBiometricDeviceEnrollmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid enrollment payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to start biometric enrollment." }
  }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) {
    return { ok: false, error: "Biometric device not found." }
  }

  const enrollment = await startDeviceFingerprintEnrollment({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
    employeeNumber: payload.employeeNumber,
  })

  const now = new Date()
  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: enrollment.ok
      ? {
          isOnline: true,
          lastOnlineAt: now,
          updatedById: context.userId,
        }
      : {
          isOnline: false,
          updatedById: context.userId,
        },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })

  updateRouteCache(context.companyId)

  if (!enrollment.ok) {
    return { ok: false, error: enrollment.error }
  }

  await createAuditLog({
    tableName: "BiometricDevice",
    recordId: device.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "BIOMETRIC_ENROLLMENT_STARTED",
    changes: [
      { fieldName: "employeeNumber", newValue: payload.employeeNumber },
      { fieldName: "deviceId", newValue: device.id },
    ],
  })

  const matched = enrollment.matchedUser
  return {
    ok: true,
    message: `Enrollment started for ${payload.employeeNumber}. Ask employee to scan the same finger 3 times on the device.`,
    employeeNumber: payload.employeeNumber,
    deviceUserId: matched?.userId ?? null,
    deviceUid: matched?.uid ?? null,
    displayName: matched?.name ?? null,
    device: toDeviceCardItem(updated),
  }
}

export async function cancelBiometricDeviceEnrollmentAction(input: CancelBiometricDeviceEnrollmentInput): Promise<DeviceActionResult> {
  const parsed = cancelBiometricDeviceEnrollmentInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid enrollment cancel payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) {
    return { ok: false, error: "You do not have permission to cancel biometric enrollment." }
  }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) {
    return { ok: false, error: "Biometric device not found." }
  }

  const cancelResult = await cancelDeviceFingerprintEnrollment({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
  })

  const now = new Date()
  const updated = await db.biometricDevice.update({
    where: { id: device.id },
    data: cancelResult.ok
      ? {
          isOnline: true,
          lastOnlineAt: now,
          updatedById: context.userId,
        }
      : {
          isOnline: false,
          updatedById: context.userId,
        },
    select: {
      id: true,
      code: true,
      name: true,
      deviceModel: true,
      ipAddress: true,
      port: true,
      timeout: true,
      inport: true,
      locationName: true,
      isOnline: true,
      lastOnlineAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncRecordCount: true,
      password: true,
    },
  })

  updateRouteCache(context.companyId)

  if (!cancelResult.ok) {
    return { ok: false, error: cancelResult.error }
  }

  await createAuditLog({
    tableName: "BiometricDevice",
    recordId: device.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "BIOMETRIC_ENROLLMENT_CANCELLED",
    changes: [{ fieldName: "deviceId", newValue: device.id }],
  })

  return {
    ok: true,
    message: `Enrollment capture cancelled on ${device.name}.`,
    device: toDeviceCardItem(updated),
  }
}

export async function pullBiometricDeviceLogsAction(input: SyncBiometricDeviceInput): Promise<PullDeviceActionResult> {
  const parsed = syncBiometricDeviceInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid device pull payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) return { ok: false, error: "You do not have permission to sync biometric devices." }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) {
    return { ok: false, error: "Biometric device not found." }
  }

  const syncStartedAt = new Date()
  const syncLog = await db.biometricSyncLog.create({
    data: {
      deviceId: device.id,
      syncStartedAt,
      status: BiometricSyncStatus.STARTED,
      syncType: "MANUAL",
      triggeredById: context.userId,
    },
    select: { id: true, syncStartedAt: true },
  })

  const pulled = await pullDeviceAttendanceLogs({
    host: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    commKey: decryptBiometricCredential(device.password),
  })

  if (!pulled.ok) {
    const now = new Date()
    await db.$transaction(async (tx) => {
      await tx.biometricSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: BiometricSyncStatus.FAILED,
          syncCompletedAt: now,
          errorMessage: pulled.error,
          recordsFailed: 1,
        },
      })

      await tx.biometricDevice.update({
        where: { id: device.id },
        data: {
          isOnline: false,
          updatedById: context.userId,
        },
      })
    })

    updateRouteCache(context.companyId)
    return { ok: false, error: pulled.error }
  }

  const normalizedLines: string[] = []
  const typedKeys = new Set<string>()
  const typelessByDay = new Map<string, { employeeNumber: string; dateText: string; times: string[] }>()
  let invalidLogs = 0
  let outOfRangeLogs = 0
  let inRangeLogs = 0
  const rawPreviewLines: string[] = []
  let earliestDeviceDate: string | null = null
  let latestDeviceDate: string | null = null

  for (const raw of pulled.logs) {
    const extracted = extractDeviceRawLogEvent(raw)
    if (!extracted.ok) {
      invalidLogs += 1
      continue
    }

    if (!earliestDeviceDate || extracted.dateText < earliestDeviceDate) {
      earliestDeviceDate = extracted.dateText
    }
    if (!latestDeviceDate || extracted.dateText > latestDeviceDate) {
      latestDeviceDate = extracted.dateText
    }

    if (extracted.dateText < payload.dateFrom || extracted.dateText > payload.dateTo) {
      outOfRangeLogs += 1
      continue
    }

    inRangeLogs += 1
    if (rawPreviewLines.length < 1200) {
      rawPreviewLines.push(formatRawPreviewLine(raw))
    }

    const normalized = normalizeDeviceRawLogToPunchLine(raw)
    if (normalized.ok) {
      normalizedLines.push(normalized.line)
      typedKeys.add(`${extracted.employeeNumber}__${extracted.dateText}`)
      continue
    }

    const dayKey = `${extracted.employeeNumber}__${extracted.dateText}`
    const existing = typelessByDay.get(dayKey)
    if (!existing) {
      typelessByDay.set(dayKey, {
        employeeNumber: extracted.employeeNumber,
        dateText: extracted.dateText,
        times: [extracted.timeText],
      })
      continue
    }
    existing.times.push(extracted.timeText)
  }

  for (const [key, entry] of typelessByDay.entries()) {
    if (typedKeys.has(key)) {
      continue
    }

    const uniqueTimes = Array.from(new Set(entry.times)).sort((a, b) => a.localeCompare(b))
    if (uniqueTimes.length === 0) {
      continue
    }

    const first = uniqueTimes[0]
    normalizedLines.push(`${entry.employeeNumber} ${entry.dateText} ${first} 0`)

    const last = uniqueTimes[uniqueTimes.length - 1]
    if (last !== first) {
      normalizedLines.push(`${entry.employeeNumber} ${entry.dateText} ${last} 1`)
    }
  }

  const previewLimit = 800
  const previewLines = rawPreviewLines.slice(0, previewLimit)
  const previewTruncated = inRangeLogs > previewLines.length

  const noInRangeMessage =
    inRangeLogs === 0
      ? earliestDeviceDate && latestDeviceDate
        ? `No logs found in selected date range. Device log coverage is ${earliestDeviceDate} to ${latestDeviceDate}.`
        : "No logs found in selected date range."
      : "No valid punch pairs were prepared from in-range logs."

  const stagedPayload: StagedSyncPayload = {
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    pulledLogs: pulled.logs.length,
    inRangeLogs,
    outOfRangeLogs,
    invalidLogs,
    skippedLogs: outOfRangeLogs + invalidLogs,
    normalizedLines,
    previewLines,
    previewTruncated,
  }

  if (normalizedLines.length === 0) {
    const now = new Date()
    const updatedDevice = await db.$transaction(async (tx) => {
      await tx.biometricSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: BiometricSyncStatus.PARTIAL,
          syncCompletedAt: now,
          recordsFetched: pulled.logs.length,
          recordsSkipped: stagedPayload.skippedLogs,
          errorDetails: stagedPayload,
          errorMessage: noInRangeMessage,
        },
      })

      return tx.biometricDevice.update({
        where: { id: device.id },
        data: {
          isOnline: true,
          lastOnlineAt: now,
          updatedById: context.userId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          deviceModel: true,
          ipAddress: true,
          port: true,
          timeout: true,
          inport: true,
          locationName: true,
          isOnline: true,
          lastOnlineAt: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastSyncRecordCount: true,
          password: true,
        },
      })
    })

    updateRouteCache(context.companyId)
    return {
      ok: true,
      message: `Pull complete. ${noInRangeMessage}`,
      device: toDeviceCardItem(updatedDevice),
      syncLogId: syncLog.id,
      summary: {
        pulledLogs: pulled.logs.length,
        inRangeLogs,
        outOfRangeLogs,
        invalidLogs,
        linesPrepared: 0,
        skippedLogs: stagedPayload.skippedLogs,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        parseErrors: [],
        validationErrors: [],
        previewLines,
        previewTruncated,
        streamMode: "RAW",
      },
    }
  }

  const now = new Date()
  const updatedDevice = await db.$transaction(async (tx) => {
    await tx.biometricSyncLog.update({
      where: { id: syncLog.id },
      data: {
        recordsFetched: pulled.logs.length,
        recordsSkipped: stagedPayload.skippedLogs,
        errorDetails: stagedPayload,
        errorMessage: "Logs pulled and staged. Run Sync & Match Logs to apply to employee DTR.",
      },
    })

    return tx.biometricDevice.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastOnlineAt: now,
        updatedById: context.userId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        deviceModel: true,
        ipAddress: true,
        port: true,
        timeout: true,
        inport: true,
        locationName: true,
        isOnline: true,
        lastOnlineAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncRecordCount: true,
        password: true,
      },
    })
  })

  await createAuditLog({
    tableName: "BiometricSyncLog",
    recordId: syncLog.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "BIOMETRIC_MANUAL_PULL_STAGED",
    changes: [
      { fieldName: "deviceId", newValue: device.id },
      { fieldName: "recordsFetched", newValue: pulled.logs.length },
      { fieldName: "recordsPrepared", newValue: normalizedLines.length },
      { fieldName: "stagedAt", newValue: syncLog.syncStartedAt.toISOString() },
    ],
  })

  updateRouteCache(context.companyId)

  return {
    ok: true,
    message: `Pulled ${pulled.logs.length} logs. Ready to sync ${normalizedLines.length} matched lines to DTR.`,
    device: toDeviceCardItem(updatedDevice),
    syncLogId: syncLog.id,
    summary: {
      pulledLogs: pulled.logs.length,
      inRangeLogs,
      outOfRangeLogs,
      invalidLogs,
      linesPrepared: normalizedLines.length,
      skippedLogs: stagedPayload.skippedLogs,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      parseErrors: [],
      validationErrors: [],
      previewLines,
      previewTruncated,
      streamMode: "RAW",
    },
  }
}

export async function applyBiometricDeviceSyncAction(input: ApplyBiometricDeviceSyncInput): Promise<ApplyDeviceActionResult> {
  const parsed = applyBiometricDeviceSyncInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sync apply payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasAttendanceSensitiveAccess(context.companyRole as CompanyRole)) return { ok: false, error: "You do not have permission to sync biometric devices." }

  const device = await getScopedDevice(context.companyId, payload.deviceId)
  if (!device) return { ok: false, error: "Biometric device not found." }

  const syncLog = await db.biometricSyncLog.findFirst({
    where: {
      id: payload.syncLogId,
      deviceId: payload.deviceId,
      device: {
        companyId: context.companyId,
      },
    },
    select: {
      id: true,
      status: true,
      errorDetails: true,
    },
  })

  if (!syncLog) return { ok: false, error: "Staged sync session not found." }
  if (syncLog.status !== BiometricSyncStatus.STARTED) {
    return { ok: false, error: "This sync session is already finalized. Pull logs again to start a new session." }
  }

  const stagedPayload = parseStagedSyncPayload(syncLog.errorDetails)
  if (!stagedPayload) {
    return { ok: false, error: "No staged logs found in this session. Pull logs first." }
  }

  if (stagedPayload.normalizedLines.length === 0) {
    return { ok: false, error: "No staged logs available to sync. Pull logs with a different date range." }
  }

  const importResult = await syncBiometricsAction({
    companyId: context.companyId,
    fileContent: stagedPayload.normalizedLines.join("\n"),
  })

  if (!importResult.ok) {
    const now = new Date()
    await db.$transaction(async (tx) => {
      await tx.biometricSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: BiometricSyncStatus.FAILED,
          syncCompletedAt: now,
          recordsFetched: stagedPayload.pulledLogs,
          recordsFailed: stagedPayload.normalizedLines.length,
          errorDetails: stagedPayload,
          errorMessage: importResult.error,
        },
      })

      await tx.biometricDevice.update({
        where: { id: device.id },
        data: {
          isOnline: true,
          lastOnlineAt: now,
          lastSyncAt: now,
          lastSyncStatus: BiometricSyncStatus.FAILED,
          lastSyncError: importResult.error,
          updatedById: context.userId,
        },
      })
    })

    updateRouteCache(context.companyId)
    return { ok: false, error: importResult.error }
  }

  const completedAt = new Date()
  const status = normalizeSyncStatus(importResult.data)
  const recordsFailed = importResult.data.parseErrors.length + importResult.data.validationErrors.length

  const updatedDevice = await db.$transaction(async (tx) => {
    await tx.biometricSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        syncCompletedAt: completedAt,
        recordsFetched: stagedPayload.pulledLogs,
        recordsProcessed: importResult.data.recordsProcessed,
        recordsCreated: importResult.data.recordsCreated,
        recordsUpdated: importResult.data.recordsUpdated,
        recordsSkipped: importResult.data.recordsSkipped + stagedPayload.skippedLogs,
        recordsFailed,
        errorDetails: {
          stagedRange: {
            dateFrom: stagedPayload.dateFrom,
            dateTo: stagedPayload.dateTo,
          },
          parseErrors: importResult.data.parseErrors,
          validationErrors: importResult.data.validationErrors,
        },
        errorMessage:
          status === BiometricSyncStatus.PARTIAL
            ? "Sync completed with parse/validation skips."
            : null,
      },
    })

    return tx.biometricDevice.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastOnlineAt: completedAt,
        lastSyncAt: completedAt,
        lastSyncStatus: status,
        lastSyncRecordCount: importResult.data.recordsProcessed,
        lastSyncError:
          status === BiometricSyncStatus.PARTIAL
            ? "Sync completed with parse/validation skips."
            : null,
        updatedById: context.userId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        deviceModel: true,
        ipAddress: true,
        port: true,
        timeout: true,
        inport: true,
        locationName: true,
        isOnline: true,
        lastOnlineAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncRecordCount: true,
        password: true,
      },
    })
  })

  await createAuditLog({
    tableName: "BiometricSyncLog",
    recordId: syncLog.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "BIOMETRIC_MANUAL_SYNC_COMPLETED",
    changes: [
      { fieldName: "deviceId", newValue: device.id },
      { fieldName: "recordsFetched", newValue: stagedPayload.pulledLogs },
      { fieldName: "recordsProcessed", newValue: importResult.data.recordsProcessed },
      { fieldName: "status", newValue: status },
    ],
  })

  updateRouteCache(context.companyId)

  return {
    ok: true,
    message: `Synced ${importResult.data.recordsProcessed} records from ${device.name}.`,
    device: toDeviceCardItem(updatedDevice),
    summary: {
      pulledLogs: stagedPayload.pulledLogs,
      inRangeLogs: stagedPayload.inRangeLogs,
      outOfRangeLogs: stagedPayload.outOfRangeLogs,
      invalidLogs: stagedPayload.invalidLogs,
      linesPrepared: stagedPayload.normalizedLines.length,
      skippedLogs: stagedPayload.skippedLogs,
      recordsProcessed: importResult.data.recordsProcessed,
      recordsCreated: importResult.data.recordsCreated,
      recordsUpdated: importResult.data.recordsUpdated,
      recordsSkipped: importResult.data.recordsSkipped,
      parseErrors: importResult.data.parseErrors,
      validationErrors: importResult.data.validationErrors,
      previewLines: stagedPayload.previewLines,
      previewTruncated: stagedPayload.previewTruncated,
      streamMode: "RAW",
    },
  }
}

export async function syncBiometricDeviceAction(input: SyncBiometricDeviceInput): Promise<PullDeviceActionResult> {
  return pullBiometricDeviceLogsAction(input)
}
