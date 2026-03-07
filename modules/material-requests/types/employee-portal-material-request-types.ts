import type {
  MaterialRequestProcessingStatus,
  MaterialRequestPostingStatus,
  MaterialRequestItemSource,
  MaterialRequestSeries,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  MaterialRequestType,
} from "@prisma/client"

export type EmployeePortalMaterialRequestItemRow = {
  id: string
  lineNumber: number
  source: MaterialRequestItemSource
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

export type EmployeePortalMaterialRequestApprovalStepRow = {
  id: string
  stepNumber: number
  stepName: string | null
  status: MaterialRequestStepStatus
  approverName: string
  approverEmployeeNumber?: string | null
  actedByName: string | null
  actedAtLabel: string | null
  remarks: string | null
  turnaroundTimeLabel?: string | null
}

export type EmployeePortalMaterialRequestRow = {
  id: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  status: MaterialRequestStatus
  requesterName: string
  requesterEmployeeNumber: string
  departmentId: string
  departmentName: string
  selectedInitialApproverUserId: string | null
  selectedStepTwoApproverUserId: string | null
  selectedStepThreeApproverUserId: string | null
  selectedStepFourApproverUserId: string | null
  datePreparedLabel: string
  dateRequiredLabel: string
  datePreparedValue: string
  dateRequiredValue: string
  chargeTo: string | null
  bldgCode: string | null
  purpose: string | null
  remarks: string | null
  deliverTo: string | null
  isStoreUse: boolean
  freight: number
  discount: number
  subTotal: number
  grandTotal: number
  currentStep: number | null
  requiredSteps: number
  submittedAtLabel: string | null
  approvedAtLabel: string | null
  rejectedAtLabel: string | null
  cancelledAtLabel: string | null
  processingStatus: MaterialRequestProcessingStatus | null
  processingStartedAtLabel: string | null
  processingCompletedAtLabel: string | null
  processingRemarks: string | null
  processingPoNumber: string | null
  processingSupplierName: string | null
  requesterAcknowledgedAtLabel: string | null
  requesterAcknowledgedByName: string | null
  requiresReceiptAcknowledgment: boolean
  approvalLeadTimeLabel?: string | null
  purchaserQueueTimeLabel?: string | null
  purchaserProcessingTimeLabel?: string | null
  fulfillmentLeadTimeLabel?: string | null
  acknowledgmentLeadTimeLabel?: string | null
  receivingReportId: string | null
  receivingReportNumber: string | null
  receivingReportReceivedAtLabel: string | null
  finalDecisionRemarks: string | null
  cancellationReason: string | null
  items: EmployeePortalMaterialRequestItemRow[]
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}

export type EmployeePortalMaterialRequestDepartmentOption = {
  id: string
  companyId?: string
  code: string
  name: string
  isActive: boolean
  companyName?: string
}

export type EmployeePortalMaterialRequestDepartmentFlowPreview = {
  departmentId: string
  requiredSteps: number
  approversByStep: Array<{
    stepNumber: number
    stepName: string
    approvers: Array<{
      userId: string
      fullName: string
      email: string
    }>
  }>
}

export type EmployeePortalMaterialRequestApprovalQueueRow = {
  id: string
  companyId: string
  companyName: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentId: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  currentStep: number
  requiredSteps: number
  grandTotal: number
  submittedAtLabel: string | null
}

export type EmployeePortalMaterialRequestApprovalHistoryRow = {
  id: string
  companyId: string
  companyName: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentName: string
  status: MaterialRequestStatus
  datePreparedLabel: string
  dateRequiredLabel: string
  currentStep: number | null
  requiredSteps: number
  grandTotal: number
  submittedAtLabel: string | null
  actedAtIso: string
  actedAtLabel: string
  actedStepNumber: number | null
  actedStepName: string | null
  actedStepStatus: MaterialRequestStepStatus | null
  actedRemarks: string | null
  finalDecisionRemarks: string | null
}

export type EmployeePortalMaterialRequestApprovalHistoryPage = {
  rows: EmployeePortalMaterialRequestApprovalHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalMaterialRequestApprovalQueuePage = {
  rows: EmployeePortalMaterialRequestApprovalQueueRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalMaterialRequestApprovalReadModel = {
  rows: EmployeePortalMaterialRequestApprovalQueueRow[]
  queueTotal: number
  queuePage: number
  queuePageSize: number
  historyRows: EmployeePortalMaterialRequestApprovalHistoryRow[]
  historyTotal: number
  historyPage: number
  historyPageSize: number
}

export type EmployeePortalMaterialRequestApprovalDecisionDetailItemRow = {
  id: string
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

export type EmployeePortalMaterialRequestApprovalDecisionDetail = {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  currentStep: number
  requiredSteps: number
  datePreparedLabel: string
  dateRequiredLabel: string
  purpose: string | null
  grandTotal: number
  totalItems: number
  page: number
  pageSize: number
  items: EmployeePortalMaterialRequestApprovalDecisionDetailItemRow[]
}

export type EmployeePortalMaterialRequestApprovalHistoryDetail = {
  id: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  status: MaterialRequestStatus
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  submittedAtLabel: string | null
  approvedAtLabel: string | null
  rejectedAtLabel: string | null
  currentStep: number | null
  requiredSteps: number
  chargeTo: string | null
  bldgCode: string | null
  deliverTo: string | null
  isStoreUse: boolean
  subTotal: number
  freight: number
  discount: number
  grandTotal: number
  purpose: string | null
  remarks: string | null
  finalDecisionRemarks: string | null
  items: EmployeePortalMaterialRequestItemRow[]
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}

export type EmployeePortalMaterialRequestProcessingStatusFilter =
  | "OPEN"
  | "ALL"
  | "PENDING_PURCHASER"
  | "IN_PROGRESS"
  | "COMPLETED"

export type EmployeePortalMaterialRequestPostingStatusFilter = "ALL" | "PENDING_POSTING" | "POSTED"
export type EmployeePortalMaterialRequestReceivingReportStatusFilter =
  | "ALL"
  | "PENDING_POSTING"
  | "POSTED"

export type EmployeePortalMaterialRequestProcessingRow = {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  approvedAtLabel: string | null
  itemCount: number
  grandTotal: number
  processingStatus: MaterialRequestProcessingStatus
  processingStartedAtLabel: string | null
  processingCompletedAtLabel: string | null
  processedByName: string | null
  processingPoNumber: string | null
  processingSupplierName: string | null
  isPartiallyServed: boolean
  canMarkCompleted: boolean
}

export type EmployeePortalMaterialRequestProcessingPage = {
  rows: EmployeePortalMaterialRequestProcessingRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalMaterialRequestPostingRow = {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  processingCompletedAtLabel: string | null
  itemCount: number
  grandTotal: number
  postingStatus: "PENDING_POSTING" | "POSTED"
  postingReference: string | null
  postedAtLabel: string | null
  postedByName: string | null
}

export type EmployeePortalMaterialRequestPostingPage = {
  rows: EmployeePortalMaterialRequestPostingRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalMaterialRequestPostingDetail = {
  id: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  approvedAtLabel: string | null
  submittedAtLabel: string | null
  processingCompletedAtLabel: string | null
  postingStatus: "PENDING_POSTING" | "POSTED"
  postingReference: string | null
  postingRemarks: string | null
  postedAtLabel: string | null
  postedByName: string | null
  grandTotal: number
  items: Array<EmployeePortalMaterialRequestItemRow & {
    servedQuantity: number
    remainingQuantity: number
  }>
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}

export type EmployeePortalMaterialRequestReceivingReportItemRow = {
  id: string
  lineNumber: number
  itemCode: string | null
  description: string
  uom: string
  requestedQuantity: number
  receivedQuantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

export type EmployeePortalMaterialRequestReceivingReportRow = {
  id: string
  materialRequestId: string
  reportNumber: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  processingCompletedAtLabel: string | null
  receivedAtLabel: string
  receivedByName: string
  itemCount: number
  grandTotal: number
  postingStatus: MaterialRequestPostingStatus
  postingReference: string | null
  postedAtLabel: string | null
}

export type EmployeePortalMaterialRequestReceivingReportPage = {
  rows: EmployeePortalMaterialRequestReceivingReportRow[]
  total: number
  page: number
  pageSize: number
}

export type EmployeePortalMaterialRequestReceivingReportDetail = {
  id: string
  materialRequestId: string
  reportNumber: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  submittedAtLabel: string | null
  approvedAtLabel: string | null
  processingCompletedAtLabel: string | null
  requesterAcknowledgedAtLabel: string | null
  receivedAtLabel: string
  receivedByName: string
  remarks: string | null
  postingStatus: MaterialRequestPostingStatus
  postingReference: string | null
  postedAtLabel: string | null
  postedByName: string | null
  subTotal: number
  freight: number
  discount: number
  grandTotal: number
  purpose: string | null
  requestRemarks: string | null
  items: EmployeePortalMaterialRequestReceivingReportItemRow[]
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}

export type EmployeePortalMaterialRequestKpiRange = "LAST_30_DAYS" | "LAST_90_DAYS" | "LAST_180_DAYS" | "YTD" | "ALL"

export type EmployeePortalMaterialRequestKpiOverview = {
  totalSubmittedRequests: number
  completedRequests: number
  pendingApprovalRequests: number
  inProgressProcessingRequests: number
  avgApprovalLeadTimeMs: number | null
  avgPurchaserQueueTimeMs: number | null
  avgPurchaserProcessingTimeMs: number | null
  avgFulfillmentLeadTimeMs: number | null
  avgAcknowledgmentLeadTimeMs: number | null
  approvalSlaBreachCount: number
  queueSlaBreachCount: number
  processingSlaBreachCount: number
  fulfillmentSlaBreachCount: number
}

export type EmployeePortalMaterialRequestKpiPurchaserRow = {
  purchaserKey: string
  purchaserName: string
  requestCount: number
  completedCount: number
  avgQueueTimeMs: number | null
  avgProcessingTimeMs: number | null
  avgFulfillmentTimeMs: number | null
}

export type EmployeePortalMaterialRequestKpiDepartmentRow = {
  departmentId: string
  departmentName: string
  requestCount: number
  completedCount: number
  avgApprovalTimeMs: number | null
  avgQueueTimeMs: number | null
  avgProcessingTimeMs: number | null
  avgFulfillmentTimeMs: number | null
}

export type EmployeePortalMaterialRequestKpiMonthRow = {
  monthKey: string
  monthLabel: string
  requestCount: number
  approvedCount: number
  completedCount: number
  avgApprovalTimeMs: number | null
  avgProcessingTimeMs: number | null
  avgFulfillmentTimeMs: number | null
}

export type EmployeePortalMaterialRequestKpiApprovalStepRow = {
  stepNumber: number
  stepName: string
  actedCount: number
  avgTurnaroundTimeMs: number | null
}

export type EmployeePortalMaterialRequestKpiDashboard = {
  range: EmployeePortalMaterialRequestKpiRange
  startDateLabel: string | null
  endDateLabel: string
  slaTargetsHours: {
    approval: number
    queue: number
    processing: number
    fulfillment: number
  }
  overview: EmployeePortalMaterialRequestKpiOverview
  byPurchaser: EmployeePortalMaterialRequestKpiPurchaserRow[]
  byDepartment: EmployeePortalMaterialRequestKpiDepartmentRow[]
  byMonth: EmployeePortalMaterialRequestKpiMonthRow[]
  byApprovalStep: EmployeePortalMaterialRequestKpiApprovalStepRow[]
}

export type EmployeePortalMaterialRequestProcessingDetail = {
  id: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  datePreparedLabel: string
  dateRequiredLabel: string
  approvedAtLabel: string | null
  submittedAtLabel: string | null
  processingStatus: MaterialRequestProcessingStatus
  processingStartedAtLabel: string | null
  processingCompletedAtLabel: string | null
  processedByName: string | null
  processingRemarks: string | null
  processingPoNumber: string | null
  processingSupplierName: string | null
  subTotal: number
  freight: number
  discount: number
  grandTotal: number
  purpose: string | null
  remarks: string | null
  items: Array<EmployeePortalMaterialRequestItemRow & {
    servedQuantity: number
    remainingQuantity: number
  }>
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}
