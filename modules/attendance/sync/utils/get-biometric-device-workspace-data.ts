import { db } from "@/lib/db"
import type { DeviceCardItem } from "@/modules/attendance/sync/utils/device-sync-shared"
import { toDeviceCardItem } from "@/modules/attendance/sync/utils/device-sync-shared"

export type BiometricDeviceWorkspaceData = {
  devices: DeviceCardItem[]
  employees: Array<{
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
  }>
}

export async function getBiometricDeviceWorkspaceData(companyId: string): Promise<BiometricDeviceWorkspaceData> {
  const [devices, employees] = await Promise.all([
    db.biometricDevice.findMany({
      where: {
        companyId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
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
    }),
    db.employee.findMany({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
        employeeNumber: {
          notIn: ["admin", "T-123"],
        },
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { employeeNumber: "asc" }],
    }),
  ])

  return {
    devices: devices.map((device) => toDeviceCardItem(device)),
    employees,
  }
}
