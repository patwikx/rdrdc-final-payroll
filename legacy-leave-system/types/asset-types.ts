import { DeploymentStatus, AssetStatus } from "@prisma/client"

export interface AssetCategory {
  id: string
  name: string
  code: string
}

export interface Asset {
  id: string
  itemCode: string
  description: string
  serialNumber: string | null
  modelNumber: string | null
  brand: string | null
  status: AssetStatus
  category: AssetCategory
}

export interface AssetDeployment {
  id: string
  transmittalNumber: string
  deployedDate: Date | null
  expectedReturnDate: Date | null
  returnedDate: Date | null
  status: DeploymentStatus
  deploymentNotes: string | null
  returnNotes: string | null
  deploymentCondition: string | null
  returnCondition: string | null
  asset: Asset
}

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  PENDING_ACCOUNTING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  DEPLOYED: "Deployed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
}

export const DEPLOYMENT_STATUS_COLORS: Record<DeploymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING_ACCOUNTING_APPROVAL: "outline",
  APPROVED: "secondary",
  DEPLOYED: "default",
  RETURNED: "outline",
  CANCELLED: "destructive",
}