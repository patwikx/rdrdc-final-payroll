import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  type Prisma,
} from "@prisma/client"
import type { MaterialRequestSeries } from "@prisma/client"

import { toPhDateInputValue } from "@/lib/ph-time"
import { db } from "@/lib/db"
import type {
  EmployeePortalMaterialRequestDepartmentFlowPreview,
  EmployeePortalMaterialRequestDepartmentOption,
  EmployeePortalMaterialRequestApprovalReadModel,
  EmployeePortalMaterialRequestApprovalHistoryPage,
  EmployeePortalMaterialRequestApprovalHistoryRow,
  EmployeePortalMaterialRequestApprovalQueueRow,
  EmployeePortalMaterialRequestProcessingDetail,
  EmployeePortalMaterialRequestProcessingPage,
  EmployeePortalMaterialRequestProcessingRow,
  EmployeePortalMaterialRequestProcessingStatusFilter,
  EmployeePortalMaterialRequestPostingDetail,
  EmployeePortalMaterialRequestPostingPage,
  EmployeePortalMaterialRequestPostingRow,
  EmployeePortalMaterialRequestPostingStatusFilter,
  EmployeePortalMaterialRequestRow,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

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

const normalizeStepName = (stepName: string | null | undefined, stepNumber: number): string => {
  const trimmed = stepName?.trim()
  return trimmed ? trimmed : `Step ${stepNumber}`
}

const REQUEST_NUMBER_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})
const REQUEST_NUMBER_SEQUENCE_DIGITS = 6
const MATERIAL_REQUEST_SERIES: MaterialRequestSeries[] = ["PO", "JO", "OTHERS"]

const getRequestNumberDateStamp = (): string => {
  return REQUEST_NUMBER_DATE_FORMAT.format(new Date()).replace(/-/g, "")
}

const parseRequestNumberSequence = (requestNumber: string): number => {
  const suffix = requestNumber.split("-").at(-1) ?? ""
  if (!/^\d+$/.test(suffix)) {
    return 0
  }

  const parsed = Number(suffix)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function getEmployeePortalMaterialRequestsReadModel(params: {
  companyId: string
  userId: string
}): Promise<EmployeePortalMaterialRequestRow[]> {
  const requests = await db.materialRequest.findMany({
    where: {
      companyId: params.companyId,
      requesterUserId: params.userId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      status: true,
      departmentId: true,
      selectedInitialApproverUserId: true,
      selectedStepTwoApproverUserId: true,
      selectedStepThreeApproverUserId: true,
      selectedStepFourApproverUserId: true,
      datePrepared: true,
      dateRequired: true,
      chargeTo: true,
      bldgCode: true,
      purpose: true,
      remarks: true,
      deliverTo: true,
      isStoreUse: true,
      freight: true,
      discount: true,
      subTotal: true,
      grandTotal: true,
      currentStep: true,
      requiredSteps: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      processingStatus: true,
      processingStartedAt: true,
      processingCompletedAt: true,
      processingRemarks: true,
      finalDecisionRemarks: true,
      cancellationReason: true,
      serveBatches: {
        orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          poNumber: true,
          supplierName: true,
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
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
          itemCode: true,
          description: true,
          uom: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
      steps: {
        orderBy: {
          stepNumber: "asc",
        },
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
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
    },
  })

  const departmentIds = [...new Set(requests.map((request) => request.departmentId))]
  const flowStepNamesByDepartmentId = new Map<string, Map<number, string>>()

  if (departmentIds.length > 0) {
    const flows = await db.departmentMaterialRequestApprovalFlow.findMany({
      where: {
        companyId: params.companyId,
        departmentId: {
          in: departmentIds,
        },
      },
      select: {
        departmentId: true,
        steps: {
          select: {
            stepNumber: true,
            stepName: true,
          },
        },
      },
    })

    for (const flow of flows) {
      const stepNames = new Map<number, string>()
      for (const step of flow.steps) {
        const normalizedName = normalizeStepName(step.stepName, step.stepNumber)
        if (!stepNames.has(step.stepNumber)) {
          stepNames.set(step.stepNumber, normalizedName)
        }
      }

      if (stepNames.size > 0) {
        flowStepNamesByDepartmentId.set(flow.departmentId, stepNames)
      }
    }
  }

  return requests.map((request) => ({
    id: request.id,
    requestNumber: request.requestNumber,
    series: request.series,
    requestType: request.requestType,
    status: request.status,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentId: request.departmentId,
    departmentName: request.department.name,
    selectedInitialApproverUserId: request.selectedInitialApproverUserId,
    selectedStepTwoApproverUserId: request.selectedStepTwoApproverUserId,
    selectedStepThreeApproverUserId: request.selectedStepThreeApproverUserId,
    selectedStepFourApproverUserId: request.selectedStepFourApproverUserId,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    datePreparedValue: toPhDateInputValue(request.datePrepared),
    dateRequiredValue: toPhDateInputValue(request.dateRequired),
    chargeTo: request.chargeTo,
    bldgCode: request.bldgCode,
    purpose: request.purpose,
    remarks: request.remarks,
    deliverTo: request.deliverTo,
    isStoreUse: request.isStoreUse,
    freight: Number(request.freight),
    discount: Number(request.discount),
    subTotal: Number(request.subTotal),
    grandTotal: Number(request.grandTotal),
    currentStep: request.currentStep,
    requiredSteps: request.requiredSteps,
    submittedAtLabel: formatDateTime(request.submittedAt),
    approvedAtLabel: formatDateTime(request.approvedAt),
    rejectedAtLabel: formatDateTime(request.rejectedAt),
    cancelledAtLabel: formatDateTime(request.cancelledAt),
    processingStatus: request.processingStatus,
    processingStartedAtLabel: formatDateTime(request.processingStartedAt),
    processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
    processingRemarks: request.processingRemarks,
    processingPoNumber: request.serveBatches[0]?.poNumber ?? null,
    processingSupplierName: request.serveBatches[0]?.supplierName ?? null,
    finalDecisionRemarks: request.finalDecisionRemarks,
    cancellationReason: request.cancellationReason,
    items: request.items.map((item) => ({
      id: item.id,
      lineNumber: item.lineNumber,
      source: item.source,
      itemCode: item.itemCode,
      description: item.description,
      uom: item.uom,
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
      lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
      remarks: item.remarks,
    })),
    approvalSteps: request.steps.map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      stepName:
        step.stepName ??
        flowStepNamesByDepartmentId.get(request.departmentId)?.get(step.stepNumber) ??
        null,
      status: step.status,
      approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
      actedByName: step.actedByUser ? `${step.actedByUser.firstName} ${step.actedByUser.lastName}` : null,
      actedAtLabel: formatDateTime(step.actedAt),
      remarks: step.remarks,
    })),
  }))
}

export async function getEmployeePortalMaterialRequestFormOptions(params: {
  companyId: string
}): Promise<{
  departments: EmployeePortalMaterialRequestDepartmentOption[]
  departmentFlowPreviews: EmployeePortalMaterialRequestDepartmentFlowPreview[]
}> {
  const [departments, flows] = await Promise.all([
    db.department.findMany({
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
      const grouped = new Map<number, EmployeePortalMaterialRequestDepartmentFlowPreview["approversByStep"][number]>()

      for (const step of flow.steps) {
        const existing = grouped.get(step.stepNumber)
        const approver = {
          userId: step.approverUserId,
          fullName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
          email: step.approverUser.email,
        }

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

export async function getEmployeePortalMaterialRequestNumberPreview(params: {
  companyId: string
}): Promise<Record<MaterialRequestSeries, string>> {
  const stamp = getRequestNumberDateStamp()
  const previewEntries = await Promise.all(
    MATERIAL_REQUEST_SERIES.map(async (series) => {
      const prefix = `MR-${series}-${stamp}-`
      const latestRequest = await db.materialRequest.findFirst({
        where: {
          companyId: params.companyId,
          requestNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          requestNumber: "desc",
        },
        select: {
          requestNumber: true,
        },
      })

      const nextSequence = parseRequestNumberSequence(latestRequest?.requestNumber ?? "") + 1
      const suffix = nextSequence.toString().padStart(REQUEST_NUMBER_SEQUENCE_DIGITS, "0")

      return [series, `${prefix}${suffix}`] as const
    })
  )

  return Object.fromEntries(previewEntries) as Record<MaterialRequestSeries, string>
}

const toQueueRow = (request: {
  id: string
  requestNumber: string
  datePrepared: Date
  dateRequired: Date
  currentStep: number | null
  requiredSteps: number
  grandTotal: { toString(): string }
  submittedAt: Date | null
  requesterEmployee: {
    firstName: string
    lastName: string
    employeeNumber: string
  }
  department: {
    name: string
  }
}): EmployeePortalMaterialRequestApprovalQueueRow => {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentName: request.department.name,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    currentStep: request.currentStep ?? 1,
    requiredSteps: request.requiredSteps,
    grandTotal: Number(request.grandTotal.toString()),
    submittedAtLabel: formatDateTime(request.submittedAt),
  }
}

type MaterialRequestApprovalHistoryStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"

const buildMaterialRequestApprovalHistoryWhere = (params: {
  companyId: string
  approverUserId: string
  isHR: boolean
  search: string
  status: MaterialRequestApprovalHistoryStatusFilter
}): Prisma.MaterialRequestWhereInput => {
  const where: Prisma.MaterialRequestWhereInput = params.isHR
    ? {
        companyId: params.companyId,
        status: {
          in: [MaterialRequestStatus.APPROVED, MaterialRequestStatus.REJECTED],
        },
      }
    : {
        companyId: params.companyId,
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

  const query = params.search.trim()
  if (query.length > 0) {
    where.AND = [
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
              firstName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterEmployee: {
              lastName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterEmployee: {
              employeeNumber: {
                contains: query,
                mode: "insensitive",
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

const toHistoryRow = (params: {
  id: string
  requestNumber: string
  datePrepared: Date
  dateRequired: Date
  status: MaterialRequestStatus
  currentStep: number | null
  requiredSteps: number
  grandTotal: { toString(): string }
  submittedAt: Date | null
  approvedAt: Date | null
  rejectedAt: Date | null
  updatedAt: Date
  finalDecisionRemarks: string | null
  requesterEmployee: {
    firstName: string
    lastName: string
    employeeNumber: string
  }
  department: {
    name: string
  }
  steps: Array<{
    stepNumber: number
    stepName: string | null
    status: MaterialRequestStepStatus
    actedAt: Date | null
    remarks: string | null
  }>
}): EmployeePortalMaterialRequestApprovalHistoryRow => {
  const latestActedStep = params.steps[0] ?? null
  const actedAt =
    latestActedStep?.actedAt ??
    params.approvedAt ??
    params.rejectedAt ??
    params.submittedAt ??
    params.updatedAt

  return {
    id: params.id,
    requestNumber: params.requestNumber,
    requesterName: `${params.requesterEmployee.firstName} ${params.requesterEmployee.lastName}`,
    requesterEmployeeNumber: params.requesterEmployee.employeeNumber,
    departmentName: params.department.name,
    status: params.status,
    datePreparedLabel: dateLabel.format(params.datePrepared),
    dateRequiredLabel: dateLabel.format(params.dateRequired),
    currentStep: params.currentStep,
    requiredSteps: params.requiredSteps,
    grandTotal: Number(params.grandTotal.toString()),
    submittedAtLabel: formatDateTime(params.submittedAt),
    actedAtIso: actedAt.toISOString(),
    actedAtLabel: dateTimeLabel.format(actedAt),
    actedStepNumber: latestActedStep?.stepNumber ?? null,
    actedStepName: latestActedStep
      ? normalizeStepName(latestActedStep.stepName, latestActedStep.stepNumber)
      : null,
    actedStepStatus: latestActedStep?.status ?? null,
    actedRemarks: latestActedStep?.remarks ?? null,
    finalDecisionRemarks: params.finalDecisionRemarks,
  }
}

export async function getEmployeePortalMaterialRequestApprovalHistoryPageReadModel(params: {
  companyId: string
  approverUserId: string
  isHR: boolean
  page: number
  pageSize: number
  search: string
  status: MaterialRequestApprovalHistoryStatusFilter
}): Promise<EmployeePortalMaterialRequestApprovalHistoryPage> {
  const where = buildMaterialRequestApprovalHistoryWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, historyRequests] = await db.$transaction([
    db.materialRequest.count({ where }),
    db.materialRequest.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
        requestNumber: true,
        datePrepared: true,
        dateRequired: true,
        status: true,
        currentStep: true,
        requiredSteps: true,
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
          },
        },
        department: {
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
    rows: historyRequests.map((request) => toHistoryRow(request)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalMaterialRequestApprovalReadModel(params: {
  companyId: string
  approverUserId: string
  isHR: boolean
}): Promise<EmployeePortalMaterialRequestApprovalReadModel> {
  const queuePromise = db.materialRequest.findMany({
    where: {
      companyId: params.companyId,
      status: MaterialRequestStatus.PENDING_APPROVAL,
      steps: {
        some: {
          approverUserId: params.approverUserId,
          status: "PENDING",
        },
      },
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      requestNumber: true,
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
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      steps: {
        where: {
          approverUserId: params.approverUserId,
          status: "PENDING",
        },
        select: {
          stepNumber: true,
          stepName: true,
        },
      },
    },
    take: 500,
  })

  const historyPromise = getEmployeePortalMaterialRequestApprovalHistoryPageReadModel({
    companyId: params.companyId,
    approverUserId: params.approverUserId,
    isHR: params.isHR,
    page: 1,
    pageSize: 10,
    search: "",
    status: "ALL",
  })

  const [queueRequests, historyPage] = await Promise.all([queuePromise, historyPromise])

  const rows = queueRequests
    .filter((request) => {
      if (!request.currentStep) {
        return false
      }

      return request.steps.some((step) => step.stepNumber === request.currentStep)
    })
    .map((request) => toQueueRow(request))

  return {
    rows,
    historyRows: historyPage.rows,
    historyTotal: historyPage.total,
    historyPage: historyPage.page,
    historyPageSize: historyPage.pageSize,
  }
}

const normalizeProcessingStatus = (
  status: MaterialRequestProcessingStatus | null
): MaterialRequestProcessingStatus => {
  return status ?? MaterialRequestProcessingStatus.PENDING_PURCHASER
}

const normalizePostingStatus = (
  status: MaterialRequestPostingStatus | null
): MaterialRequestPostingStatus => {
  return status ?? MaterialRequestPostingStatus.PENDING_POSTING
}

const buildMaterialRequestProcessingWhere = (params: {
  companyId: string
  search: string
  status: EmployeePortalMaterialRequestProcessingStatusFilter
}): Prisma.MaterialRequestWhereInput => {
  const andConditions: Prisma.MaterialRequestWhereInput[] = [
    {
      OR: [{ postingStatus: null }, { postingStatus: { not: MaterialRequestPostingStatus.POSTED } }],
    },
  ]

  const where: Prisma.MaterialRequestWhereInput = {
    companyId: params.companyId,
    status: MaterialRequestStatus.APPROVED,
    AND: andConditions,
  }

  if (params.status === "PENDING_PURCHASER") {
    andConditions.push({
      OR: [
        {
        processingStatus: MaterialRequestProcessingStatus.PENDING_PURCHASER,
        },
        {
        processingStatus: null,
        },
      ],
    })
  } else if (params.status !== "ALL") {
    where.processingStatus = params.status
  }

  const query = params.search.trim()
  if (query.length > 0) {
    andConditions.push({
      OR: [
          {
            requestNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            requesterEmployee: {
              firstName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterEmployee: {
              lastName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            requesterEmployee: {
              employeeNumber: {
                contains: query,
                mode: "insensitive",
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
            purpose: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            remarks: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            processingRemarks: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            serveBatches: {
              some: {
                poNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            serveBatches: {
              some: {
                supplierName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      })
  }

  return where
}

const toProcessingRow = (request: {
  id: string
  requestNumber: string
  datePrepared: Date
  dateRequired: Date
  approvedAt: Date | null
  grandTotal: { toString(): string }
  processingStatus: MaterialRequestProcessingStatus | null
  processingStartedAt: Date | null
  processingCompletedAt: Date | null
  serveBatches: Array<{
    poNumber: string
    supplierName: string
  }>
  processedByUser: {
    firstName: string
    lastName: string
  } | null
  requesterEmployee: {
    firstName: string
    lastName: string
    employeeNumber: string
  }
  department: {
    name: string
  }
  items: Array<{
    quantity: { toString(): string }
    serveBatchItems: Array<{
      quantityServed: { toString(): string }
    }>
  }>
  _count: {
    items: number
  }
}): EmployeePortalMaterialRequestProcessingRow => {
  const latestServeBatch = request.serveBatches[0]
  const normalizedStatus = normalizeProcessingStatus(request.processingStatus)
  const hasServedQuantity = request.items.some((item) => {
    const servedQuantity = item.serveBatchItems.reduce((accumulator, servedEntry) => {
      return accumulator + Number(servedEntry.quantityServed.toString())
    }, 0)

    return servedQuantity > 0.0005
  })
  const hasRemainingQuantity = request.items.some((item) => {
    const requestedQuantity = Number(item.quantity.toString())
    const servedQuantity = item.serveBatchItems.reduce((accumulator, servedEntry) => {
      return accumulator + Number(servedEntry.quantityServed.toString())
    }, 0)

    return requestedQuantity - servedQuantity > 0.0005
  })
  const isPartiallyServed =
    normalizedStatus === MaterialRequestProcessingStatus.IN_PROGRESS &&
    hasServedQuantity &&
    hasRemainingQuantity
  const canMarkCompleted =
    normalizedStatus === MaterialRequestProcessingStatus.IN_PROGRESS &&
    !hasRemainingQuantity

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentName: request.department.name,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    approvedAtLabel: formatDateTime(request.approvedAt),
    itemCount: request._count.items,
    grandTotal: Number(request.grandTotal.toString()),
    processingStatus: normalizedStatus,
    processingStartedAtLabel: formatDateTime(request.processingStartedAt),
    processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
    processingPoNumber: latestServeBatch?.poNumber ?? null,
    processingSupplierName: latestServeBatch?.supplierName ?? null,
    isPartiallyServed,
    canMarkCompleted,
    processedByName: request.processedByUser
      ? `${request.processedByUser.firstName} ${request.processedByUser.lastName}`
      : null,
  }
}

export async function getEmployeePortalMaterialRequestProcessingPageReadModel(params: {
  companyId: string
  page: number
  pageSize: number
  search: string
  status: EmployeePortalMaterialRequestProcessingStatusFilter
}): Promise<EmployeePortalMaterialRequestProcessingPage> {
  const where = buildMaterialRequestProcessingWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, requests] = await db.$transaction([
    db.materialRequest.count({ where }),
    db.materialRequest.findMany({
      where,
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
        requestNumber: true,
        datePrepared: true,
        dateRequired: true,
        approvedAt: true,
        grandTotal: true,
        processingStatus: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        serveBatches: {
          orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            poNumber: true,
            supplierName: true,
          },
        },
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        processedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        items: {
          select: {
            quantity: true,
            serveBatchItems: {
              select: {
                quantityServed: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
  ])

  return {
    rows: requests.map((request) => toProcessingRow(request)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalMaterialRequestProcessingDetailReadModel(params: {
  companyId: string
  requestId: string
}): Promise<EmployeePortalMaterialRequestProcessingDetail | null> {
  const request = await db.materialRequest.findFirst({
    where: {
      id: params.requestId,
      companyId: params.companyId,
      status: MaterialRequestStatus.APPROVED,
    },
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      datePrepared: true,
      dateRequired: true,
      submittedAt: true,
      approvedAt: true,
      processingStatus: true,
      processingStartedAt: true,
      processingCompletedAt: true,
      processingRemarks: true,
      serveBatches: {
        orderBy: [{ servedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          poNumber: true,
          supplierName: true,
        },
      },
      subTotal: true,
      freight: true,
      discount: true,
      grandTotal: true,
      purpose: true,
      remarks: true,
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      processedByUser: {
        select: {
          firstName: true,
          lastName: true,
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
          itemCode: true,
          description: true,
          uom: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
          serveBatchItems: {
            select: {
              quantityServed: true,
            },
          },
        },
      },
      steps: {
        orderBy: {
          stepNumber: "asc",
        },
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
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
    },
  })

  if (!request) {
    return null
  }

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    series: request.series,
    requestType: request.requestType,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentName: request.department.name,
    datePreparedLabel: toPhDateInputValue(request.datePrepared),
    dateRequiredLabel: toPhDateInputValue(request.dateRequired),
    approvedAtLabel: formatDateTime(request.approvedAt),
    submittedAtLabel: formatDateTime(request.submittedAt),
    processingStatus: normalizeProcessingStatus(request.processingStatus),
    processingStartedAtLabel: formatDateTime(request.processingStartedAt),
    processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
    processedByName: request.processedByUser
      ? `${request.processedByUser.firstName} ${request.processedByUser.lastName}`
      : null,
    processingRemarks: request.processingRemarks,
    processingPoNumber: request.serveBatches[0]?.poNumber ?? null,
    processingSupplierName: request.serveBatches[0]?.supplierName ?? null,
    subTotal: Number(request.subTotal),
    freight: Number(request.freight),
    discount: Number(request.discount),
    grandTotal: Number(request.grandTotal),
    purpose: request.purpose,
    remarks: request.remarks,
    items: request.items.map((item) => {
      const servedQuantity = item.serveBatchItems.reduce((accumulator, servedEntry) => {
        return accumulator + Number(servedEntry.quantityServed)
      }, 0)
      const requestedQuantity = Number(item.quantity)

      return {
        id: item.id,
        lineNumber: item.lineNumber,
        source: item.source,
        itemCode: item.itemCode,
        description: item.description,
        uom: item.uom,
        quantity: requestedQuantity,
        servedQuantity,
        remainingQuantity: Math.max(0, requestedQuantity - servedQuantity),
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
        lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
        remarks: item.remarks,
      }
    }),
    approvalSteps: request.steps.map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      status: step.status,
      approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
      actedByName: step.actedByUser
        ? `${step.actedByUser.firstName} ${step.actedByUser.lastName}`
        : null,
      actedAtLabel: formatDateTime(step.actedAt),
      remarks: step.remarks,
    })),
  }
}

const buildMaterialRequestPostingWhere = (params: {
  companyId: string
  search: string
  status: EmployeePortalMaterialRequestPostingStatusFilter
}): Prisma.MaterialRequestWhereInput => {
  const andConditions: Prisma.MaterialRequestWhereInput[] = []
  const where: Prisma.MaterialRequestWhereInput = {
    companyId: params.companyId,
    status: MaterialRequestStatus.APPROVED,
    processingStatus: MaterialRequestProcessingStatus.COMPLETED,
    AND: andConditions,
  }

  if (params.status === "PENDING_POSTING") {
    andConditions.push({
      OR: [
        {
          postingStatus: null,
        },
        {
          postingStatus: MaterialRequestPostingStatus.PENDING_POSTING,
        },
      ],
    })
  } else if (params.status === "POSTED") {
    where.postingStatus = MaterialRequestPostingStatus.POSTED
  }

  const query = params.search.trim()
  if (query.length > 0) {
    andConditions.push({
      OR: [
        {
          requestNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          requesterEmployee: {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          requesterEmployee: {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          requesterEmployee: {
            employeeNumber: {
              contains: query,
              mode: "insensitive",
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
          postingReference: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    })
  }

  return where
}

const toPostingRow = (request: {
  id: string
  requestNumber: string
  datePrepared: Date
  dateRequired: Date
  processingCompletedAt: Date | null
  postingStatus: MaterialRequestPostingStatus | null
  postingReference: string | null
  postedAt: Date | null
  grandTotal: { toString(): string }
  requesterEmployee: {
    firstName: string
    lastName: string
    employeeNumber: string
  }
  department: {
    name: string
  }
  postedByUser: {
    firstName: string
    lastName: string
  } | null
  _count: {
    items: number
  }
}): EmployeePortalMaterialRequestPostingRow => {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentName: request.department.name,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
    itemCount: request._count.items,
    grandTotal: Number(request.grandTotal.toString()),
    postingStatus: normalizePostingStatus(request.postingStatus),
    postingReference: request.postingReference,
    postedAtLabel: formatDateTime(request.postedAt),
    postedByName: request.postedByUser
      ? `${request.postedByUser.firstName} ${request.postedByUser.lastName}`
      : null,
  }
}

export async function getEmployeePortalMaterialRequestPostingPageReadModel(params: {
  companyId: string
  page: number
  pageSize: number
  search: string
  status: EmployeePortalMaterialRequestPostingStatusFilter
}): Promise<EmployeePortalMaterialRequestPostingPage> {
  const where = buildMaterialRequestPostingWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, requests] = await db.$transaction([
    db.materialRequest.count({ where }),
    db.materialRequest.findMany({
      where,
      orderBy: [{ processingCompletedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
        requestNumber: true,
        datePrepared: true,
        dateRequired: true,
        processingCompletedAt: true,
        postingStatus: true,
        postingReference: true,
        postedAt: true,
        grandTotal: true,
        requesterEmployee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        postedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
  ])

  return {
    rows: requests.map((request) => toPostingRow(request)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalMaterialRequestPostingDetailReadModel(params: {
  companyId: string
  requestId: string
}): Promise<EmployeePortalMaterialRequestPostingDetail | null> {
  const request = await db.materialRequest.findFirst({
    where: {
      id: params.requestId,
      companyId: params.companyId,
      status: MaterialRequestStatus.APPROVED,
      processingStatus: MaterialRequestProcessingStatus.COMPLETED,
    },
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      datePrepared: true,
      dateRequired: true,
      submittedAt: true,
      approvedAt: true,
      processingCompletedAt: true,
      postingStatus: true,
      postingReference: true,
      postingRemarks: true,
      postedAt: true,
      grandTotal: true,
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      department: {
        select: {
          name: true,
        },
      },
      postedByUser: {
        select: {
          firstName: true,
          lastName: true,
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
          itemCode: true,
          description: true,
          uom: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
          serveBatchItems: {
            select: {
              quantityServed: true,
            },
          },
        },
      },
      steps: {
        orderBy: {
          stepNumber: "asc",
        },
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
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
    },
  })

  if (!request) {
    return null
  }

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    series: request.series,
    requestType: request.requestType,
    requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
    requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
    departmentName: request.department.name,
    datePreparedLabel: toPhDateInputValue(request.datePrepared),
    dateRequiredLabel: toPhDateInputValue(request.dateRequired),
    approvedAtLabel: formatDateTime(request.approvedAt),
    submittedAtLabel: formatDateTime(request.submittedAt),
    processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
    postingStatus: normalizePostingStatus(request.postingStatus),
    postingReference: request.postingReference,
    postingRemarks: request.postingRemarks,
    postedAtLabel: formatDateTime(request.postedAt),
    postedByName: request.postedByUser
      ? `${request.postedByUser.firstName} ${request.postedByUser.lastName}`
      : null,
    grandTotal: Number(request.grandTotal),
    items: request.items.map((item) => {
      const servedQuantity = item.serveBatchItems.reduce((accumulator, servedEntry) => {
        return accumulator + Number(servedEntry.quantityServed)
      }, 0)
      const requestedQuantity = Number(item.quantity)

      return {
        id: item.id,
        lineNumber: item.lineNumber,
        source: item.source,
        itemCode: item.itemCode,
        description: item.description,
        uom: item.uom,
        quantity: requestedQuantity,
        servedQuantity,
        remainingQuantity: Math.max(0, requestedQuantity - servedQuantity),
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
        lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
        remarks: item.remarks,
      }
    }),
    approvalSteps: request.steps.map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      status: step.status,
      approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
      actedByName: step.actedByUser
        ? `${step.actedByUser.firstName} ${step.actedByUser.lastName}`
        : null,
      actedAtLabel: formatDateTime(step.actedAt),
      remarks: step.remarks,
    })),
  }
}
