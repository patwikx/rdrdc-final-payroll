import type { AccessScope, CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type { EmployeePortalCapability } from "@/modules/employee-portal/utils/employee-portal-access-policy"
import { db } from "@/lib/db"
import type { UserAccessCompanyOption } from "@/modules/employees/user-access/utils/get-user-access-preview-data"

export type UserAccessDetailData = {
  companyId: string
  companyName: string
  purchaseRequestWorkflowEnabled: boolean
  companyOptions: UserAccessCompanyOption[]
  employee: {
    id: string
    employeeNumber: string
    fullName: string
    firstName: string
    lastName: string
    photoUrl: string | null
    department: string | null
    position: string | null
    linkedUser: {
      id: string
      username: string
      isActive: boolean
      isRequestApprover: boolean
      companyAccesses: Array<{
        companyId: string
        companyCode: string
        companyName: string
        role: CompanyRole
        enablePurchaseRequestWorkflow: boolean
        isDefault: boolean
        isMaterialRequestPurchaser: boolean
        isMaterialRequestPoster: boolean
        isPurchaseRequestItemManager: boolean
      }>
      portalCapabilityOverrides: Array<{
        companyId: string
        capability: EmployeePortalCapability
        accessScope: AccessScope
      }>
    } | null
  }
}

export async function getUserAccessDetailData(
  companyId: string,
  employeeId: string
): Promise<UserAccessDetailData | null> {
  const [company, employee, companyOptions] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        enablePurchaseRequestWorkflow: true,
      },
    }),
    db.employee.findFirst({
      where: {
        id: employeeId,
        OR: [
          {
            companyId,
          },
          {
            user: {
              companyAccess: {
                some: {
                  companyId,
                  isActive: true,
                  company: {
                    isActive: true,
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        department: {
          select: {
            name: true,
          },
        },
        position: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            isRequestApprover: true,
            companyAccess: {
              where: {
                isActive: true,
                company: {
                  isActive: true,
                },
              },
              orderBy: [{ isDefault: "desc" }, { company: { name: "asc" } }],
              select: {
                companyId: true,
                role: true,
                isDefault: true,
                isMaterialRequestPurchaser: true,
                isMaterialRequestPoster: true,
                isPurchaseRequestItemManager: true,
                company: {
                  select: {
                    code: true,
                    name: true,
                    enablePurchaseRequestWorkflow: true,
                  },
                },
              },
            },
            employeePortalCapabilityOverrides: {
              orderBy: [{ companyId: "asc" }, { capability: "asc" }],
              select: {
                companyId: true,
                capability: true,
                accessScope: true,
              },
            },
          },
        },
      },
    }),
    db.company.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        enablePurchaseRequestWorkflow: true,
      },
    }),
  ])

  if (!company || !employee) {
    return null
  }

  return {
    companyId: company.id,
    companyName: company.name,
    purchaseRequestWorkflowEnabled: Boolean(company.enablePurchaseRequestWorkflow),
    companyOptions: companyOptions.map((option) => ({
      companyId: option.id,
      companyCode: option.code,
      companyName: option.name,
      enablePurchaseRequestWorkflow: Boolean(option.enablePurchaseRequestWorkflow),
    })),
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: `${employee.lastName}, ${employee.firstName}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      photoUrl: employee.photoUrl ?? null,
      department: employee.department?.name ?? null,
      position: employee.position?.name ?? null,
      linkedUser: employee.user
        ? {
            id: employee.user.id,
            username: employee.user.username,
            isActive: employee.user.isActive,
            isRequestApprover: employee.user.isRequestApprover,
            companyAccesses: employee.user.companyAccess.map((access) => ({
              companyId: access.companyId,
              companyCode: access.company.code,
              companyName: access.company.name,
              role: access.role as CompanyRole,
              enablePurchaseRequestWorkflow: Boolean(access.company.enablePurchaseRequestWorkflow),
              isDefault: access.isDefault,
              isMaterialRequestPurchaser: access.isMaterialRequestPurchaser,
              isMaterialRequestPoster: access.isMaterialRequestPoster,
              isPurchaseRequestItemManager: access.isPurchaseRequestItemManager,
            })),
            portalCapabilityOverrides: employee.user.employeePortalCapabilityOverrides.map(
              (override) => ({
                companyId: override.companyId,
                capability: override.capability as EmployeePortalCapability,
                accessScope: override.accessScope as AccessScope,
              })
            ),
          }
        : null,
    },
  }
}
