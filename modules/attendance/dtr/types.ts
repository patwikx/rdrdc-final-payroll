import type { AttendanceStatus } from "@prisma/client"

export type DtrLogItem = {
  id: string
  employeeId: string
  attendanceDate: string
  actualTimeIn: string | null
  actualTimeOut: string | null
  hoursWorked: number
  tardinessMins: number
  undertimeMins: number
  overtimeHours: number
  nightDiffHours: number
  attendanceStatus: AttendanceStatus
  approvalStatusCode: string
  remarks: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNumber: string
    photoUrl: string | null
  }
}

export type LeaveOverlayItem = {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  isHalfDay: boolean
  halfDayPeriod: string | null
  leaveType: {
    name: string
    code: string
    isPaid: boolean
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNumber: string
    photoUrl: string | null
  }
}

export type WorkbenchItem = {
  id: string
  employeeId: string
  employeeName: string
  date: string
  type:
    | "LEAVE_REQUEST"
    | "OT_REQUEST"
    | "MISSING_LOG"
    | "ABSENCE"
    | "ATTENDANCE_EXCEPTION"
    | "FOR_APPROVAL"
  status: "PENDING" | "ANOMALY"
  details: string
  referenceId?: string
  data?: DtrLogItem
}

export type WorkbenchStats = {
  pendingLeaves: number
  pendingOTs: number
  missingLogs: number
  absences: number
  readinessScore: number
}
