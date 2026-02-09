export type LeaveBalanceWorkspaceRow = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  photoUrl: string | null
  departmentName: string
  leaveTypeName: string
  currentBalance: number
  availableBalance: number
  pendingRequests: number
}

export type LeaveBalanceWorkspaceHistoryRow = {
  id: string
  employeeId: string
  requestNumber: string
  leaveTypeName: string
  statusCode: string
  numberOfDays: number
  startDateIso: string
  endDateIso: string
  createdAtIso: string
}

export type LeaveBalanceSummaryReportEmployeeRow = {
  employeeNumber: string
  employeeName: string
  departmentName: string
  leaveBalances: Record<string, number>
}

export type LeaveOverlayRecord = {
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
