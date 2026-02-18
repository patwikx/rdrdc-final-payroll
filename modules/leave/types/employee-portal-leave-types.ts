export type EmployeePortalLeaveRequestRow = {
  id: string
  requestNumber: string
  leaveTypeId: string
  isHalfDay: boolean
  halfDayPeriod: string | null
  startDate: string
  startDateInput: string
  endDate: string
  endDateInput: string
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

export type EmployeePortalLeaveApprovalRow = {
  id: string
  requestNumber: string
  startDate: string
  endDate: string
  numberOfDays: number
  reason: string | null
  statusCode: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  departmentId: string | null
  departmentName: string
  leaveTypeName: string
}

export type EmployeePortalLeaveApprovalHistoryRow = EmployeePortalLeaveApprovalRow & {
  decidedAtIso: string
  decidedAtLabel: string
}

export type EmployeePortalLeaveApprovalHistoryPage = {
  rows: EmployeePortalLeaveApprovalHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalLeaveApprovalDepartmentOption = {
  id: string
  name: string
  isActive: boolean
}
