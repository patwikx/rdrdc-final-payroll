import { MaterialRequestStepStatus, Prisma, PurchaseRequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDateInputValue } from "@/lib/ph-time"
import type {
  PurchaseRequestApprovalHistoryPage,
  PurchaseRequestApprovalHistoryRow,
  PurchaseRequestApprovalQueueRow,
  PurchaseRequestDepartmentFlowPreview,
  PurchaseRequestDepartmentOption,
  PurchaseRequestRow,
} from "@/modules/procurement/types/purchase-request-types"

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const dateTimeLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

const formatDateTime = (value: Date | null): string | null => {
  if (!value) {
    return null
  }

  return dateTimeLabel.format(value)
}

const MINUTE_MS = 60 * 1000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

const formatDurationLabel = (durationMs: number): string => {
  if (durationMs < MINUTE_MS) {
    return "< 1m"
  }

  const totalMinutes = Math.floor(durationMs / MINUTE_MS)
  const days = Math.floor(totalMinutes / DAY_MINUTES)
  const remainingAfterDays = totalMinutes % DAY_MINUTES
  const hours = Math.floor(remainingAfterDays / HOUR_MINUTES)
  const minutes = remainingAfterDays % HOUR_MINUTES

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.join(" ")
}

const getElapsedTimeLabel = (start: Date | null, end: Date | null): string | null => {
  if (!start || !end) {
    return null
  }

  const durationMs = end.getTime() - start.getTime()
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null
  }

  return formatDurationLabel(durationMs)
}

const normalizeStepName = (value: string | null | undefined, stepNumber: number): string => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : `Step ${stepNumber}`
}

const PURCHASE_REQUEST_NUMBER_PATTERN = /^PR-(PO|JO|OTHERS)-(\d{6})$/
const REQUEST_NUMBER_SEQUENCE_DIGITS = 6

const parseRequestNumberSequence = (requestNumber: string): number => {
  const match = PURCHASE_REQUEST_NUMBER_PATTERN.exec(requestNumber)
  if (!match) {
    return 0
  }

  const parsed = Number(match[2] ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

const resolveRequesterDisplay = (params: {
  requesterEmployee?:
    | {
        firstName: string
        lastName: string
        employeeNumber: string
        photoUrl?: string | null
        branch?: { name: string } | null
      }
    | null
  requesterExternalProfile?:
    | {
        requesterCode: string
        branch?: { name: string } | null
      }
    | null
  requesterUser?:
    | {
        firstName: string
        lastName: string
      }
    | null
  requesterBranchName?: string | null
}): {
  requesterName: string
  requesterEmployeeNumber: string
  requesterPhotoUrl: string | null
  requesterBranchName: string | null
} => {
  const requesterName = params.requesterEmployee
    ? `${params.requesterEmployee.firstName} ${params.requesterEmployee.lastName}`
    : params.requesterUser
      ? `${params.requesterUser.firstName} ${params.requesterUser.lastName}`
      : "Unknown Requester"

  return {
    requesterName,
    requesterEmployeeNumber:
      params.requesterEmployee?.employeeNumber ?? params.requesterExternalProfile?.requesterCode ?? "N/A",
    requesterPhotoUrl: params.requesterEmployee?.photoUrl ?? null,
    requesterBranchName:
      params.requesterBranchName ??
      params.requesterEmployee?.branch?.name ??
      params.requesterExternalProfile?.branch?.name ??
      null,
  }
}

const mapPurchaseRequestToRow = (
  request: {
    id: string
    requestNumber: string
    series: "PO" | "JO" | "OTHERS"
    requestType: "ITEM" | "SERVICE"
    status: PurchaseRequestStatus
    requesterUserId: string
    requesterBranchName: string | null
    selectedInitialApproverUserId: string | null
    selectedStepTwoApproverUserId: string | null
    selectedStepThreeApproverUserId: string | null
    selectedStepFourApproverUserId: string | null
    datePrepared: Date
    dateRequired: Date
    purpose: string | null
    remarks: string | null
    deliverTo: string | null
    isStoreUse: boolean
    freight: Prisma.Decimal
    discount: Prisma.Decimal
    subTotal: Prisma.Decimal
    grandTotal: Prisma.Decimal
    approvalCycle: number
    requiredSteps: number
    currentStep: number | null
    submittedAt: Date | null
    approvedAt: Date | null
    rejectedAt: Date | null
    cancelledAt: Date | null
    createdAt: Date
    finalDecisionRemarks: string | null
    sentBackAt: Date | null
    sentBackReason: string | null
    sentBackAcknowledgedAt: Date | null
    cancellationReason: string | null
    steps: Array<{
      id: string
      approvalCycle: number
      stepNumber: number
      stepName: string | null
      approverUserId: string
      status: MaterialRequestStepStatus
      actedAt: Date | null
      remarks: string | null
      approverUser: {
        firstName: string
        lastName: string
      }
      actedByUser: {
        firstName: string
        lastName: string
      } | null
    }>
    requesterEmployee:
      | {
          firstName: string
          lastName: string
          employeeNumber: string
          branch: {
            name: string
          } | null
        }
      | null
    requesterExternalProfile:
      | {
          requesterCode: string
          branch: {
            name: string
          } | null
        }
      | null
    requesterUser: {
      firstName: string
      lastName: string
    }
    department: {
      id: string
      name: string
    }
    sentBackByUser: {
      firstName: string
      lastName: string
    } | null
    items: Array<{
      id: string
      lineNumber: number
      source: "MANUAL" | "CATALOG"
      procurementItemId: string | null
      itemCode: string | null
      description: string
      uom: string
      quantity: Prisma.Decimal
      unitPrice: Prisma.Decimal | null
      lineTotal: Prisma.Decimal | null
      remarks: string | null
    }>
  },
  actorUserId: string | null
): PurchaseRequestRow => {
  const requesterDisplay = resolveRequesterDisplay({
    requesterEmployee: request.requesterEmployee,
    requesterExternalProfile: request.requesterExternalProfile,
    requesterUser: request.requesterUser,
    requesterBranchName: request.requesterBranchName,
  })

  const previousDecisionByCycle = new Map<number, Date | null>()
  const approvalSteps = [...request.steps]
    .sort((a, b) => {
      if (a.approvalCycle !== b.approvalCycle) {
        return b.approvalCycle - a.approvalCycle
      }
      if (a.stepNumber !== b.stepNumber) {
        return a.stepNumber - b.stepNumber
      }
      const aActedAt = a.actedAt?.getTime() ?? 0
      const bActedAt = b.actedAt?.getTime() ?? 0
      return aActedAt - bActedAt
    })
    .map((step) => {
      const previousDecisionAt = previousDecisionByCycle.get(step.approvalCycle) ?? null
      const turnaroundTimeLabel = getElapsedTimeLabel(previousDecisionAt, step.actedAt)

      if (step.actedAt) {
        previousDecisionByCycle.set(step.approvalCycle, step.actedAt)
      }

      return {
        id: step.id,
        approvalCycle: step.approvalCycle,
        isCurrentCycle: step.approvalCycle === request.approvalCycle,
        stepNumber: step.stepNumber,
        stepName: step.stepName ? normalizeStepName(step.stepName, step.stepNumber) : null,
        status: step.status,
        approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
        actedByName: step.actedByUser ? `${step.actedByUser.firstName} ${step.actedByUser.lastName}` : null,
        actedAtLabel: formatDateTime(step.actedAt),
        remarks: step.remarks,
        turnaroundTimeLabel,
      }
    })

  const canActOnCurrentStep = Boolean(
    actorUserId &&
      request.currentStep &&
      request.steps.some(
        (step) =>
          step.approvalCycle === request.approvalCycle &&
          step.stepNumber === request.currentStep &&
          step.approverUserId === actorUserId &&
          step.status === MaterialRequestStepStatus.PENDING
      )
  )
  const finalizationAt = request.approvedAt ?? request.rejectedAt ?? request.cancelledAt
  const now = new Date()

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    series: request.series,
    requestType: request.requestType,
    status: request.status,
    requesterUserId: request.requesterUserId,
    selectedInitialApproverUserId: request.selectedInitialApproverUserId,
    selectedStepTwoApproverUserId: request.selectedStepTwoApproverUserId,
    selectedStepThreeApproverUserId: request.selectedStepThreeApproverUserId,
    selectedStepFourApproverUserId: request.selectedStepFourApproverUserId,
    requesterName: requesterDisplay.requesterName,
    requesterEmployeeNumber: requesterDisplay.requesterEmployeeNumber,
    requesterBranchName: requesterDisplay.requesterBranchName,
    departmentId: request.department.id,
    departmentName: request.department.name,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    datePreparedValue: toPhDateInputValue(request.datePrepared),
    dateRequiredValue: toPhDateInputValue(request.dateRequired),
    purpose: request.purpose,
    remarks: request.remarks,
    deliverTo: request.deliverTo,
    isStoreUse: request.isStoreUse,
    freight: Number(request.freight),
    discount: Number(request.discount),
    subTotal: Number(request.subTotal),
    grandTotal: Number(request.grandTotal),
    approvalCycle: request.approvalCycle,
    requiredSteps: request.requiredSteps,
    currentStep: request.currentStep,
    canActOnCurrentStep,
    submittedAtLabel: formatDateTime(request.submittedAt),
    approvedAtLabel: formatDateTime(request.approvedAt),
    rejectedAtLabel: formatDateTime(request.rejectedAt),
    cancelledAtLabel: formatDateTime(request.cancelledAt),
    approvalLeadTimeLabel: getElapsedTimeLabel(request.submittedAt, request.approvedAt),
    finalizationLeadTimeLabel: getElapsedTimeLabel(request.submittedAt, finalizationAt),
    pendingAgeLabel:
      request.status === PurchaseRequestStatus.PENDING_APPROVAL
        ? getElapsedTimeLabel(request.submittedAt, now)
        : null,
    draftToSubmitLeadTimeLabel: getElapsedTimeLabel(request.createdAt, request.submittedAt),
    totalLifecycleLeadTimeLabel: getElapsedTimeLabel(request.createdAt, finalizationAt),
    finalDecisionRemarks: request.finalDecisionRemarks,
    sentBackAtLabel: formatDateTime(request.sentBackAt),
    sentBackReason: request.sentBackReason,
    sentBackByName: request.sentBackByUser
      ? `${request.sentBackByUser.firstName} ${request.sentBackByUser.lastName}`
      : null,
    hasUnreadSendBackNotice:
      actorUserId === request.requesterUserId &&
      request.sentBackAt !== null &&
      request.sentBackAcknowledgedAt === null,
    cancellationReason: request.cancellationReason,
    approvalSteps,
    items: request.items.map((item) => ({
      id: item.id,
      lineNumber: item.lineNumber,
      source: item.source,
      procurementItemId: item.procurementItemId,
      itemCode: item.itemCode,
      description: item.description,
      uom: item.uom,
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
      lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
      remarks: item.remarks,
    })),
  }
}

export async function getPurchaseRequestNumberPreview(params: {
  companyId: string
}): Promise<Record<"PO" | "JO" | "OTHERS", string>> {
  const seriesList = ["PO", "JO", "OTHERS"] as const
  const response = {} as Record<(typeof seriesList)[number], string>

  for (const series of seriesList) {
    const seriesPrefix = `PR-${series}-`
    const existingRequestNumbers = await db.purchaseRequest.findMany({
      where: {
        companyId: params.companyId,
        requestNumber: {
          startsWith: seriesPrefix,
        },
      },
      select: {
        requestNumber: true,
      },
    })

    const nextSequence =
      existingRequestNumbers.reduce((maxSequence, request) => {
        return Math.max(maxSequence, parseRequestNumberSequence(request.requestNumber))
      }, 0) + 1
    response[series] = `${seriesPrefix}${nextSequence.toString().padStart(REQUEST_NUMBER_SEQUENCE_DIGITS, "0")}`
  }

  return response
}

export async function getPurchaseRequestDepartmentOptions(params: {
  companyId: string
}): Promise<PurchaseRequestDepartmentOption[]> {
  return db.department.findMany({
    where: {
      companyId: params.companyId,
    },
    orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  })
}

export async function getPurchaseRequestFormOptions(params: {
  companyId: string
}): Promise<{
  departments: PurchaseRequestDepartmentOption[]
  departmentFlowPreviews: PurchaseRequestDepartmentFlowPreview[]
}> {
  const [departments, flows] = await Promise.all([
    getPurchaseRequestDepartmentOptions({
      companyId: params.companyId,
    }),
    db.departmentMaterialRequestApprovalFlow.findMany({
      where: {
        companyId: params.companyId,
        isActive: true,
      },
      select: {
        departmentId: true,
        requiredSteps: true,
        steps: {
          orderBy: [{ stepNumber: "asc" }, { approverUser: { firstName: "asc" } }, { approverUser: { lastName: "asc" } }],
          select: {
            stepNumber: true,
            stepName: true,
            approverUserId: true,
            approverUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
  ])

  return {
    departments,
    departmentFlowPreviews: flows.map((flow) => {
      const grouped = new Map<number, PurchaseRequestDepartmentFlowPreview["approversByStep"][number]>()

      for (const step of flow.steps) {
        const approver = {
          userId: step.approverUserId,
          fullName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
          email: step.approverUser.email,
        }

        const existing = grouped.get(step.stepNumber)
        if (existing) {
          if (!existing.stepName || existing.stepName === `Step ${step.stepNumber}`) {
            existing.stepName = normalizeStepName(step.stepName, step.stepNumber)
          }
          existing.approvers.push(approver)
          continue
        }

        grouped.set(step.stepNumber, {
          stepNumber: step.stepNumber,
          stepName: normalizeStepName(step.stepName, step.stepNumber),
          approvers: [approver],
        })
      }

      return {
        departmentId: flow.departmentId,
        requiredSteps: flow.requiredSteps,
        approversByStep: Array.from(grouped.values()).sort((a, b) => a.stepNumber - b.stepNumber),
      }
    }),
  }
}

export async function getPurchaseRequestsReadModel(params: {
  companyId: string
  userId: string
  canViewAll: boolean
}): Promise<PurchaseRequestRow[]> {
  const requests = await db.purchaseRequest.findMany({
    where: {
      companyId: params.companyId,
      ...(params.canViewAll
        ? {}
        : {
            OR: [
              { requesterUserId: params.userId },
              {
                steps: {
                  some: {
                    approverUserId: params.userId,
                  },
                },
              },
            ],
          }),
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      status: true,
      requesterUserId: true,
      requesterBranchName: true,
      selectedInitialApproverUserId: true,
      selectedStepTwoApproverUserId: true,
      selectedStepThreeApproverUserId: true,
      selectedStepFourApproverUserId: true,
      datePrepared: true,
      dateRequired: true,
      purpose: true,
      remarks: true,
      deliverTo: true,
      isStoreUse: true,
      freight: true,
      discount: true,
      subTotal: true,
      grandTotal: true,
      approvalCycle: true,
      requiredSteps: true,
      currentStep: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      createdAt: true,
      finalDecisionRemarks: true,
      sentBackAt: true,
      sentBackReason: true,
      sentBackAcknowledgedAt: true,
      cancellationReason: true,
      sentBackByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      steps: {
        orderBy: {
          approvalCycle: "desc",
        },
        select: {
          id: true,
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
          actedAt: true,
          remarks: true,
          approverUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          actedByUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      requesterExternalProfile: {
        select: {
          requesterCode: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      requesterUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: {
          lineNumber: "asc",
        },
        select: {
          id: true,
          lineNumber: true,
          source: true,
          procurementItemId: true,
          itemCode: true,
          description: true,
          uom: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
    },
  })

  return requests.map((request) => mapPurchaseRequestToRow(request, params.userId))
}

export async function getPurchaseRequestById(params: {
  companyId: string
  requestId: string
  actorUserId?: string
}): Promise<PurchaseRequestRow | null> {
  const request = await db.purchaseRequest.findFirst({
    where: {
      id: params.requestId,
      companyId: params.companyId,
    },
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      status: true,
      requesterUserId: true,
      requesterBranchName: true,
      selectedInitialApproverUserId: true,
      selectedStepTwoApproverUserId: true,
      selectedStepThreeApproverUserId: true,
      selectedStepFourApproverUserId: true,
      datePrepared: true,
      dateRequired: true,
      purpose: true,
      remarks: true,
      deliverTo: true,
      isStoreUse: true,
      freight: true,
      discount: true,
      subTotal: true,
      grandTotal: true,
      approvalCycle: true,
      requiredSteps: true,
      currentStep: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      createdAt: true,
      finalDecisionRemarks: true,
      sentBackAt: true,
      sentBackReason: true,
      sentBackAcknowledgedAt: true,
      cancellationReason: true,
      sentBackByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      steps: {
        orderBy: {
          approvalCycle: "desc",
        },
        select: {
          id: true,
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
          actedAt: true,
          remarks: true,
          approverUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          actedByUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      requesterExternalProfile: {
        select: {
          requesterCode: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      requesterUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: {
          lineNumber: "asc",
        },
        select: {
          id: true,
          lineNumber: true,
          source: true,
          procurementItemId: true,
          itemCode: true,
          description: true,
          uom: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
    },
  })

  return request ? mapPurchaseRequestToRow(request, params.actorUserId ?? null) : null
}

type PurchaseRequestApprovalHistoryStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"

const buildPurchaseRequestApprovalHistoryWhere = (params: {
  companyIds: string[]
  approverUserId: string
  hrCompanyIds: string[]
  search: string
  status: PurchaseRequestApprovalHistoryStatusFilter
  filterCompanyId?: string
  departmentId?: string
}): Prisma.PurchaseRequestWhereInput => {
  const normalizedHrCompanyIds = params.hrCompanyIds.filter((companyId) => params.companyIds.includes(companyId))
  const hasHrScope = normalizedHrCompanyIds.length > 0
  const where: Prisma.PurchaseRequestWhereInput = hasHrScope
    ? {
        OR: [
          {
            companyId: {
              in: normalizedHrCompanyIds,
            },
            status: {
              in: [PurchaseRequestStatus.APPROVED, PurchaseRequestStatus.REJECTED],
            },
          },
          {
            companyId: {
              in: params.companyIds,
            },
            steps: {
              some: {
                actedByUserId: params.approverUserId,
                actedAt: {
                  not: null,
                },
              },
            },
          },
        ],
      }
    : {
        companyId: {
          in: params.companyIds,
        },
        steps: {
          some: {
            actedByUserId: params.approverUserId,
            actedAt: {
              not: null,
            },
          },
        },
      }

  if (params.status !== "ALL") {
    where.status = params.status
  }

  if (params.filterCompanyId) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : []
    where.AND = [...existingAnd, { companyId: params.filterCompanyId }]
  }

  if (params.departmentId) {
    where.departmentId = params.departmentId
  }

  const query = params.search.trim()
  if (query.length > 0) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : []
    where.AND = [
      ...existingAnd,
      {
        OR: [
          {
            requestNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            requesterEmployee: {
              is: {
                firstName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            requesterEmployee: {
              is: {
                lastName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            requesterEmployee: {
              is: {
                employeeNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            requesterUser: {
              firstName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterUser: {
              lastName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterExternalProfile: {
              is: {
                requesterCode: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            department: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            finalDecisionRemarks: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            steps: {
              some: {
                remarks: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
    ]
  }

  return where
}

const toPurchaseHistoryRow = (params: {
  id: string
  companyId: string
  requestNumber: string
  datePrepared: Date
  dateRequired: Date
  status: PurchaseRequestStatus
  grandTotal: Prisma.Decimal
  submittedAt: Date | null
  approvedAt: Date | null
  rejectedAt: Date | null
  updatedAt: Date
  finalDecisionRemarks: string | null
  requesterEmployee:
    | {
        firstName: string
        lastName: string
        employeeNumber: string
        photoUrl: string | null
      }
    | null
  requesterExternalProfile:
    | {
        requesterCode: string
      }
    | null
  requesterUser: {
    firstName: string
    lastName: string
  }
  department: {
    name: string
  }
  company: {
    name: string
  }
  steps: Array<{
    stepNumber: number
    stepName: string | null
    status: MaterialRequestStepStatus
    actedAt: Date | null
    remarks: string | null
  }>
}): PurchaseRequestApprovalHistoryRow => {
  const requesterDisplay = resolveRequesterDisplay({
    requesterEmployee: params.requesterEmployee,
    requesterExternalProfile: params.requesterExternalProfile,
    requesterUser: params.requesterUser,
  })
  const latestActedStep = params.steps[0] ?? null
  const actedAt =
    latestActedStep?.actedAt ??
    params.approvedAt ??
    params.rejectedAt ??
    params.submittedAt ??
    params.updatedAt

  return {
    id: params.id,
    companyId: params.companyId,
    companyName: params.company.name,
    requestNumber: params.requestNumber,
    requesterName: requesterDisplay.requesterName,
    requesterEmployeeNumber: requesterDisplay.requesterEmployeeNumber,
    requesterPhotoUrl: requesterDisplay.requesterPhotoUrl,
    departmentName: params.department.name,
    status: params.status,
    datePreparedLabel: dateLabel.format(params.datePrepared),
    dateRequiredLabel: dateLabel.format(params.dateRequired),
    grandTotal: Number(params.grandTotal),
    submittedAtLabel: formatDateTime(params.submittedAt),
    actedAtIso: actedAt.toISOString(),
    actedAtLabel: dateTimeLabel.format(actedAt),
    actedStepNumber: latestActedStep?.stepNumber ?? null,
    actedStepName: latestActedStep ? normalizeStepName(latestActedStep.stepName, latestActedStep.stepNumber) : null,
    actedStepStatus: latestActedStep?.status ?? null,
    actedRemarks: latestActedStep?.remarks ?? null,
    finalDecisionRemarks: params.finalDecisionRemarks,
  }
}

export async function getPurchaseRequestApprovalHistoryPageReadModel(params: {
  companyId?: string
  companyIds?: string[]
  approverUserId: string
  isHR?: boolean
  hrCompanyIds?: string[]
  page: number
  pageSize: number
  search: string
  status: PurchaseRequestApprovalHistoryStatusFilter
  filterCompanyId?: string
  departmentId?: string
}): Promise<PurchaseRequestApprovalHistoryPage> {
  const normalizedCompanyIds = Array.from(
    new Set(
      (params.companyIds?.length ? params.companyIds : params.companyId ? [params.companyId] : []).filter(
        (companyId) => companyId.trim().length > 0
      )
    )
  )

  if (normalizedCompanyIds.length === 0) {
    return {
      rows: [],
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
    }
  }

  if (params.filterCompanyId && !normalizedCompanyIds.includes(params.filterCompanyId)) {
    return {
      rows: [],
      total: 0,
      page: params.page,
      pageSize: params.pageSize,
    }
  }

  const where = buildPurchaseRequestApprovalHistoryWhere({
    companyIds: normalizedCompanyIds,
    approverUserId: params.approverUserId,
    hrCompanyIds: params.hrCompanyIds ?? (params.isHR ? normalizedCompanyIds : []),
    search: params.search,
    status: params.status,
    filterCompanyId: params.filterCompanyId,
    departmentId: params.departmentId,
  })
  const skip = (params.page - 1) * params.pageSize

  const [total, historyRequests] = await db.$transaction([
    db.purchaseRequest.count({ where }),
    db.purchaseRequest.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
        companyId: true,
        requestNumber: true,
        datePrepared: true,
        dateRequired: true,
        status: true,
        grandTotal: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        updatedAt: true,
        finalDecisionRemarks: true,
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photoUrl: true,
          },
        },
        requesterExternalProfile: {
          select: {
            requesterCode: true,
          },
        },
        requesterUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        company: {
          select: {
            name: true,
          },
        },
        steps: {
          where: {
            actedByUserId: params.approverUserId,
            actedAt: {
              not: null,
            },
          },
          orderBy: {
            actedAt: "desc",
          },
          take: 1,
          select: {
            stepNumber: true,
            stepName: true,
            status: true,
            actedAt: true,
            remarks: true,
          },
        },
      },
    }),
  ])

  return {
    rows: historyRequests.map((request) => toPurchaseHistoryRow(request)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getPurchaseRequestApprovalQueueReadModel(params: {
  companyIds: string[]
  approverUserId: string
}): Promise<PurchaseRequestApprovalQueueRow[]> {
  const normalizedCompanyIds = Array.from(
    new Set(params.companyIds.map((companyId) => companyId.trim()).filter((companyId) => companyId.length > 0))
  )

  if (normalizedCompanyIds.length === 0) {
    return []
  }

  const rows = await db.purchaseRequest.findMany({
    where: {
      companyId: {
        in: normalizedCompanyIds,
      },
      company: {
        enablePurchaseRequestWorkflow: true,
      },
      status: PurchaseRequestStatus.PENDING_APPROVAL,
      OR: [1, 2, 3, 4].map((stepNumber) => ({
        currentStep: stepNumber,
        steps: {
          some: {
            approverUserId: params.approverUserId,
            status: MaterialRequestStepStatus.PENDING,
            stepNumber,
          },
        },
      })),
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      companyId: true,
      requestNumber: true,
      departmentId: true,
      datePrepared: true,
      dateRequired: true,
      currentStep: true,
      requiredSteps: true,
      grandTotal: true,
      submittedAt: true,
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          photoUrl: true,
        },
      },
      requesterExternalProfile: {
        select: {
          requesterCode: true,
        },
      },
      requesterUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      company: {
        select: {
          name: true,
        },
      },
    },
  })

  return rows.map((row) => {
    const requesterDisplay = resolveRequesterDisplay({
      requesterEmployee: row.requesterEmployee,
      requesterExternalProfile: row.requesterExternalProfile,
      requesterUser: row.requesterUser,
    })

    return {
      id: row.id,
      companyId: row.companyId,
      companyName: row.company.name,
      requestNumber: row.requestNumber,
      requesterName: requesterDisplay.requesterName,
      requesterEmployeeNumber: requesterDisplay.requesterEmployeeNumber,
      requesterPhotoUrl: requesterDisplay.requesterPhotoUrl,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      datePreparedLabel: dateLabel.format(row.datePrepared),
      dateRequiredLabel: dateLabel.format(row.dateRequired),
      currentStep: row.currentStep ?? 1,
      requiredSteps: row.requiredSteps,
      grandTotal: Number(row.grandTotal),
      submittedAtLabel: formatDateTime(row.submittedAt),
    }
  })
}
