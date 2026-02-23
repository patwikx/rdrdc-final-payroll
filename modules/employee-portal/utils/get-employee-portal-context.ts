import { auth } from "@/auth"
import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  RequestStatus,
} from "@prisma/client"

import { db } from "@/lib/db"
import { getActiveCompanyContext, getUserCompanyOptions } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type EmployeePortalContext = {
  userId: string
  companyId: string
  companyName: string
  companyRole: CompanyRole
  companies: Awaited<ReturnType<typeof getUserCompanyOptions>>
  employee: {
    id: string
    employeeNumber: string
    photoUrl: string | null
    firstName: string
    lastName: string
    hireDate: Date
    regularizationDate: Date | null
    department: { name: string } | null
    position: { name: string } | null
    employmentStatus: { name: string } | null
    employmentType: { name: string } | null
    user: {
      email: string
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

  const employeeRecord = await db.employee.findFirst({
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
      hireDate: true,
      regularizationDate: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      employmentStatus: { select: { name: true } },
      employmentType: { select: { name: true } },
      user: {
        select: {
          email: true,
          isRequestApprover: true,
          companyAccess: {
            where: {
              companyId: activeCompany.companyId,
              isActive: true,
            },
            select: {
              isMaterialRequestPurchaser: true,
              isMaterialRequestPoster: true,
            },
            take: 1,
          },
        },
      },
    },
  })

  const employee = employeeRecord
    ? {
        ...employeeRecord,
        user: employeeRecord.user
          ? {
              email: employeeRecord.user.email,
              isRequestApprover: employeeRecord.user.isRequestApprover,
              isMaterialRequestPurchaser:
                employeeRecord.user.companyAccess[0]?.isMaterialRequestPurchaser ?? false,
              isMaterialRequestPoster: employeeRecord.user.companyAccess[0]?.isMaterialRequestPoster ?? false,
            }
          : null,
      }
    : null

  const companyRole = activeCompany.companyRole as CompanyRole
  const isHR = companyRole === "COMPANY_ADMIN" || companyRole === "HR_ADMIN" || companyRole === "PAYROLL_ADMIN"
  const canApprove = isHR || Boolean(employee?.user?.isRequestApprover)
  const canProcess = isHR || Boolean(employee?.user?.isMaterialRequestPurchaser)
  const canPost = isHR || Boolean(employee?.user?.isMaterialRequestPoster)

  const [
    leaveApprovalPending,
    overtimeApprovalPending,
    materialRequestApprovalPending,
    materialRequestProcessingPending,
    materialRequestPostingPending,
  ] = await Promise.all([
    canApprove
      ? db.leaveRequest.count({
          where: isHR
            ? {
                statusCode: RequestStatus.SUPERVISOR_APPROVED,
                employee: { companyId: activeCompany.companyId },
              }
            : employee
              ? {
                  statusCode: RequestStatus.PENDING,
                  supervisorApproverId: employee.id,
                  employee: { companyId: activeCompany.companyId },
                }
              : {
                  id: "__none__",
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
            : employee
              ? {
                  statusCode: RequestStatus.PENDING,
                  supervisorApproverId: employee.id,
                  employee: { companyId: activeCompany.companyId },
                }
              : {
                  id: "__none__",
                },
        })
      : Promise.resolve(0),
    canApprove
      ? db.materialRequest.count({
          where: {
            companyId: activeCompany.companyId,
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
  ])

  return {
    userId: session.user.id,
    companyId: activeCompany.companyId,
    companyName: activeCompany.companyName,
    companyRole,
    companies,
    employee,
    taskCounts: {
      leaveApprovalPending,
      overtimeApprovalPending,
      materialRequestApprovalPending,
      materialRequestProcessingPending,
      materialRequestPostingPending,
    },
  }
}
