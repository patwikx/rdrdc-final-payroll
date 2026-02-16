import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"

export type DeviceRawLog = Record<string, unknown>

type DeviceClient = {
  createSocket: () => Promise<unknown>
  getAttendances: () => Promise<unknown>
  getUsers?: () => Promise<unknown>
  executeCmd?: (command: number, data?: unknown) => Promise<unknown>
  disconnect?: () => Promise<unknown> | unknown
}

type DeviceClientConstructor = new (
  ip: string,
  port: number,
  timeout: number,
  inport: number
) => DeviceClient

type NormalizeDeviceLogResult =
  | { ok: true; line: string; dateText: string }
  | { ok: false; reason: string }

type ExtractDeviceLogEventResult =
  | { ok: true; employeeNumber: string; dateText: string; timeText: string; typeCode: "0" | "1" | null }
  | { ok: false; reason: string }

const PH_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})

const PH_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Manila",
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const toText = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return ""
}

const firstText = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = toText(source[key])
    if (value) return value
  }
  return ""
}

const normalizeDateText = (value: string): string | null => {
  const trimmed = value.trim()
  const ymd = trimmed.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/)
  if (!ymd) return null

  const normalized = `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return parsePhDateInputToUtcDateOnly(normalized) ? normalized : null
}

const normalizeTimeText = (value: string): string | null => {
  const trimmed = value.trim()
  if (/^\d{4}$/.test(trimmed)) {
    const hour = Number(trimmed.slice(0, 2))
    const minute = Number(trimmed.slice(2, 4))
    if (hour <= 23 && minute <= 59) return trimmed
    return null
  }

  const hhmm = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!hhmm) return null

  const hour = Number(hhmm[1])
  const minute = Number(hhmm[2])
  if (hour > 23 || minute > 59) return null
  return `${hhmm[1]}${hhmm[2]}`
}

const extractDateAndTimeFromTimestamp = (timestampRaw: string): { dateText: string; timeText: string } | null => {
  const normalizedFromPattern = timestampRaw.match(
    /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/
  )
  if (normalizedFromPattern) {
    const dateText = `${normalizedFromPattern[1]}-${normalizedFromPattern[2]}-${normalizedFromPattern[3]}`
    const timeText = `${normalizedFromPattern[4]}${normalizedFromPattern[5]}`
    if (parsePhDateInputToUtcDateOnly(dateText) && normalizeTimeText(timeText)) {
      return { dateText, timeText }
    }
  }

  const parsed = new Date(timestampRaw)
  if (Number.isNaN(parsed.getTime())) return null

  const dateText = PH_DATE_FORMATTER.format(parsed)
  const timeText = PH_TIME_FORMATTER.format(parsed).replace(":", "")
  if (!parsePhDateInputToUtcDateOnly(dateText) || !normalizeTimeText(timeText)) {
    return null
  }

  return { dateText, timeText }
}

const normalizeTypeCode = (row: Record<string, unknown>): "0" | "1" | null => {
  const raw = firstText(row, [
    "type",
    "punchType",
    "punch_state",
    "punchState",
    "direction",
    "inOut",
    "io",
    "state",
    "status",
  ]).toUpperCase()

  if (!raw) return null

  const inTokens = new Set(["0", "IN", "I", "CLOCK_IN", "TIME_IN", "CHECK_IN", "CIN", "INBOUND"])
  const outTokens = new Set(["1", "OUT", "O", "CLOCK_OUT", "TIME_OUT", "CHECK_OUT", "COUT", "OUTBOUND"])

  if (inTokens.has(raw)) return "0"
  if (outTokens.has(raw)) return "1"
  return null
}

export const extractDeviceRawLogEvent = (row: DeviceRawLog): ExtractDeviceLogEventResult => {
  const employeeNumber = firstText(row, [
    "employeeNumber",
    "employeeNo",
    "empNo",
    "acNo",
    "acno",
    "enrollNo",
    "enrollNumber",
    "pin",
    "userId",
    "userid",
    "user_id",
    "deviceUserId",
    "uid",
    "id",
    "userSN",
    "userSn",
  ])

  if (!employeeNumber) {
    return { ok: false, reason: "Missing employee identifier (employeeNumber/acNo/userId)." }
  }

  const dateRaw = firstText(row, ["date", "attendanceDate", "logDate", "day", "recordDate"])
  const timeRaw = firstText(row, ["time", "clockTime", "logTime", "hhmm", "recordTime"])
  const timestampRaw = firstText(row, [
    "timestamp",
    "dateTime",
    "datetime",
    "punchAt",
    "punchTime",
    "recordTime",
    "recordDateTime",
    "authDateTime",
    "attTime",
  ])

  let dateText: string | null = null
  let timeText: string | null = null

  if (dateRaw && timeRaw) {
    dateText = normalizeDateText(dateRaw)
    timeText = normalizeTimeText(timeRaw)
  } else if (timestampRaw) {
    const extracted = extractDateAndTimeFromTimestamp(timestampRaw)
    dateText = extracted?.dateText ?? null
    timeText = extracted?.timeText ?? null
  }

  if (!dateText || !timeText) {
    return { ok: false, reason: "Missing or invalid date/time values." }
  }

  return {
    ok: true,
    employeeNumber,
    dateText,
    timeText,
    typeCode: normalizeTypeCode(row),
  }
}

export const normalizeDeviceRawLogToPunchLine = (row: DeviceRawLog): NormalizeDeviceLogResult => {
  const extracted = extractDeviceRawLogEvent(row)
  if (!extracted.ok) {
    return extracted
  }

  if (!extracted.typeCode) {
    return { ok: false, reason: "Missing or invalid punch type." }
  }

  return {
    ok: true,
    dateText: extracted.dateText,
    line: `${extracted.employeeNumber} ${extracted.dateText} ${extracted.timeText} ${extracted.typeCode}`,
  }
}

const resolveDeviceLibraryConstructor = async (): Promise<DeviceClientConstructor | null> => {
  const dynamicImport = new Function(
    "moduleName",
    "return import(moduleName)"
  ) as (moduleName: string) => Promise<unknown>

  try {
    const moduleRaw = await dynamicImport("node-zklib")
    if (!isRecord(moduleRaw)) return null

    const ctorCandidate = moduleRaw.default ?? moduleRaw.ZKLib
    if (typeof ctorCandidate === "function") {
      return ctorCandidate as DeviceClientConstructor
    }
    return null
  } catch {
    return null
  }
}

const applyCredential = async (client: DeviceClient, commKey?: string): Promise<void> => {
  if (!commKey) return

  const candidate = client as unknown as Record<string, unknown>
  const setPasswordFn = candidate.setPassword
  if (typeof setPasswordFn === "function") {
    await Promise.resolve((setPasswordFn as (value: string) => unknown)(commKey))
    return
  }

  if ("password" in candidate) {
    candidate.password = commKey
  }
}

const safeDisconnect = async (client: DeviceClient | null): Promise<void> => {
  if (!client?.disconnect) return
  try {
    await client.disconnect()
  } catch {
    // no-op
  }
}

const unwrapDeviceLogs = (payload: unknown): DeviceRawLog[] => {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is DeviceRawLog => isRecord(entry))
  }

  if (!isRecord(payload)) {
    return []
  }

  const candidates = ["data", "logs", "rows", "records", "items", "attendances"] as const
  for (const key of candidates) {
    const candidate = payload[key]
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is DeviceRawLog => isRecord(entry))
    }
  }

  return []
}

type DeviceConnectParams = {
  host: string
  port: number
  timeoutMs: number
  inport?: number | null
  commKey?: string | null
}

export type DeviceUserRecord = {
  uid?: string
  userId?: string
  name?: string
}

type DeviceUserLookupResult =
  | { ok: true; found: boolean; matchedUser?: DeviceUserRecord; totalUsers: number }
  | { ok: false; error: string }

type DeviceCommandSet = {
  CMD_STARTENROLL: number
  CMD_CANCELCAPTURE: number
}

const normalizeIdentifier = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const upper = trimmed.toUpperCase()
  if (/^\d+$/.test(upper)) {
    const withoutLeadingZeroes = upper.replace(/^0+(?=\d)/, "")
    return withoutLeadingZeroes || "0"
  }
  return upper
}

const toDeviceUserRecord = (value: unknown): DeviceUserRecord | null => {
  if (!isRecord(value)) return null
  const uid = firstText(value, ["uid"])
  const userId = firstText(value, ["userId", "userid", "employeeNumber", "acNo", "acno", "pin"])
  const name = firstText(value, ["name", "employeeName"])
  if (!uid && !userId) return null
  return { uid: uid || undefined, userId: userId || undefined, name: name || undefined }
}

const unwrapDeviceUsers = (payload: unknown): DeviceUserRecord[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => toDeviceUserRecord(entry))
      .filter((entry): entry is DeviceUserRecord => entry !== null)
  }

  if (!isRecord(payload)) {
    return []
  }

  const candidates = ["data", "users", "rows", "items"] as const
  for (const key of candidates) {
    const candidate = payload[key]
    if (!Array.isArray(candidate)) continue
    return candidate
      .map((entry) => toDeviceUserRecord(entry))
      .filter((entry): entry is DeviceUserRecord => entry !== null)
  }

  return []
}

const findMatchingDeviceUser = (users: DeviceUserRecord[], employeeNumber: string): DeviceUserRecord | null => {
  const target = normalizeIdentifier(employeeNumber)
  if (!target) return null

  for (const user of users) {
    const userIdCandidate = user.userId ? normalizeIdentifier(user.userId) : ""
    const uidCandidate = user.uid ? normalizeIdentifier(user.uid) : ""
    if (userIdCandidate && userIdCandidate === target) return user
    if (uidCandidate && uidCandidate === target) return user
  }

  return null
}

const loadDeviceUsers = async (
  params: DeviceConnectParams
): Promise<{ ok: true; users: DeviceUserRecord[] } | { ok: false; error: string }> => {
  const DeviceLibrary = await resolveDeviceLibraryConstructor()
  if (!DeviceLibrary) {
    return { ok: false, error: "Direct device sync driver is unavailable. Install `node-zklib` on the server." }
  }

  const safeInport = params.inport && params.inport > 0 ? params.inport : 5200
  let client: DeviceClient | null = null

  try {
    client = new DeviceLibrary(params.host, params.port, params.timeoutMs, safeInport)
    await applyCredential(client, params.commKey ?? undefined)
    await client.createSocket()

    if (typeof client.getUsers !== "function") {
      await safeDisconnect(client)
      return { ok: false, error: "Device driver does not support reading device users." }
    }

    const payload = await client.getUsers()
    await safeDisconnect(client)
    return { ok: true, users: unwrapDeviceUsers(payload) }
  } catch (error) {
    await safeDisconnect(client)
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to read users from ${params.host}:${String(params.port)}: ${error.message}`
          : `Unable to read users from ${params.host}:${String(params.port)}.`,
    }
  }
}

export async function listDeviceUsers(
  params: DeviceConnectParams
): Promise<{ ok: true; users: DeviceUserRecord[] } | { ok: false; error: string }> {
  return loadDeviceUsers(params)
}

const resolveDeviceCommandSet = async (): Promise<DeviceCommandSet> => {
  const dynamicImport = new Function(
    "moduleName",
    "return import(moduleName)"
  ) as (moduleName: string) => Promise<unknown>

  try {
    const moduleRaw = await dynamicImport("node-zklib/constants.js")
    if (!isRecord(moduleRaw)) {
      return { CMD_STARTENROLL: 61, CMD_CANCELCAPTURE: 62 }
    }

    const commandsCandidate = moduleRaw.COMMANDS
    if (!isRecord(commandsCandidate)) {
      return { CMD_STARTENROLL: 61, CMD_CANCELCAPTURE: 62 }
    }

    const startEnroll = Number(commandsCandidate.CMD_STARTENROLL)
    const cancelCapture = Number(commandsCandidate.CMD_CANCELCAPTURE)

    if (!Number.isFinite(startEnroll) || !Number.isFinite(cancelCapture)) {
      return { CMD_STARTENROLL: 61, CMD_CANCELCAPTURE: 62 }
    }

    return {
      CMD_STARTENROLL: startEnroll,
      CMD_CANCELCAPTURE: cancelCapture,
    }
  } catch {
    return { CMD_STARTENROLL: 61, CMD_CANCELCAPTURE: 62 }
  }
}

export async function testDeviceConnection(params: DeviceConnectParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const DeviceLibrary = await resolveDeviceLibraryConstructor()
  if (!DeviceLibrary) {
    return { ok: false, error: "Direct device sync driver is unavailable. Install `node-zklib` on the server." }
  }

  const safeInport = params.inport && params.inport > 0 ? params.inport : 5200

  let client: DeviceClient | null = null
  try {
    client = new DeviceLibrary(params.host, params.port, params.timeoutMs, safeInport)
    await applyCredential(client, params.commKey ?? undefined)
    await client.createSocket()
    await safeDisconnect(client)
    return { ok: true }
  } catch (error) {
    await safeDisconnect(client)
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to connect to ${params.host}:${String(params.port)}: ${error.message}`
          : `Unable to connect to ${params.host}:${String(params.port)}.`,
    }
  }
}

export async function pullDeviceAttendanceLogs(
  params: DeviceConnectParams
): Promise<{ ok: true; logs: DeviceRawLog[] } | { ok: false; error: string }> {
  const DeviceLibrary = await resolveDeviceLibraryConstructor()
  if (!DeviceLibrary) {
    return { ok: false, error: "Direct device sync driver is unavailable. Install `node-zklib` on the server." }
  }

  const safeInport = params.inport && params.inport > 0 ? params.inport : 5200

  let client: DeviceClient | null = null
  try {
    client = new DeviceLibrary(params.host, params.port, params.timeoutMs, safeInport)
    await applyCredential(client, params.commKey ?? undefined)
    await client.createSocket()
    const payload = await client.getAttendances()
    await safeDisconnect(client)

    const logs = unwrapDeviceLogs(payload)
    return { ok: true, logs }
  } catch (error) {
    await safeDisconnect(client)
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to pull logs from ${params.host}:${String(params.port)}: ${error.message}`
          : `Unable to pull logs from ${params.host}:${String(params.port)}.`,
    }
  }
}

export async function checkDeviceUserExists(
  params: DeviceConnectParams & { employeeNumber: string }
): Promise<DeviceUserLookupResult> {
  const loaded = await loadDeviceUsers(params)
  if (!loaded.ok) {
    return loaded
  }
  try {
    const users = loaded.users
    const matchedUser = findMatchingDeviceUser(users, params.employeeNumber)

    return {
      ok: true,
      found: matchedUser !== null,
      matchedUser: matchedUser ?? undefined,
      totalUsers: users.length,
    }
  } catch {
    return { ok: false, error: "Unable to match employee on device user list." }
  }
}

export async function startDeviceFingerprintEnrollment(
  params: DeviceConnectParams & { employeeNumber: string }
): Promise<{ ok: true; matchedUser?: DeviceUserRecord } | { ok: false; error: string }> {
  const DeviceLibrary = await resolveDeviceLibraryConstructor()
  if (!DeviceLibrary) {
    return { ok: false, error: "Direct device sync driver is unavailable. Install `node-zklib` on the server." }
  }

  const safeInport = params.inport && params.inport > 0 ? params.inport : 5200
  let client: DeviceClient | null = null

  try {
    client = new DeviceLibrary(params.host, params.port, params.timeoutMs, safeInport)
    await applyCredential(client, params.commKey ?? undefined)
    await client.createSocket()

    if (typeof client.executeCmd !== "function") {
      await safeDisconnect(client)
      return { ok: false, error: "Device driver does not support remote enrollment commands." }
    }

    let matchedUser: DeviceUserRecord | undefined
    if (typeof client.getUsers === "function") {
      try {
        const userPayload = await client.getUsers()
        const users = unwrapDeviceUsers(userPayload)
        const match = findMatchingDeviceUser(users, params.employeeNumber)
        if (!match) {
          await safeDisconnect(client)
          return { ok: false, error: `Employee number ${params.employeeNumber} was not found on the device user list.` }
        }
        matchedUser = match
      } catch {
        // continue with command attempts; some firmwares block getUsers but still accept enroll command
      }
    }

    const commands = await resolveDeviceCommandSet()
    const normalizedEmployeeNo = params.employeeNumber.trim()
    const numericEmployeeNo = Number(normalizedEmployeeNo)

    const commandPayloads: unknown[] = [
      `${normalizedEmployeeNo}\u0000`,
      normalizedEmployeeNo,
    ]

    if (Number.isInteger(numericEmployeeNo) && numericEmployeeNo >= 0) {
      const twoBytes = Buffer.alloc(2)
      twoBytes.writeUInt16LE(numericEmployeeNo % 65536, 0)
      commandPayloads.push(twoBytes)

      const fourBytes = Buffer.alloc(4)
      fourBytes.writeUInt32LE(numericEmployeeNo >>> 0, 0)
      commandPayloads.push(fourBytes)
    }

    let lastError: unknown = null
    let hasSuccess = false

    for (const payload of commandPayloads) {
      try {
        await client.executeCmd(commands.CMD_STARTENROLL, payload)
        hasSuccess = true
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!hasSuccess) {
      await safeDisconnect(client)
      const detail = lastError instanceof Error ? `: ${lastError.message}` : ""
      return { ok: false, error: `Device rejected remote enroll start command${detail}` }
    }

    await safeDisconnect(client)
    return { ok: true, matchedUser }
  } catch (error) {
    await safeDisconnect(client)
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to start enrollment on ${params.host}:${String(params.port)}: ${error.message}`
          : `Unable to start enrollment on ${params.host}:${String(params.port)}.`,
    }
  }
}

export async function cancelDeviceFingerprintEnrollment(
  params: DeviceConnectParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const DeviceLibrary = await resolveDeviceLibraryConstructor()
  if (!DeviceLibrary) {
    return { ok: false, error: "Direct device sync driver is unavailable. Install `node-zklib` on the server." }
  }

  const safeInport = params.inport && params.inport > 0 ? params.inport : 5200
  let client: DeviceClient | null = null

  try {
    client = new DeviceLibrary(params.host, params.port, params.timeoutMs, safeInport)
    await applyCredential(client, params.commKey ?? undefined)
    await client.createSocket()

    if (typeof client.executeCmd !== "function") {
      await safeDisconnect(client)
      return { ok: false, error: "Device driver does not support capture cancel command." }
    }

    const commands = await resolveDeviceCommandSet()
    await client.executeCmd(commands.CMD_CANCELCAPTURE, "")
    await safeDisconnect(client)
    return { ok: true }
  } catch (error) {
    await safeDisconnect(client)
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to cancel enrollment on ${params.host}:${String(params.port)}: ${error.message}`
          : `Unable to cancel enrollment on ${params.host}:${String(params.port)}.`,
    }
  }
}
