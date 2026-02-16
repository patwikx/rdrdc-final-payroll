import type { BiometricDevice, BiometricSyncStatus } from "@prisma/client"

export type DeviceCardItem = {
  id: string
  code: string
  name: string
  deviceModel: string
  ipAddress: string
  port: number
  timeoutMs: number
  inport: number | null
  locationName: string | null
  isOnline: boolean
  lastOnlineAt: string | null
  lastSyncAt: string | null
  lastSyncStatus: BiometricSyncStatus | null
  lastSyncRecordCount: number
  hasSavedCredential: boolean
}

export const toDeviceCardItem = (
  device: Pick<
    BiometricDevice,
    | "id"
    | "code"
    | "name"
    | "deviceModel"
    | "ipAddress"
    | "port"
    | "timeout"
    | "inport"
    | "locationName"
    | "isOnline"
    | "lastOnlineAt"
    | "lastSyncAt"
    | "lastSyncStatus"
    | "lastSyncRecordCount"
    | "password"
  >
): DeviceCardItem => {
  return {
    id: device.id,
    code: device.code,
    name: device.name,
    deviceModel: device.deviceModel,
    ipAddress: device.ipAddress,
    port: device.port,
    timeoutMs: device.timeout,
    inport: device.inport,
    locationName: device.locationName,
    isOnline: device.isOnline,
    lastOnlineAt: device.lastOnlineAt ? device.lastOnlineAt.toISOString() : null,
    lastSyncAt: device.lastSyncAt ? device.lastSyncAt.toISOString() : null,
    lastSyncStatus: device.lastSyncStatus as BiometricSyncStatus | null,
    lastSyncRecordCount: device.lastSyncRecordCount,
    hasSavedCredential: Boolean(device.password),
  }
}
