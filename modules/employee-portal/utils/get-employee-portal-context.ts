import { auth } from "@/auth"
import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  RequestStatus,
} from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext, getUserCompanyOptions } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getEmployeePortalCapabilities,
  resolveEmployeePortalCapabilityScopes,
  toEmployeePortalCapabilityOverrideEntries,
  type EmployeePortalAccessSnapshot,
  type EmployeePortalCapabilityScopes,
  type EmployeePortalCapability,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"

export type EmployeePortalContext = {
  userId: string
  companyId: string
  companyName: string
  companyRole: CompanyRole
  capabilities: EmployeePortalCapability[]
  capabilityScopes: EmployeePortalCapabilityScopes
  accessSnapshot: EmployeePortalAccessSnapshot
  purchaseRequestWorkflowEnabled: boolean
  requesterBranchName: string | null
  user: {
    firstName: string
    lastName: string
    username: string
  } | null
  isRequestApprover: boolean
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  companies: Awaited<ReturnType<typeof getUserCompanyOptions>>
  employee: {
    id: string
    employeeNumber: string
    photoUrl: string | null
    firstName: string
    lastName: string
    branch: { name: string } | null
    hireDate: Date
    regularizationDate: Date | null
    department: { name: string } | null
    position: { name: string } | null
    employmentStatus: { name: string } | null
    employmentType: { name: string } | null
    user: {
      username: string
      isRequestApprover: boolean
      isMaterialRequestPurchaser: boolean
      isMaterialRequestPoster: boolean
    } | null
  } | null
  taskCounts: {
    leaveApprovalPending: number
    overtimeApprovalPending: number
    materialRequestApprovalPending: number
    materialRequestProcessingPending: number
    materialRequestPostingPending: number
    purchaseRequestApprovalPending: number
    purchaseOrderPending: number
  }
}

export async function getEmployeePortalContext(companyId: string): Promise<EmployeePortalContext | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const [activeCompany, companies] = await Promise.all([
    getActiveCompanyContext({ companyId }),
    getUserCompanyOptions(session.user.id),
  ])

  const [employeeRecord, externalRequesterProfile, userRecord, activeCompanyAccess, companyFeature, capabilityOverrides] = await Promise.all([
    db.employee.findFirst({
      where: {
        userId: session.user.id,
        companyId: activeCompany.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        employeeNumber: true,
        photoUrl: true,
        firstName: true,
        lastName: true,
        branch: { select: { name: true } },
        hireDate: true,
        regularizationDate: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        employmentStatus: { select: { name: true } },
        employmentType: { select: { name: true } },
        user: {
          select: {
            username: true,
          },
        },
      },
    }),
      db.externalRequesterProfile.findFirst({
        where: {
          userId: session.user.id,
          companyId: activeCompany.companyId,
          isActive: true,
        },
        select: {
          id: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        isRequestApprover: true,
      },
    }),
    db.userCompanyAccess.findFirst({
      where: {
        userId: session.user.id,
        companyId: activeCompany.companyId,
        isActive: true,
      },
      select: {
        isMaterialRequestPurchaser: true,
        isMaterialRequestPoster: true,
        isPurchaseRequestItemManager: true,
      },
    }),
    db.company.findUnique({
      where: {
        id: activeCompany.companyId,
      },
      select: {
        enablePurchaseRequestWorkflow: true,
      },
    }),
    db.employeePortalCapabilityOverride.findMany({
      where: {
        userId: session.user.id,
        companyId: activeCompany.companyId,
      },
      select: {
        capability: true,
        accessScope: true,
      },
    }),
  ])

  const isRequestApprover = Boolean(userRecord?.isRequestApprover)
  const isMaterialRequestPurchaser = Boolean(activeCompanyAccess?.isMaterialRequestPurchaser)
  const isMaterialRequestPoster = Boolean(activeCompanyAccess?.isMaterialRequestPoster)
  const isPurchaseRequestItemManager = Boolean(activeCompanyAccess?.isPurchaseRequestItemManager)

  const employee = employeeRecord
    ? {
        ...employeeRecord,
        user: employeeRecord.user
          ? {
              username: employeeRecord.user.username,
              isRequestApprover,
              isMaterialRequestPurchaser,
              isMaterialRequestPoster,
            }
          : null,
      }
    : null

  const companyRole = activeCompany.companyRole as CompanyRole
  const isHR = companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || companyRole === "PAYROLL_ADMIN"
  const purchaseRequestWorkflowEnabled = Boolean(companyFeature?.enablePurchaseRequestWorkflow)
  const canApprove = isHR || isRequestApprover
  const canProcess = isHR || isMaterialRequestPurchaser
  const canPost = isHR || isMaterialRequestPoster
  const canManagePurchaseOrders = purchaseRequestWorkflowEnabled && (isHR || isMaterialRequestPurchaser)
  const accessibleCompanyIds = companies.map((company) => company.companyId)
  const accessSnapshot: EmployeePortalAccessSnapshot = {
    companyRole,
    purchaseRequestWorkflowEnabled,
    isRequestApprover,
    isMaterialRequestPurchaser,
    isMaterialRequestPoster,
    isPurchaseRequestItemManager,
    hasEmployeeProfile: Boolean(employeeRecord?.id || externalRequesterProfile?.id),
  }
  const normalizedOverrides = toEmployeePortalCapabilityOverrideEntries(capabilityOverrides)
  const capabilities = getEmployeePortalCapabilities(accessSnapshot, normalizedOverrides)
  const capabilityScopes = resolveEmployeePortalCapabilityScopes(accessSnapshot, normalizedOverrides)

  const [
    leaveApprovalPending,
    overtimeApprovalPending,
    materialRequestApprovalPending,
    materialRequestProcessingPending,
    materialRequestPostingPending,
    purchaseRequestApprovalPending,
    purchaseOrderPending,
  ] = await Promise.all([
    canApprove
      ? db.leaveRequest.count({
          where: isHR
            ? {
                statusCode: RequestStatus.SUPERVISOR_APPROVED,
                employee: { companyId: activeCompany.companyId },
              }
            : {
                statusCode: RequestStatus.PENDING,
                employee: { companyId: activeCompany.companyId },
                supervisorApprover: {
                  is: {
                    userId: session.user.id,
                    deletedAt: null,
                    isActive: true,
                  },
                },
              },
        })
      : Promise.resolve(0),
    canApprove
      ? db.overtimeRequest.count({
          where: isHR
            ? {
                statusCode: RequestStatus.SUPERVISOR_APPROVED,
                employee: { companyId: activeCompany.companyId },
              }
            : {
                statusCode: RequestStatus.PENDING,
                employee: { companyId: activeCompany.companyId },
                supervisorApprover: {
                  is: {
                    userId: session.user.id,
                    deletedAt: null,
                    isActive: true,
                  },
                },
              },
        })
      : Promise.resolve(0),
    canApprove
      ? db.materialRequest.count({
          where: {
            companyId: {
              in: accessibleCompanyIds,
            },
            status: MaterialRequestStatus.PENDING_APPROVAL,
            OR: [1, 2, 3, 4].map((stepNumber) => ({
              currentStep: stepNumber,
              steps: {
                some: {
                  approverUserId: session.user.id,
                  status: MaterialRequestStepStatus.PENDING,
                  stepNumber,
                },
              },
            })),
          },
        })
      : Promise.resolve(0),
    canProcess
      ? db.materialRequest.count({
          where: {
            companyId: activeCompany.companyId,
            status: MaterialRequestStatus.APPROVED,
            OR: [{ postingStatus: null }, { postingStatus: { not: MaterialRequestPostingStatus.POSTED } }],
            AND: [
              {
                OR: [
                  { processingStatus: null },
                  { processingStatus: MaterialRequestProcessingStatus.PENDING_PURCHASER },
                  { processingStatus: MaterialRequestProcessingStatus.IN_PROGRESS },
                ],
              },
            ],
          },
        })
      : Promise.resolve(0),
    canPost
      ? db.materialRequest.count({
          where: {
            companyId: activeCompany.companyId,
            status: MaterialRequestStatus.APPROVED,
            processingStatus: MaterialRequestProcessingStatus.COMPLETED,
            AND: [
              {
                OR: [
                  {
                    requiresReceiptAcknowledgment: false,
                  },
                  {
                    requiresReceiptAcknowledgment: true,
                    requesterAcknowledgedAt: {
                      not: null,
                    },
                    receivingReports: {
                      some: {},
                    },
                  },
                ],
              },
              {
                OR: [
                  { postingStatus: null },
                  { postingStatus: MaterialRequestPostingStatus.PENDING_POSTING },
                ],
              },
            ],
          },
        })
      : Promise.resolve(0),
    purchaseRequestWorkflowEnabled && canApprove
      ? db.purchaseRequest.count({
          where: {
            companyId: {
              in: accessibleCompanyIds,
            },
            company: {
              enablePurchaseRequestWorkflow: true,
            },
            status: PurchaseRequestStatus.PENDING_APPROVAL,
            OR: [1, 2, 3, 4].map((stepNumber) => ({
              currentStep: stepNumber,
              steps: {
                some: {
                  approverUserId: session.user.id,
                  status: MaterialRequestStepStatus.PENDING,
                  stepNumber,
                },
              },
            })),
          },
        })
      : Promise.resolve(0),
    canManagePurchaseOrders
      ? db.purchaseOrder.count({
          where: {
            companyId: activeCompany.companyId,
            status: {
              in: [
                PurchaseOrderStatus.DRAFT,
                PurchaseOrderStatus.OPEN,
                PurchaseOrderStatus.PARTIALLY_RECEIVED,
                PurchaseOrderStatus.FULLY_RECEIVED,
              ],
            },
          },
        })
      : Promise.resolve(0),
  ])

  return {
    userId: session.user.id,
    companyId: activeCompany.companyId,
    companyName: activeCompany.companyName,
    companyRole,
    capabilities,
    capabilityScopes,
    accessSnapshot,
    purchaseRequestWorkflowEnabled,
    requesterBranchName: employeeRecord?.branch?.name ?? externalRequesterProfile?.branch?.name ?? null,
    user: userRecord
      ? {
          firstName: userRecord.firstName,
          lastName: userRecord.lastName,
          username: userRecord.username,
        }
      : null,
    isRequestApprover,
    isMaterialRequestPurchaser,
    isMaterialRequestPoster,
    isPurchaseRequestItemManager,
    companies,
    employee,
    taskCounts: {
      leaveApprovalPending,
      overtimeApprovalPending,
      materialRequestApprovalPending,
      materialRequestProcessingPending,
      materialRequestPostingPending,
      purchaseRequestApprovalPending,
      purchaseOrderPending,
    },
  }
}
