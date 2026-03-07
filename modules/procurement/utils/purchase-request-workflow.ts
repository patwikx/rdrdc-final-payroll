import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

import { db } from "@/lib/db"

export const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

export const canManagePurchaseRequestItemCatalog = (params: {
  role: CompanyRole
  isPurchaseRequestItemManager: boolean
}): boolean => {
  return isHrRole(params.role) || params.isPurchaseRequestItemManager
}

export const getPurchaseRequestItemManagerFlag = async (params: {
  userId: string
  companyId: string
}): Promise<boolean> => {
  const access = await db.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: {
      isActive: true,
      isPurchaseRequestItemManager: true,
    },
  })

  return Boolean(access?.isActive && access.isPurchaseRequestItemManager)
}

export const getCompanyPurchaseRequestWorkflowEnabled = async (companyId: string): Promise<boolean> => {
  const company = await db.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      enablePurchaseRequestWorkflow: true,
    },
  })

  return Boolean(company?.enablePurchaseRequestWorkflow)
}
