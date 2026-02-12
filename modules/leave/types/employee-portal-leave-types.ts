export type EmployeePortalLeaveRequestRow = {
  id: string
  requestNumber: string
  isHalfDay: boolean
  halfDayPeriod: string | null
  startDate: string
  endDate: string
  numberOfDays: number
  reason: string | null
  statusCode: string
  leaveTypeName: string
  supervisorApproverName: string | null
  supervisorApprovedAt: string | null
  supervisorApprovalRemarks: string | null
  hrApproverName: string | null
  hrApprovedAt: string | null
  hrApprovalRemarks: string | null
  hrRejectedAt: string | null
  hrRejectionReason: string | null
  approverName: string | null
  rejectionReason: string | null
}

export type EmployeePortalLeaveTypeOption = {
  id: string
  code: string
  name: string
  isPaid: boolean
  requiresApproval: boolean
}

export type EmployeePortalLeaveBalanceItem = {
  id: string
  leaveTypeId: string
  leaveTypeName: string
  currentBalance: number
  availableBalance: number
  creditsEarned: number
  creditsUsed: number
}

export type EmployeePortalLeaveRequestsReadModel = {
  leaveTypes: EmployeePortalLeaveTypeOption[]
  leaveBalances: EmployeePortalLeaveBalanceItem[]
  requests: EmployeePortalLeaveRequestRow[]
}

export type EmployeePortalLeaveDashboardBalanceCard = {
  id: string
  leaveTypeName: string
  availableBalance: number
}

export type EmployeePortalLeaveDashboardReadModel = {
  pendingLeaveRequests: number
  leaveBalances: EmployeePortalLeaveDashboardBalanceCard[]
}
