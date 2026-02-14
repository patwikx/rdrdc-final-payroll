import type {
  MaterialRequestProcessingStatus,
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
  actedByName: string | null
  actedAtLabel: string | null
  remarks: string | null
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
  finalDecisionRemarks: string | null
  cancellationReason: string | null
  items: EmployeePortalMaterialRequestItemRow[]
  approvalSteps: EmployeePortalMaterialRequestApprovalStepRow[]
}

export type EmployeePortalMaterialRequestDepartmentOption = {
  id: string
  code: string
  name: string
  isActive: boolean
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
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
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
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
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

export type EmployeePortalMaterialRequestApprovalReadModel = {
  rows: EmployeePortalMaterialRequestApprovalQueueRow[]
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
  | "ALL"
  | "PENDING_PURCHASER"
  | "IN_PROGRESS"
  | "COMPLETED"

export type EmployeePortalMaterialRequestPostingStatusFilter = "ALL" | "PENDING_POSTING" | "POSTED"

export type EmployeePortalMaterialRequestProcessingRow = {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
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
