import { db } from "@/lib/db"
import {
  getActiveCompanyContext,
  type ActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  toEmployeePortalCapabilityOverrideEntries,
  resolveEmployeePortalCapabilityScopes,
  resolveEmployeePortalCapabilities,
  type EmployeePortalAccessSnapshot,
  type EmployeePortalCapability,
  type EmployeePortalCapabilityScopes,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

export type EmployeePortalCapabilityContext = {
  activeCompany: ActiveCompanyContext
  snapshot: EmployeePortalAccessSnapshot
  capabilities: Set<EmployeePortalCapability>
  capabilityScopes: EmployeePortalCapabilityScopes
}

export async function getEmployeePortalCapabilityContext(
  companyId: string
): Promise<EmployeePortalCapabilityContext> {
  const activeCompany = await getActiveCompanyContext({ companyId })
  const companyRole = activeCompany.companyRole as CompanyRole

  const [companyFeature, userRecord, activeCompanyAccess, employeeRecord, externalRequesterProfile, capabilityOverrides] = await Promise.all([
    db.company.findUnique({
      where: {
        id: activeCompany.companyId,
      },
      select: {
        enablePurchaseRequestWorkflow: true,
      },
    }),
    db.user.findUnique({
      where: {
        id: activeCompany.userId,
      },
      select: {
        isRequestApprover: true,
      },
    }),
    db.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: activeCompany.userId,
          companyId: activeCompany.companyId,
        },
      },
      select: {
        isActive: true,
        isMaterialRequestPurchaser: true,
        isMaterialRequestPoster: true,
        isPurchaseRequestItemManager: true,
      },
    }),
    db.employee.findFirst({
      where: {
        userId: activeCompany.userId,
        companyId: activeCompany.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
      db.externalRequesterProfile.findFirst({
        where: {
          userId: activeCompany.userId,
          companyId: activeCompany.companyId,
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
      db.employeePortalCapabilityOverride.findMany({
        where: {
          userId: activeCompany.userId,
          companyId: activeCompany.companyId,
        },
        select: {
          capability: true,
          accessScope: true,
        },
      }),
  ])

  const snapshot: EmployeePortalAccessSnapshot = {
    companyRole,
    purchaseRequestWorkflowEnabled: Boolean(companyFeature?.enablePurchaseRequestWorkflow),
    isRequestApprover: Boolean(userRecord?.isRequestApprover),
    isMaterialRequestPurchaser: Boolean(
      activeCompanyAccess?.isActive && activeCompanyAccess.isMaterialRequestPurchaser
    ),
    isMaterialRequestPoster: Boolean(
      activeCompanyAccess?.isActive && activeCompanyAccess.isMaterialRequestPoster
    ),
    isPurchaseRequestItemManager: Boolean(
      activeCompanyAccess?.isActive && activeCompanyAccess.isPurchaseRequestItemManager
    ),
    hasEmployeeProfile: Boolean(employeeRecord?.id || externalRequesterProfile?.id),
  }

  const normalizedOverrides = toEmployeePortalCapabilityOverrideEntries(capabilityOverrides)
  const capabilityScopes = resolveEmployeePortalCapabilityScopes(snapshot, normalizedOverrides)

  return {
    activeCompany,
    snapshot,
    capabilities: resolveEmployeePortalCapabilities(snapshot, normalizedOverrides),
    capabilityScopes,
  }
}
