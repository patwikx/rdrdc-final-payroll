import { MRSRequestStatus, RequestType, ApprovalStatus } from "@prisma/client"

export interface MaterialRequestItem {
  id: string
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  quantityServed?: { toNumber: () => number } | number | null
  unitPrice: number | null
  totalPrice: number | null
  remarks: string | null
  materialRequestId: string
  createdAt: Date
  updatedAt: Date
}

export interface MaterialRequest {
  id: string
  docNo: string
  series: string
  type: RequestType
  status: MRSRequestStatus
  datePrepared: Date
  dateRequired: Date
  dateReceived: Date | null
  dateApproved: Date | null
  datePosted: Date | null
  dateRevised: Date | null
  businessUnitId: string
  departmentId: string | null
  chargeTo: string | null
  bldgCode: string | null
  purpose: string | null
  remarks: string | null
  deliverTo: string | null
  freight: number
  discount: number
  total: number
  isStoreUse: boolean
  confirmationNo: string | null
  supplierBPCode: string | null
  supplierName: string | null
  purchaseOrderNumber: string | null
  processedBy: string | null
  processedAt: Date | null
  requestedById: string
  budgetApproverId: string | null
  budgetApprovalDate: Date | null
  budgetApprovalStatus: ApprovalStatus | null
  isWithinBudget: boolean | null
  budgetRemarks: string | null
  recApproverId: string | null
  recApprovalDate: Date | null
  recApprovalStatus: ApprovalStatus | null
  recApprovalRemarks: string | null
  finalApproverId: string | null
  finalApprovalDate: Date | null
  finalApprovalStatus: ApprovalStatus | null
  finalApprovalRemarks: string | null
  acknowledgedAt: Date | null
  acknowledgedById: string | null
  signatureData: string | null
  isMarkedForEdit: boolean
  markedForEditAt: Date | null
  markedForEditBy: string | null
  markedForEditReason: string | null
  editCompletedAt: Date | null
  editAcknowledgedAt: Date | null
  createdAt: Date
  updatedAt: Date
  
  // Relations
  items: MaterialRequestItem[]
  businessUnit: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code: string | null
    businessUnitId: string | null
    createdAt: Date
    updatedAt: Date
    isActive: boolean | null
    description: string | null
  } | null
  requestedBy: {
    id: string
    name: string
    email: string | null
    employeeId: string
    profilePicture?: string | null
  }
  budgetApprover: {
    id: string
    name: string
    email: string | null
    employeeId: string
  } | null
  recApprover: {
    id: string
    name: string
    email: string | null
    employeeId: string
  } | null
  finalApprover: {
    id: string
    name: string
    email: string | null
    employeeId: string
  } | null
  
  // Store Use Review Fields
  reviewerId: string | null
  reviewer: {
    id: string
    name: string
    email: string | null
    employeeId: string
  } | null
  reviewedAt: Date | null
  reviewStatus: ApprovalStatus | null
  reviewRemarks: string | null
}

export interface MaterialRequestFilters {
  status?: MRSRequestStatus
  businessUnitId?: string
  departmentId?: string
  requestedById?: string
  type?: RequestType
  search?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface MaterialRequestFormData {
  type: RequestType
  datePrepared: Date
  dateRequired: Date
  businessUnitId: string
  departmentId?: string
  chargeTo?: string
  purpose?: string
  remarks?: string
  deliverTo?: string
  freight: number
  discount: number
  items: MaterialRequestItem[]
}

export const REQUEST_STATUS_LABELS: Record<MRSRequestStatus, string> = {
  DRAFT: "Draft",
  FOR_REVIEW: "Pending Review",
  PENDING_BUDGET_APPROVAL: "Pending Budget Approval",
  FOR_REC_APPROVAL: "For Recommending Approval",
  REC_APPROVED: "Recommending Approved",
  FOR_FINAL_APPROVAL: "For Final Approval",
  FINAL_APPROVED: "Final Approved",
  FOR_POSTING: "For Posting",
  POSTED: "Posted",
  FOR_SERVING: "For Serving",
  SERVED: "Served",
  RECEIVED: "Done",
  ACKNOWLEDGED: "Acknowledged",
  DEPLOYED: "Deployed",
  TRANSMITTED: "Transmitted",
  CANCELLED: "Cancelled",
  DISAPPROVED: "Disapproved",
  FOR_EDIT: "For Edit",
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  ITEM: "Item",
  SERVICE: "Service",
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DISAPPROVED: "Disapproved",
}

export const REQUEST_STATUS_COLORS: Record<MRSRequestStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  FOR_REVIEW: "bg-sky-100 text-sky-800",
  PENDING_BUDGET_APPROVAL: "bg-pink-100 text-pink-800",
  FOR_REC_APPROVAL: "bg-yellow-100 text-yellow-800",
  REC_APPROVED: "bg-blue-100 text-blue-800",
  FOR_FINAL_APPROVAL: "bg-orange-100 text-orange-800",
  FINAL_APPROVED: "bg-green-100 text-green-800",
  FOR_POSTING: "bg-purple-100 text-purple-800",
  POSTED: "bg-indigo-100 text-indigo-800",
  FOR_SERVING: "bg-violet-100 text-violet-800",
  SERVED: "bg-fuchsia-100 text-fuchsia-800",
  RECEIVED: "bg-teal-100 text-teal-800",
  ACKNOWLEDGED: "bg-emerald-100 text-emerald-800",
  DEPLOYED: "bg-violet-100 text-violet-800",
  TRANSMITTED: "bg-cyan-100 text-cyan-800",
  CANCELLED: "bg-red-100 text-red-800",
  DISAPPROVED: "bg-red-100 text-red-800",
  FOR_EDIT: "bg-amber-100 text-amber-800",
}