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
  requestNumber: string
  overtimeDate: string
  hours: number
  reason: string | null
  statusCode: string
  employeeName: string
  employeeNumber: string
  ctoConversionPreview: boolean
}

export type EmployeePortalOvertimeApprovalHistoryRow = EmployeePortalOvertimeApprovalRow & {
  decidedAtIso: string
  decidedAtLabel: string
}

export type EmployeePortalOvertimeApprovalHistoryPage = {
  rows: EmployeePortalOvertimeApprovalHistoryRow[]
  total: number
  page: number
  pageSize: number
}
