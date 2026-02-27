// Import types from Prisma Client
import type { 
  DamageType, 
  DamageSeverity, 
  RecoveryStatus, 
  RecoveryMethod, 
  CompensationStatus, 
  DamagedInventoryStatus 
} from "@prisma/client"

// Re-export for convenience
export type {
  DamageType,
  DamageSeverity,
  RecoveryStatus,
  RecoveryMethod,
  CompensationStatus,
  DamagedInventoryStatus
}

export interface DamagedInventoryItem {
  id: string
  damagedInventoryId: string
  itemCode: string | null
  description: string
  quantity: number
  uom: string
  unitAcquisitionCost: number
  totalAcquisitionCost: number
  unitRecoveredPrice: number | null
  totalRecoveredAmount: number
  unitLossAmount: number
  totalLossAmount: number
  damageCondition: string | null
  isServiceable: boolean
  estimatedRecoveryValue: number | null
  soldQuantity: number | null
  saleDate: Date | null
  saleNotes: string | null
  remarks: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DamagedInventory {
  id: string
  damageNumber: string
  businessUnitId: string
  departmentId: string | null
  damageType: DamageType
  damageDate: Date
  discoveredDate: Date
  location: string | null
  damageSeverity: DamageSeverity
  tenantName: string | null
  tenantContact: string | null
  responsibleParty: string | null
  totalAcquisitionCost: number
  totalRecoveredAmount: number
  totalLossAmount: number
  compensationClaimed: number | null
  compensationReceived: number | null
  compensationStatus: CompensationStatus
  compensationDate: Date | null
  paymentMethod: string | null
  receiptNumber: string | null
  recoveryStatus: RecoveryStatus
  assessmentDate: Date | null
  assessedBy: string | null
  recoveryMethod: RecoveryMethod | null
  saleDate: Date | null
  soldTo: string | null
  soldToContact: string | null
  incidentReport: string | null
  assessmentNotes: string | null
  remarks: string | null
  attachments: string[]
  reportedById: string
  reviewedById: string | null
  reviewedAt: Date | null
  approvedById: string | null
  approvedAt: Date | null
  status: DamagedInventoryStatus
  createdAt: Date
  updatedAt: Date
  
  // Relations
  items: DamagedInventoryItem[]
  businessUnit: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code: string | null
  } | null
  reportedBy: {
    id: string
    name: string
    employeeId: string
    email: string | null
  }
  reviewedBy: {
    id: string
    name: string
    employeeId: string
    email: string | null
  } | null
  approvedBy: {
    id: string
    name: string
    employeeId: string
    email: string | null
  } | null
  assessor: {
    id: string
    name: string
    employeeId: string
    email: string | null
  } | null
}

// Status labels for UI
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  WATER_DAMAGE: "Water Damage",
  FIRE_DAMAGE: "Fire Damage",
  PHYSICAL_DAMAGE: "Physical Damage",
  NATURAL_DISASTER: "Natural Disaster",
  ACCIDENT: "Accident",
  WEAR_AND_TEAR: "Wear and Tear",
  OTHER: "Other"
}

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  MINOR: "Minor",
  MODERATE: "Moderate",
  SEVERE: "Severe",
  TOTAL_LOSS: "Total Loss"
}

export const RECOVERY_STATUS_LABELS: Record<RecoveryStatus, string> = {
  PENDING_ASSESSMENT: "Pending Assessment",
  ASSESSED: "Assessed",
  LISTED_FOR_SALE: "Listed for Sale",
  PARTIALLY_SOLD: "Partially Sold",
  FULLY_SOLD: "Fully Sold",
  SCRAPPED: "Scrapped",
  DISPOSED: "Disposed"
}

export const RECOVERY_METHOD_LABELS: Record<RecoveryMethod, string> = {
  SOLD_AS_IS: "Sold As-Is",
  REPAIRED_THEN_SOLD: "Repaired Then Sold",
  SOLD_FOR_PARTS: "Sold for Parts",
  SCRAPPED: "Scrapped",
  DISPOSED: "Disposed",
  DONATED: "Donated"
}

export const COMPENSATION_STATUS_LABELS: Record<CompensationStatus, string> = {
  PENDING: "Pending",
  CLAIMED: "Claimed",
  PARTIAL: "Partial",
  FULL: "Full",
  WAIVED: "Waived",
  DISPUTED: "Disputed"
}

export const DAMAGED_INVENTORY_STATUS_LABELS: Record<DamagedInventoryStatus, string> = {
  REPORTED: "Reported",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  RECOVERY_IN_PROGRESS: "Recovery in Progress",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
  DISPUTED: "Disputed"
}

// Status colors for badges
export const DAMAGED_INVENTORY_STATUS_COLORS: Record<DamagedInventoryStatus, string> = {
  REPORTED: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300",
  APPROVED: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300",
  RECOVERY_IN_PROGRESS: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
  RECOVERED: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300",
  DISPUTED: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
}

export const RECOVERY_STATUS_COLORS: Record<RecoveryStatus, string> = {
  PENDING_ASSESSMENT: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-950 dark:text-gray-300",
  ASSESSED: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
  LISTED_FOR_SALE: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
  PARTIALLY_SOLD: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300",
  FULLY_SOLD: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300",
  SCRAPPED: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300",
  DISPOSED: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
}
