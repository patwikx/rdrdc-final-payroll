import type {
  MaterialRequestStepStatus,
  MaterialRequestSeries,
  MaterialRequestType,
  PurchaseRequestItemSource,
  PurchaseRequestStatus,
} from "@prisma/client"

export type PurchaseRequestItemRow = {
  id: string
  lineNumber: number
  source: PurchaseRequestItemSource
  procurementItemId: string | null
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

export type PurchaseRequestApprovalStepRow = {
  id: string
  approvalCycle: number
  isCurrentCycle: boolean
  stepNumber: number
  stepName: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED"
  approverName: string
  actedByName: string | null
  actedAtLabel: string | null
  remarks: string | null
  turnaroundTimeLabel: string | null
}

export type PurchaseRequestRow = {
  id: string
  requestNumber: string
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  status: PurchaseRequestStatus
  requesterUserId: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterBranchName: string | null
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
  purpose: string | null
  remarks: string | null
  deliverTo: string | null
  isStoreUse: boolean
  freight: number
  discount: number
  subTotal: number
  grandTotal: number
  approvalCycle: number
  requiredSteps: number
  currentStep: number | null
  canActOnCurrentStep: boolean
  submittedAtLabel: string | null
  approvedAtLabel: string | null
  rejectedAtLabel: string | null
  cancelledAtLabel: string | null
  approvalLeadTimeLabel: string | null
  finalizationLeadTimeLabel: string | null
  pendingAgeLabel: string | null
  draftToSubmitLeadTimeLabel: string | null
  totalLifecycleLeadTimeLabel: string | null
  finalDecisionRemarks: string | null
  sentBackAtLabel: string | null
  sentBackReason: string | null
  sentBackByName: string | null
  hasUnreadSendBackNotice: boolean
  cancellationReason: string | null
  approvalSteps: PurchaseRequestApprovalStepRow[]
  items: PurchaseRequestItemRow[]
}

export type PurchaseRequestDepartmentOption = {
  id: string
  code: string
  name: string
  isActive: boolean
}

export type PurchaseRequestDepartmentFlowPreview = {
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

export type PurchaseRequestApprovalQueueRow = {
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

export type PurchaseRequestApprovalHistoryRow = {
  id: string
  companyId: string
  companyName: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  departmentName: string
  status: PurchaseRequestStatus
  datePreparedLabel: string
  dateRequiredLabel: string
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

export type PurchaseRequestApprovalHistoryPage = {
  rows: PurchaseRequestApprovalHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export type PurchaseRequestApprovalDecisionDetailItemRow = {
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

export type PurchaseRequestApprovalDecisionDetail = {
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
  items: PurchaseRequestApprovalDecisionDetailItemRow[]
}
