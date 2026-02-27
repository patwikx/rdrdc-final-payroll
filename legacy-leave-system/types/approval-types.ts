import { RequestStatus, RequestType, ApprovalStatus, ApproverType } from "@prisma/client"

export interface PendingApproval {
  id: string
  docNo: string
  series: string
  type: RequestType
  status: RequestStatus
  datePrepared: Date
  dateRequired: Date
  businessUnitId: string
  departmentId: string | null
  chargeTo: string | null
  purpose: string | null
  remarks: string | null
  deliverTo: string | null
  freight: number
  discount: number
  total: number
  confirmationNo: string | null
  requestedById: string
  recApproverId: string | null
  recApprovalDate: Date | null
  recApprovalStatus: ApprovalStatus | null
  finalApproverId: string | null
  finalApprovalDate: Date | null
  finalApprovalStatus: ApprovalStatus | null
  createdAt: Date
  updatedAt: Date
  
  // Relations
  items: {
    id: string
    itemCode: string | null
    description: string
    uom: string
    quantity: number
    unitPrice: number | null
    totalPrice: number | null
    remarks: string | null
  }[]
  businessUnit: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code: string
  } | null
  requestedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export interface ApprovalAction {
  requestId: string
  status: ApprovalStatus
  remarks?: string
}

export const APPROVAL_TYPE_LABELS: Record<ApproverType, string> = {
  RECOMMENDING: "Recommending Approval",
  FINAL: "Final Approval",
}

export const APPROVAL_ACTION_COLORS: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  DISAPPROVED: "bg-red-100 text-red-800",
}