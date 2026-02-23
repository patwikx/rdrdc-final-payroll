import {
  MaterialRequestPostingStatus,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  type Prisma,
} from "@prisma/client"
import type { MaterialRequestSeries } from "@prisma/client"

import { toPhDateInputValue, toPhDateOnlyUtc, toPhDayStartUtcInstant } from "@/lib/ph-time"
import { db } from "@/lib/db"
import type {
  EmployeePortalMaterialRequestDepartmentFlowPreview,
  EmployeePortalMaterialRequestDepartmentOption,
  EmployeePortalMaterialRequestApprovalReadModel,
  EmployeePortalMaterialRequestApprovalQueuePage,
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
  EmployeePortalMaterialRequestReceivingReportDetail,
  EmployeePortalMaterialRequestReceivingReportPage,
  EmployeePortalMaterialRequestReceivingReportRow,
  EmployeePortalMaterialRequestReceivingReportStatusFilter,
  EmployeePortalMaterialRequestKpiDashboard,
  EmployeePortalMaterialRequestKpiRange,
  EmployeePortalMaterialRequestKpiPurchaserRow,
  EmployeePortalMaterialRequestKpiDepartmentRow,
  EmployeePortalMaterialRequestKpiMonthRow,
  EmployeePortalMaterialRequestKpiApprovalStepRow,
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

const getElapsedDurationMs = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) {
    return null
  }

  const durationMs = end.getTime() - start.getTime()
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null
  }

  return durationMs
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
      requesterAcknowledgedAt: true,
      requiresReceiptAcknowledgment: true,
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
      receivingReports: {
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          reportNumber: true,
          receivedAt: true,
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
      requesterAcknowledgedByUser: {
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

  return requests.map((request) => {
    let previousDecisionAt: Date | null = request.submittedAt
    const approvalSteps = request.steps.map((step) => {
      const turnaroundTimeLabel = getElapsedTimeLabel(previousDecisionAt, step.actedAt)

      if (step.actedAt) {
        previousDecisionAt = step.actedAt
      }

      return {
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
        turnaroundTimeLabel,
      }
    })

    return {
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
      requesterAcknowledgedAtLabel: formatDateTime(request.requesterAcknowledgedAt),
      requesterAcknowledgedByName: request.requesterAcknowledgedByUser
        ? `${request.requesterAcknowledgedByUser.firstName} ${request.requesterAcknowledgedByUser.lastName}`
        : null,
      requiresReceiptAcknowledgment: request.requiresReceiptAcknowledgment,
      approvalLeadTimeLabel: getElapsedTimeLabel(request.submittedAt, request.approvedAt),
      purchaserQueueTimeLabel: getElapsedTimeLabel(request.approvedAt, request.processingStartedAt),
      purchaserProcessingTimeLabel: getElapsedTimeLabel(request.processingStartedAt, request.processingCompletedAt),
      fulfillmentLeadTimeLabel: getElapsedTimeLabel(request.submittedAt, request.processingCompletedAt),
      acknowledgmentLeadTimeLabel: getElapsedTimeLabel(request.processingCompletedAt, request.requesterAcknowledgedAt),
      receivingReportId: request.receivingReports[0]?.id ?? null,
      receivingReportNumber: request.receivingReports[0]?.reportNumber ?? null,
      receivingReportReceivedAtLabel: formatDateTime(request.receivingReports[0]?.receivedAt ?? null),
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
      approvalSteps,
    }
  })
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

export async function getEmployeePortalMaterialRequestDepartmentOptions(params: {
  companyId: string
}): Promise<EmployeePortalMaterialRequestDepartmentOption[]> {
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
  departmentId: string
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
    photoUrl: string | null
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
    requesterPhotoUrl: request.requesterEmployee.photoUrl,
    departmentId: request.departmentId,
    departmentName: request.department.name,
    datePreparedLabel: dateLabel.format(request.datePrepared),
    dateRequiredLabel: dateLabel.format(request.dateRequired),
    currentStep: request.currentStep ?? 1,
    requiredSteps: request.requiredSteps,
    grandTotal: Number(request.grandTotal.toString()),
    submittedAtLabel: formatDateTime(request.submittedAt),
  }
}

const buildMaterialRequestApprovalQueueWhere = (params: {
  companyId: string
  approverUserId: string
  search: string
  departmentId?: string
}): Prisma.MaterialRequestWhereInput => {
  const where: Prisma.MaterialRequestWhereInput = {
    companyId: params.companyId,
    status: MaterialRequestStatus.PENDING_APPROVAL,
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
  }

  const andFilters: Prisma.MaterialRequestWhereInput[] = []

  if (params.departmentId) {
    andFilters.push({
      departmentId: params.departmentId,
    })
  }

  const query = params.search.trim()
  if (query.length > 0) {
    andFilters.push({
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
      ],
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  return where
}

export async function getEmployeePortalMaterialRequestApprovalQueuePageReadModel(params: {
  companyId: string
  approverUserId: string
  page: number
  pageSize: number
  search: string
  departmentId?: string
}): Promise<EmployeePortalMaterialRequestApprovalQueuePage> {
  const where = buildMaterialRequestApprovalQueueWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, queueRequests] = await db.$transaction([
    db.materialRequest.count({
      where,
    }),
    db.materialRequest.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
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
        department: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  return {
    rows: queueRequests.map((request) => toQueueRow(request)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

type MaterialRequestApprovalHistoryStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"

const buildMaterialRequestApprovalHistoryWhere = (params: {
  companyId: string
  approverUserId: string
  isHR: boolean
  search: string
  status: MaterialRequestApprovalHistoryStatusFilter
  departmentId?: string
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

  if (params.departmentId) {
    where.departmentId = params.departmentId
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
    photoUrl: string | null
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
    requesterPhotoUrl: params.requesterEmployee.photoUrl,
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
  departmentId?: string
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
            photoUrl: true,
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
  const queuePromise = getEmployeePortalMaterialRequestApprovalQueuePageReadModel({
    companyId: params.companyId,
    approverUserId: params.approverUserId,
    page: 1,
    pageSize: 10,
    search: "",
    departmentId: undefined,
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

  const [queuePage, historyPage] = await Promise.all([queuePromise, historyPromise])

  return {
    rows: queuePage.rows,
    queueTotal: queuePage.total,
    queuePage: queuePage.page,
    queuePageSize: queuePage.pageSize,
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
  departmentId?: string
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

  if (params.departmentId) {
    where.departmentId = params.departmentId
  }

  if (params.status === "OPEN") {
    andConditions.push({
      OR: [
        {
          processingStatus: null,
        },
        {
          processingStatus: MaterialRequestProcessingStatus.PENDING_PURCHASER,
        },
        {
          processingStatus: MaterialRequestProcessingStatus.IN_PROGRESS,
        },
      ],
    })
  } else if (params.status === "PENDING_PURCHASER") {
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
    photoUrl: string | null
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
    requesterPhotoUrl: request.requesterEmployee.photoUrl,
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
  departmentId?: string
}): Promise<EmployeePortalMaterialRequestProcessingPage> {
  const where = buildMaterialRequestProcessingWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, requests] = await db.$transaction([
    db.materialRequest.count({ where }),
    db.materialRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { approvedAt: "desc" }, { requestNumber: "desc" }],
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
            photoUrl: true,
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
  departmentId?: string
}): Prisma.MaterialRequestWhereInput => {
  const andConditions: Prisma.MaterialRequestWhereInput[] = []
  const where: Prisma.MaterialRequestWhereInput = {
    companyId: params.companyId,
    status: MaterialRequestStatus.APPROVED,
    processingStatus: MaterialRequestProcessingStatus.COMPLETED,
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
    AND: andConditions,
  }

  if (params.departmentId) {
    where.departmentId = params.departmentId
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
    photoUrl: string | null
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
    requesterPhotoUrl: request.requesterEmployee.photoUrl,
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
  departmentId?: string
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
            photoUrl: true,
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

const buildMaterialRequestReceivingReportWhere = (params: {
  companyId: string
  search: string
  status: EmployeePortalMaterialRequestReceivingReportStatusFilter
  departmentId?: string
  requesterUserId?: string
}): Prisma.MaterialRequestReceivingReportWhereInput => {
  const andConditions: Prisma.MaterialRequestReceivingReportWhereInput[] = []
  const materialRequestWhere: Prisma.MaterialRequestWhereInput = {
    status: MaterialRequestStatus.APPROVED,
    processingStatus: MaterialRequestProcessingStatus.COMPLETED,
  }

  if (params.departmentId) {
    materialRequestWhere.departmentId = params.departmentId
  }

  if (params.requesterUserId) {
    materialRequestWhere.requesterUserId = params.requesterUserId
  }

  if (params.status === "PENDING_POSTING") {
    andConditions.push({
      OR: [
        {
          materialRequest: {
            postingStatus: null,
          },
        },
        {
          materialRequest: {
            postingStatus: MaterialRequestPostingStatus.PENDING_POSTING,
          },
        },
      ],
    })
  } else if (params.status === "POSTED") {
    andConditions.push({
      materialRequest: {
        postingStatus: MaterialRequestPostingStatus.POSTED,
      },
    })
  }

  const query = params.search.trim()
  if (query.length > 0) {
    andConditions.push({
      OR: [
        {
          reportNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          materialRequest: {
            requestNumber: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          materialRequest: {
            requesterEmployee: {
              firstName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          materialRequest: {
            requesterEmployee: {
              lastName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          materialRequest: {
            requesterEmployee: {
              employeeNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          materialRequest: {
            department: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    })
  }

  return {
    companyId: params.companyId,
    materialRequest: materialRequestWhere,
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  }
}

const toReceivingReportRow = (report: {
  id: string
  reportNumber: string
  receivedAt: Date
  receivedByUser: {
    firstName: string
    lastName: string
  }
  materialRequest: {
    id: string
    requestNumber: string
    datePrepared: Date
    dateRequired: Date
    processingCompletedAt: Date | null
    grandTotal: { toString(): string }
    postingStatus: MaterialRequestPostingStatus | null
    postingReference: string | null
    postedAt: Date | null
    requesterEmployee: {
      firstName: string
      lastName: string
      employeeNumber: string
      photoUrl: string | null
    }
    department: {
      name: string
    }
    _count: {
      items: number
    }
  }
}): EmployeePortalMaterialRequestReceivingReportRow => {
  return {
    id: report.id,
    materialRequestId: report.materialRequest.id,
    reportNumber: report.reportNumber,
    requestNumber: report.materialRequest.requestNumber,
    requesterName: `${report.materialRequest.requesterEmployee.firstName} ${report.materialRequest.requesterEmployee.lastName}`,
    requesterEmployeeNumber: report.materialRequest.requesterEmployee.employeeNumber,
    requesterPhotoUrl: report.materialRequest.requesterEmployee.photoUrl,
    departmentName: report.materialRequest.department.name,
    datePreparedLabel: dateLabel.format(report.materialRequest.datePrepared),
    dateRequiredLabel: dateLabel.format(report.materialRequest.dateRequired),
    processingCompletedAtLabel: formatDateTime(report.materialRequest.processingCompletedAt),
    receivedAtLabel: formatDateTime(report.receivedAt) ?? "-",
    receivedByName: `${report.receivedByUser.firstName} ${report.receivedByUser.lastName}`,
    itemCount: report.materialRequest._count.items,
    grandTotal: Number(report.materialRequest.grandTotal.toString()),
    postingStatus: normalizePostingStatus(report.materialRequest.postingStatus),
    postingReference: report.materialRequest.postingReference,
    postedAtLabel: formatDateTime(report.materialRequest.postedAt),
  }
}

export async function getEmployeePortalMaterialRequestReceivingReportPageReadModel(params: {
  companyId: string
  page: number
  pageSize: number
  search: string
  status: EmployeePortalMaterialRequestReceivingReportStatusFilter
  departmentId?: string
  requesterUserId?: string
}): Promise<EmployeePortalMaterialRequestReceivingReportPage> {
  const where = buildMaterialRequestReceivingReportWhere(params)
  const skip = (params.page - 1) * params.pageSize

  const [total, reports] = await db.$transaction([
    db.materialRequestReceivingReport.count({ where }),
    db.materialRequestReceivingReport.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: params.pageSize,
      select: {
        id: true,
        reportNumber: true,
        receivedAt: true,
        receivedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        materialRequest: {
          select: {
            id: true,
            requestNumber: true,
            datePrepared: true,
            dateRequired: true,
            processingCompletedAt: true,
            grandTotal: true,
            postingStatus: true,
            postingReference: true,
            postedAt: true,
            requesterEmployee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
                photoUrl: true,
              },
            },
            department: {
              select: {
                name: true,
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
          },
        },
      },
    }),
  ])

  return {
    rows: reports.map((report) => toReceivingReportRow(report)),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function getEmployeePortalMaterialRequestReceivingReportDetailReadModel(params: {
  companyId: string
  reportId: string
  requesterUserId?: string
}): Promise<EmployeePortalMaterialRequestReceivingReportDetail | null> {
  const report = await db.materialRequestReceivingReport.findFirst({
    where: {
      id: params.reportId,
      companyId: params.companyId,
      materialRequest: {
        ...(params.requesterUserId
          ? {
              requesterUserId: params.requesterUserId,
            }
          : {}),
        status: MaterialRequestStatus.APPROVED,
      },
    },
    select: {
      id: true,
      reportNumber: true,
      receivedAt: true,
      remarks: true,
      materialRequestId: true,
      receivedByUser: {
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
          itemCode: true,
          description: true,
          uom: true,
          requestedQuantity: true,
          receivedQuantity: true,
          unitPrice: true,
          lineTotal: true,
          remarks: true,
        },
      },
      materialRequest: {
        select: {
          requestNumber: true,
          series: true,
          requestType: true,
          datePrepared: true,
          dateRequired: true,
          submittedAt: true,
          approvedAt: true,
          processingCompletedAt: true,
          requesterAcknowledgedAt: true,
          postingStatus: true,
          postingReference: true,
          postedAt: true,
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
          postedByUser: {
            select: {
              firstName: true,
              lastName: true,
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
      },
    },
  })

  if (!report) {
    return null
  }

  return {
    id: report.id,
    materialRequestId: report.materialRequestId,
    reportNumber: report.reportNumber,
    requestNumber: report.materialRequest.requestNumber,
    series: report.materialRequest.series,
    requestType: report.materialRequest.requestType,
    requesterName: `${report.materialRequest.requesterEmployee.firstName} ${report.materialRequest.requesterEmployee.lastName}`,
    requesterEmployeeNumber: report.materialRequest.requesterEmployee.employeeNumber,
    departmentName: report.materialRequest.department.name,
    datePreparedLabel: toPhDateInputValue(report.materialRequest.datePrepared),
    dateRequiredLabel: toPhDateInputValue(report.materialRequest.dateRequired),
    submittedAtLabel: formatDateTime(report.materialRequest.submittedAt),
    approvedAtLabel: formatDateTime(report.materialRequest.approvedAt),
    processingCompletedAtLabel: formatDateTime(report.materialRequest.processingCompletedAt),
    requesterAcknowledgedAtLabel: formatDateTime(report.materialRequest.requesterAcknowledgedAt),
    receivedAtLabel: formatDateTime(report.receivedAt) ?? "-",
    receivedByName: `${report.receivedByUser.firstName} ${report.receivedByUser.lastName}`,
    remarks: report.remarks,
    postingStatus: normalizePostingStatus(report.materialRequest.postingStatus),
    postingReference: report.materialRequest.postingReference,
    postedAtLabel: formatDateTime(report.materialRequest.postedAt),
    postedByName: report.materialRequest.postedByUser
      ? `${report.materialRequest.postedByUser.firstName} ${report.materialRequest.postedByUser.lastName}`
      : null,
    subTotal: Number(report.materialRequest.subTotal),
    freight: Number(report.materialRequest.freight),
    discount: Number(report.materialRequest.discount),
    grandTotal: Number(report.materialRequest.grandTotal),
    purpose: report.materialRequest.purpose,
    requestRemarks: report.materialRequest.remarks,
    items: report.items.map((item) => ({
      id: item.id,
      lineNumber: item.lineNumber,
      itemCode: item.itemCode,
      description: item.description,
      uom: item.uom,
      requestedQuantity: Number(item.requestedQuantity),
      receivedQuantity: Number(item.receivedQuantity),
      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
      lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
      remarks: item.remarks,
    })),
    approvalSteps: report.materialRequest.steps.map((step) => ({
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

const KPI_RANGE_OPTIONS: EmployeePortalMaterialRequestKpiRange[] = [
  "LAST_30_DAYS",
  "LAST_90_DAYS",
  "LAST_180_DAYS",
  "YTD",
  "ALL",
]

const KPI_SLA_TARGET_HOURS = {
  approval: 24,
  queue: 24,
  processing: 72,
  fulfillment: 120,
} as const

const PH_MONTH_KEY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Manila",
})

const PH_MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const toPhMonthKey = (value: Date): string => {
  const parts = PH_MONTH_KEY_FORMATTER.formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  return `${year}-${month}`
}

const toAverageDuration = (sumMs: number, count: number): number | null => {
  if (count <= 0) {
    return null
  }

  return Math.round(sumMs / count)
}

const toKpiRangeStartDateOnlyUtc = (range: EmployeePortalMaterialRequestKpiRange): Date | null => {
  if (range === "ALL") {
    return null
  }

  const todayPhDateOnlyUtc = toPhDateOnlyUtc(new Date())

  if (range === "YTD") {
    return new Date(Date.UTC(todayPhDateOnlyUtc.getUTCFullYear(), 0, 1))
  }

  const startDate = new Date(todayPhDateOnlyUtc.getTime())
  const daysBack = range === "LAST_30_DAYS" ? 29 : range === "LAST_90_DAYS" ? 89 : 179
  startDate.setUTCDate(startDate.getUTCDate() - daysBack)
  return startDate
}

export async function getEmployeePortalMaterialRequestKpiDashboardReadModel(params: {
  companyId: string
  range: EmployeePortalMaterialRequestKpiRange
  requesterUserId?: string
}): Promise<EmployeePortalMaterialRequestKpiDashboard> {
  const normalizedRange = KPI_RANGE_OPTIONS.includes(params.range) ? params.range : "LAST_90_DAYS"
  const rangeStartDateOnlyUtc = toKpiRangeStartDateOnlyUtc(normalizedRange)
  const rangeStartInstant = rangeStartDateOnlyUtc
    ? toPhDayStartUtcInstant(toPhDateInputValue(rangeStartDateOnlyUtc))
    : null

  const where: Prisma.MaterialRequestWhereInput = {
    companyId: params.companyId,
    submittedAt: rangeStartInstant
      ? {
          not: null,
          gte: rangeStartInstant,
        }
      : {
          not: null,
        },
  }

  if (params.requesterUserId) {
    where.requesterUserId = params.requesterUserId
  }

  const requests = await db.materialRequest.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }],
    select: {
      id: true,
      status: true,
      processingStatus: true,
      submittedAt: true,
      approvedAt: true,
      processingStartedAt: true,
      processingCompletedAt: true,
      requesterAcknowledgedAt: true,
      departmentId: true,
      department: {
        select: {
          name: true,
        },
      },
      processedByUserId: true,
      processedByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      steps: {
        orderBy: [{ stepNumber: "asc" }],
        select: {
          stepNumber: true,
          stepName: true,
          actedAt: true,
        },
      },
    },
  })

  const HOUR_MS = 60 * 60 * 1000

  let approvalSumMs = 0
  let approvalCount = 0
  let queueSumMs = 0
  let queueCount = 0
  let processingSumMs = 0
  let processingCount = 0
  let fulfillmentSumMs = 0
  let fulfillmentCount = 0
  let acknowledgmentSumMs = 0
  let acknowledgmentCount = 0

  let completedRequests = 0
  let pendingApprovalRequests = 0
  let inProgressProcessingRequests = 0

  let approvalSlaBreachCount = 0
  let queueSlaBreachCount = 0
  let processingSlaBreachCount = 0
  let fulfillmentSlaBreachCount = 0

  const purchaserMap = new Map<string, {
    purchaserKey: string
    purchaserName: string
    requestCount: number
    completedCount: number
    queueSumMs: number
    queueCount: number
    processingSumMs: number
    processingCount: number
    fulfillmentSumMs: number
    fulfillmentCount: number
  }>()

  const departmentMap = new Map<string, {
    departmentId: string
    departmentName: string
    requestCount: number
    completedCount: number
    approvalSumMs: number
    approvalCount: number
    queueSumMs: number
    queueCount: number
    processingSumMs: number
    processingCount: number
    fulfillmentSumMs: number
    fulfillmentCount: number
  }>()

  const monthMap = new Map<string, {
    monthKey: string
    monthLabel: string
    requestCount: number
    approvedCount: number
    completedCount: number
    approvalSumMs: number
    approvalCount: number
    processingSumMs: number
    processingCount: number
    fulfillmentSumMs: number
    fulfillmentCount: number
  }>()

  const stepMap = new Map<number, {
    stepNumber: number
    stepName: string
    actedCount: number
    turnaroundSumMs: number
    turnaroundCount: number
  }>()

  for (const request of requests) {
    if (!request.submittedAt) {
      continue
    }

    if (request.status === MaterialRequestStatus.PENDING_APPROVAL) {
      pendingApprovalRequests += 1
    }

    if (request.processingStatus === MaterialRequestProcessingStatus.IN_PROGRESS) {
      inProgressProcessingRequests += 1
    }

    if (request.processingCompletedAt) {
      completedRequests += 1
    }

    const approvalMs = getElapsedDurationMs(request.submittedAt, request.approvedAt)
    if (approvalMs !== null) {
      approvalSumMs += approvalMs
      approvalCount += 1
      if (approvalMs > KPI_SLA_TARGET_HOURS.approval * HOUR_MS) {
        approvalSlaBreachCount += 1
      }
    }

    const queueMs = getElapsedDurationMs(request.approvedAt, request.processingStartedAt)
    if (queueMs !== null) {
      queueSumMs += queueMs
      queueCount += 1
      if (queueMs > KPI_SLA_TARGET_HOURS.queue * HOUR_MS) {
        queueSlaBreachCount += 1
      }
    }

    const processingMs = getElapsedDurationMs(request.processingStartedAt, request.processingCompletedAt)
    if (processingMs !== null) {
      processingSumMs += processingMs
      processingCount += 1
      if (processingMs > KPI_SLA_TARGET_HOURS.processing * HOUR_MS) {
        processingSlaBreachCount += 1
      }
    }

    const fulfillmentMs = getElapsedDurationMs(request.submittedAt, request.processingCompletedAt)
    if (fulfillmentMs !== null) {
      fulfillmentSumMs += fulfillmentMs
      fulfillmentCount += 1
      if (fulfillmentMs > KPI_SLA_TARGET_HOURS.fulfillment * HOUR_MS) {
        fulfillmentSlaBreachCount += 1
      }
    }

    const acknowledgmentMs = getElapsedDurationMs(request.processingCompletedAt, request.requesterAcknowledgedAt)
    if (acknowledgmentMs !== null) {
      acknowledgmentSumMs += acknowledgmentMs
      acknowledgmentCount += 1
    }

    const purchaserKey = request.processedByUserId ?? "__UNASSIGNED__"
    const purchaserName = request.processedByUser
      ? `${request.processedByUser.firstName} ${request.processedByUser.lastName}`
      : "Unassigned"

    const existingPurchaser = purchaserMap.get(purchaserKey)
    if (existingPurchaser) {
      existingPurchaser.requestCount += 1
      if (request.processingCompletedAt) {
        existingPurchaser.completedCount += 1
      }
      if (queueMs !== null) {
        existingPurchaser.queueSumMs += queueMs
        existingPurchaser.queueCount += 1
      }
      if (processingMs !== null) {
        existingPurchaser.processingSumMs += processingMs
        existingPurchaser.processingCount += 1
      }
      if (fulfillmentMs !== null) {
        existingPurchaser.fulfillmentSumMs += fulfillmentMs
        existingPurchaser.fulfillmentCount += 1
      }
    } else {
      purchaserMap.set(purchaserKey, {
        purchaserKey,
        purchaserName,
        requestCount: 1,
        completedCount: request.processingCompletedAt ? 1 : 0,
        queueSumMs: queueMs ?? 0,
        queueCount: queueMs !== null ? 1 : 0,
        processingSumMs: processingMs ?? 0,
        processingCount: processingMs !== null ? 1 : 0,
        fulfillmentSumMs: fulfillmentMs ?? 0,
        fulfillmentCount: fulfillmentMs !== null ? 1 : 0,
      })
    }

    const existingDepartment = departmentMap.get(request.departmentId)
    if (existingDepartment) {
      existingDepartment.requestCount += 1
      if (request.processingCompletedAt) {
        existingDepartment.completedCount += 1
      }
      if (approvalMs !== null) {
        existingDepartment.approvalSumMs += approvalMs
        existingDepartment.approvalCount += 1
      }
      if (queueMs !== null) {
        existingDepartment.queueSumMs += queueMs
        existingDepartment.queueCount += 1
      }
      if (processingMs !== null) {
        existingDepartment.processingSumMs += processingMs
        existingDepartment.processingCount += 1
      }
      if (fulfillmentMs !== null) {
        existingDepartment.fulfillmentSumMs += fulfillmentMs
        existingDepartment.fulfillmentCount += 1
      }
    } else {
      departmentMap.set(request.departmentId, {
        departmentId: request.departmentId,
        departmentName: request.department.name,
        requestCount: 1,
        completedCount: request.processingCompletedAt ? 1 : 0,
        approvalSumMs: approvalMs ?? 0,
        approvalCount: approvalMs !== null ? 1 : 0,
        queueSumMs: queueMs ?? 0,
        queueCount: queueMs !== null ? 1 : 0,
        processingSumMs: processingMs ?? 0,
        processingCount: processingMs !== null ? 1 : 0,
        fulfillmentSumMs: fulfillmentMs ?? 0,
        fulfillmentCount: fulfillmentMs !== null ? 1 : 0,
      })
    }

    const monthKey = toPhMonthKey(request.submittedAt)
    const existingMonth = monthMap.get(monthKey)
    if (existingMonth) {
      existingMonth.requestCount += 1
      if (request.approvedAt) {
        existingMonth.approvedCount += 1
      }
      if (request.processingCompletedAt) {
        existingMonth.completedCount += 1
      }
      if (approvalMs !== null) {
        existingMonth.approvalSumMs += approvalMs
        existingMonth.approvalCount += 1
      }
      if (processingMs !== null) {
        existingMonth.processingSumMs += processingMs
        existingMonth.processingCount += 1
      }
      if (fulfillmentMs !== null) {
        existingMonth.fulfillmentSumMs += fulfillmentMs
        existingMonth.fulfillmentCount += 1
      }
    } else {
      monthMap.set(monthKey, {
        monthKey,
        monthLabel: PH_MONTH_LABEL_FORMATTER.format(request.submittedAt),
        requestCount: 1,
        approvedCount: request.approvedAt ? 1 : 0,
        completedCount: request.processingCompletedAt ? 1 : 0,
        approvalSumMs: approvalMs ?? 0,
        approvalCount: approvalMs !== null ? 1 : 0,
        processingSumMs: processingMs ?? 0,
        processingCount: processingMs !== null ? 1 : 0,
        fulfillmentSumMs: fulfillmentMs ?? 0,
        fulfillmentCount: fulfillmentMs !== null ? 1 : 0,
      })
    }

    let previousStepActedAt: Date | null = request.submittedAt
    for (const step of request.steps) {
      if (!step.actedAt) {
        continue
      }

      const turnaroundMs = getElapsedDurationMs(previousStepActedAt, step.actedAt)
      const normalizedStepName = normalizeStepName(step.stepName, step.stepNumber)
      const existingStep = stepMap.get(step.stepNumber)

      if (existingStep) {
        existingStep.stepName = normalizedStepName
        existingStep.actedCount += 1
        if (turnaroundMs !== null) {
          existingStep.turnaroundSumMs += turnaroundMs
          existingStep.turnaroundCount += 1
        }
      } else {
        stepMap.set(step.stepNumber, {
          stepNumber: step.stepNumber,
          stepName: normalizedStepName,
          actedCount: 1,
          turnaroundSumMs: turnaroundMs ?? 0,
          turnaroundCount: turnaroundMs !== null ? 1 : 0,
        })
      }

      previousStepActedAt = step.actedAt
    }
  }

  const byPurchaser: EmployeePortalMaterialRequestKpiPurchaserRow[] = Array.from(purchaserMap.values())
    .map((entry) => ({
      purchaserKey: entry.purchaserKey,
      purchaserName: entry.purchaserName,
      requestCount: entry.requestCount,
      completedCount: entry.completedCount,
      avgQueueTimeMs: toAverageDuration(entry.queueSumMs, entry.queueCount),
      avgProcessingTimeMs: toAverageDuration(entry.processingSumMs, entry.processingCount),
      avgFulfillmentTimeMs: toAverageDuration(entry.fulfillmentSumMs, entry.fulfillmentCount),
    }))
    .sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount
      }

      if (b.requestCount !== a.requestCount) {
        return b.requestCount - a.requestCount
      }

      return a.purchaserName.localeCompare(b.purchaserName)
    })

  const byDepartment: EmployeePortalMaterialRequestKpiDepartmentRow[] = Array.from(departmentMap.values())
    .map((entry) => ({
      departmentId: entry.departmentId,
      departmentName: entry.departmentName,
      requestCount: entry.requestCount,
      completedCount: entry.completedCount,
      avgApprovalTimeMs: toAverageDuration(entry.approvalSumMs, entry.approvalCount),
      avgQueueTimeMs: toAverageDuration(entry.queueSumMs, entry.queueCount),
      avgProcessingTimeMs: toAverageDuration(entry.processingSumMs, entry.processingCount),
      avgFulfillmentTimeMs: toAverageDuration(entry.fulfillmentSumMs, entry.fulfillmentCount),
    }))
    .sort((a, b) => {
      if (b.requestCount !== a.requestCount) {
        return b.requestCount - a.requestCount
      }

      return a.departmentName.localeCompare(b.departmentName)
    })

  const byMonth: EmployeePortalMaterialRequestKpiMonthRow[] = Array.from(monthMap.values())
    .map((entry) => ({
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel,
      requestCount: entry.requestCount,
      approvedCount: entry.approvedCount,
      completedCount: entry.completedCount,
      avgApprovalTimeMs: toAverageDuration(entry.approvalSumMs, entry.approvalCount),
      avgProcessingTimeMs: toAverageDuration(entry.processingSumMs, entry.processingCount),
      avgFulfillmentTimeMs: toAverageDuration(entry.fulfillmentSumMs, entry.fulfillmentCount),
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))

  const byApprovalStep: EmployeePortalMaterialRequestKpiApprovalStepRow[] = Array.from(stepMap.values())
    .map((entry) => ({
      stepNumber: entry.stepNumber,
      stepName: entry.stepName,
      actedCount: entry.actedCount,
      avgTurnaroundTimeMs: toAverageDuration(entry.turnaroundSumMs, entry.turnaroundCount),
    }))
    .sort((a, b) => a.stepNumber - b.stepNumber)

  return {
    range: normalizedRange,
    startDateLabel: rangeStartDateOnlyUtc ? dateLabel.format(rangeStartDateOnlyUtc) : null,
    endDateLabel: dateLabel.format(new Date()),
    slaTargetsHours: KPI_SLA_TARGET_HOURS,
    overview: {
      totalSubmittedRequests: requests.length,
      completedRequests,
      pendingApprovalRequests,
      inProgressProcessingRequests,
      avgApprovalLeadTimeMs: toAverageDuration(approvalSumMs, approvalCount),
      avgPurchaserQueueTimeMs: toAverageDuration(queueSumMs, queueCount),
      avgPurchaserProcessingTimeMs: toAverageDuration(processingSumMs, processingCount),
      avgFulfillmentLeadTimeMs: toAverageDuration(fulfillmentSumMs, fulfillmentCount),
      avgAcknowledgmentLeadTimeMs: toAverageDuration(acknowledgmentSumMs, acknowledgmentCount),
      approvalSlaBreachCount,
      queueSlaBreachCount,
      processingSlaBreachCount,
      fulfillmentSlaBreachCount,
    },
    byPurchaser,
    byDepartment,
    byMonth,
    byApprovalStep,
  }
}
