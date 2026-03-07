import type { AccessScope, CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { EmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"
import { db } from "@/lib/db"

export type StandaloneUserAccessFormData = {
  companyId: string
  companyName: string
  purchaseRequestWorkflowEnabled: boolean
  branchOptions: Array<{
    id: string
    code: string
    name: string
  }>
  user: {
    id: string
    username: string
    firstName: string
    lastName: string
    isActive: boolean
    isRequestApprover: boolean
    companyRole: CompanyRole
    isMaterialRequestPurchaser: boolean
    isMaterialRequestPoster: boolean
    isPurchaseRequestItemManager: boolean
    hasExternalRequesterProfile: boolean
    externalRequesterCode: string | null
    externalRequesterBranchId: string | null
    externalRequesterBranchName: string | null
    linkedEmployeeId: string | null
    portalCapabilityOverrides: Array<{
      capability: EmployeePortalCapability
      accessScope: AccessScope
    }>
  }
}

export type StandaloneUserAccessDetailData = StandaloneUserAccessFormData

export async function getStandaloneUserAccessDetailData(
  companyId: string,
  userId: string
): Promise<StandaloneUserAccessDetailData | null> {
  const [company, companyAccess, branches] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        enablePurchaseRequestWorkflow: true,
      },
    }),
    db.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
      select: {
        role: true,
        isMaterialRequestPurchaser: true,
        isMaterialRequestPoster: true,
        isPurchaseRequestItemManager: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isRequestApprover: true,
            employee: {
              select: {
                id: true,
              },
            },
            externalRequesterProfiles: {
              where: {
                companyId,
              },
              orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
            select: {
              requesterCode: true,
              isActive: true,
              branchId: true,
              branch: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
            take: 1,
          },
            employeePortalCapabilityOverrides: {
              where: {
                companyId,
              },
              orderBy: [{ capability: "asc" }],
              select: {
                capability: true,
                accessScope: true,
              },
            },
          },
        },
      },
    }),
    db.branch.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
  ])

  if (!company || !companyAccess) {
    return null
  }

  return {
    companyId: company.id,
    companyName: company.name,
    purchaseRequestWorkflowEnabled: Boolean(company.enablePurchaseRequestWorkflow),
    branchOptions: branches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
    })),
    user: {
      id: companyAccess.user.id,
      username: companyAccess.user.username,
      firstName: companyAccess.user.firstName,
      lastName: companyAccess.user.lastName,
      isActive: companyAccess.user.isActive,
      isRequestApprover: companyAccess.user.isRequestApprover,
      companyRole: companyAccess.role as CompanyRole,
      isMaterialRequestPurchaser: companyAccess.isMaterialRequestPurchaser,
      isMaterialRequestPoster: companyAccess.isMaterialRequestPoster,
      isPurchaseRequestItemManager: companyAccess.isPurchaseRequestItemManager,
      hasExternalRequesterProfile: Boolean(companyAccess.user.externalRequesterProfiles[0]?.isActive),
      externalRequesterCode: companyAccess.user.externalRequesterProfiles[0]?.requesterCode ?? null,
      externalRequesterBranchId: companyAccess.user.externalRequesterProfiles[0]?.branchId ?? null,
      externalRequesterBranchName: companyAccess.user.externalRequesterProfiles[0]?.branch
        ? companyAccess.user.externalRequesterProfiles[0].branch.code
          ? `${companyAccess.user.externalRequesterProfiles[0].branch.code} - ${companyAccess.user.externalRequesterProfiles[0].branch.name}`
          : companyAccess.user.externalRequesterProfiles[0].branch.name
        : null,
      linkedEmployeeId: companyAccess.user.employee?.id ?? null,
      portalCapabilityOverrides: companyAccess.user.employeePortalCapabilityOverrides.map((override) => ({
        capability: override.capability as EmployeePortalCapability,
        accessScope: override.accessScope as AccessScope,
      })),
    },
  }
}
