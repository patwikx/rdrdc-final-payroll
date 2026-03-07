import { db } from "@/lib/db"
import type { StandaloneUserAccessFormData } from "@/modules/employees/user-access/utils/get-standalone-user-access-detail-data"

export async function getStandaloneUserAccessCreateData(
  companyId: string
): Promise<StandaloneUserAccessFormData | null> {
  const [company, branches] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        enablePurchaseRequestWorkflow: true,
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

  if (!company) {
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
      id: "",
      username: "",
      firstName: "",
      lastName: "",
      isActive: true,
      isRequestApprover: false,
      companyRole: "EMPLOYEE",
      isMaterialRequestPurchaser: false,
      isMaterialRequestPoster: false,
      isPurchaseRequestItemManager: false,
      hasExternalRequesterProfile: false,
      externalRequesterCode: null,
      externalRequesterBranchId: null,
      externalRequesterBranchName: null,
      linkedEmployeeId: null,
      portalCapabilityOverrides: [],
    },
  }
}
