export type EmployeePortalOvertimeRequestRow = {
  id: string
  requestNumber: string
  overtimeDate: string
  overtimeDateInput: string
  startTime: string
  endTime: string
  hours: number
  reason: string | null
  statusCode: string
  supervisorApproverName: string | null
  supervisorApprovedAt: string | null
  supervisorApprovalRemarks: string | null
  hrApproverName: string | null
  hrApprovedAt: string | null
  hrApprovalRemarks: string | null
  hrRejectedAt: string | null
  hrRejectionReason: string | null
}

export type EmployeePortalOvertimeApprovalRow = {
  id: string
  companyId: string
  companyName: string
  requestNumber: string
  overtimeDate: string
  hours: number
  reason: string | null
  statusCode: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  departmentId: string | null
  departmentName: string
  ctoConversionPreview: boolean
}

export type EmployeePortalOvertimeApprovalHistoryRow = EmployeePortalOvertimeApprovalRow & {
  decidedAtIso: string
  decidedAtLabel: string
}

export type EmployeePortalOvertimeApprovalQueuePage = {
  rows: EmployeePortalOvertimeApprovalRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalOvertimeApprovalHistoryPage = {
  rows: EmployeePortalOvertimeApprovalHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalOvertimeApprovalTrailStep = {
  id: string
  stageLabel: string
  approverName: string | null
  statusCode: "APPROVED" | "REJECTED" | "PENDING" | "NOT_REACHED"
  actedAtLabel: string | null
  remarks: string | null
}

export type EmployeePortalOvertimeApprovalHistoryDetail = {
  id: string
  requestNumber: string
  statusCode: string
  overtimeDateLabel: string
  hours: number
  reason: string | null
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  departmentName: string
  ctoConversionPreview: boolean
  decidedAtLabel: string
  approvalTrail: EmployeePortalOvertimeApprovalTrailStep[]
}

export type EmployeePortalOvertimeApprovalDepartmentOption = {
  id: string
  companyId: string
  name: string
  isActive: boolean
}
