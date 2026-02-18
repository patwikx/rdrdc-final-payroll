"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
} from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDateInputValue } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { sendMaterialRequestPurchaserQueueEmail } from "@/modules/notifications/utils/request-approval-email"
import {
  decideMaterialRequestStepInputSchema,
  getMaterialRequestApprovalDecisionDetailsInputSchema,
  getMaterialRequestApprovalHistoryDetailsInputSchema,
  getMaterialRequestApprovalHistoryPageInputSchema,
  getMaterialRequestsForMyApprovalInputSchema,
  type DecideMaterialRequestStepInput,
  type GetMaterialRequestApprovalDecisionDetailsInput,
  type GetMaterialRequestApprovalHistoryDetailsInput,
  type GetMaterialRequestApprovalHistoryPageInput,
  type GetMaterialRequestsForMyApprovalInput,
} from "@/modules/material-requests/schemas/material-request-approval-actions-schema"
import type {
  EmployeePortalMaterialRequestApprovalDecisionDetail,
  EmployeePortalMaterialRequestApprovalHistoryDetail,
  EmployeePortalMaterialRequestApprovalHistoryPage,
} from "@/modules/material-requests/types/employee-portal-material-request-types"
import { getEmployeePortalMaterialRequestApprovalHistoryPageReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import type {
  MaterialRequestActionDataResult,
  MaterialRequestActionResult,
} from "@/modules/material-requests/types/material-request-action-result"

type MaterialRequestApprovalQueueRow = {
  id: string
  requestNumber: string
  requesterEmployeeId: string
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  currentStep: number
  requiredSteps: number
  datePrepared: Date
  dateRequired: Date
  grandTotal: number
  submittedAt: Date | null
}

type MaterialRequestApprovalQueueData = {
  rows: MaterialRequestApprovalQueueRow[]
  total: number
  page: number
  pageSize: number
}

const createMaterialApprovalRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/employee-portal/material-request-approvals`,
    `/${companyId}/employee-portal/material-request-processing`,
    `/${companyId}/employee-portal/approvers`,
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/dashboard`,
  ]
}

const revalidateMaterialApprovalPaths = (companyId: string): void => {
  for (const path of createMaterialApprovalRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

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

const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

type MaterialRequestPurchaserRecipient = {
  userId: string
  name: string
  email: string
}

const MATERIAL_REQUEST_PURCHASER_NOTIFY_REASON = "MATERIAL_REQUEST_NOTIFY_PURCHASER_QUEUE"
const MATERIAL_REQUEST_PURCHASER_NOTIFY_SKIPPED_REASON = "MATERIAL_REQUEST_NOTIFY_PURCHASER_QUEUE_SKIPPED_NO_RECIPIENTS"

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toRequestTypeLabel = (value: string): string => value.replaceAll("_", " ")

const resolveMaterialRequestPurchaserRecipients = async (
  companyId: string
): Promise<MaterialRequestPurchaserRecipient[]> => {
  const purchaserAccessRows = await db.userCompanyAccess.findMany({
    where: {
      companyId,
      isActive: true,
      isMaterialRequestPurchaser: true,
      user: { isActive: true },
    },
    select: {
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          employee: {
            select: {
              emails: {
                where: { isActive: true },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                select: { email: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  const seenEmails = new Set<string>()
  const recipients: MaterialRequestPurchaserRecipient[] = []

  for (const row of purchaserAccessRows) {
    const resolvedEmail = (row.user.employee?.emails[0]?.email ?? row.user.email ?? "").trim().toLowerCase()
    if (resolvedEmail.length === 0 || seenEmails.has(resolvedEmail)) {
      continue
    }

    seenEmails.add(resolvedEmail)
    const fullName = `${row.user.firstName} ${row.user.lastName}`.trim()
    recipients.push({
      userId: row.userId,
      email: resolvedEmail,
      name: fullName.length > 0 ? fullName : resolvedEmail,
    })
  }

  return recipients
}

export async function getMaterialRequestsForMyApprovalAction(
  input: GetMaterialRequestsForMyApprovalInput
): Promise<MaterialRequestActionDataResult<MaterialRequestApprovalQueueData>> {
  const parsed = getMaterialRequestsForMyApprovalInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval queue payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const actionableQueueWhere = {
    companyId: context.companyId,
    status: MaterialRequestStatus.PENDING_APPROVAL,
    OR: [1, 2, 3, 4].map((stepNumber) => ({
      currentStep: stepNumber,
      steps: {
        some: {
          approverUserId: context.userId,
          status: MaterialRequestStepStatus.PENDING,
          stepNumber,
        },
      },
    })),
  }

  const skip = (payload.page - 1) * payload.pageSize
  const [total, queueRequests] = await db.$transaction([
    db.materialRequest.count({
      where: actionableQueueWhere,
    }),
    db.materialRequest.findMany({
      where: actionableQueueWhere,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: payload.pageSize,
      include: {
        requesterEmployee: {
          select: {
            id: true,
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
      },
    }),
  ])

  const rows = queueRequests.map<MaterialRequestApprovalQueueRow>((request) => ({
      id: request.id,
      requestNumber: request.requestNumber,
      requesterEmployeeId: request.requesterEmployee.id,
      requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
      requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
      departmentName: request.department.name,
      currentStep: request.currentStep ?? 1,
      requiredSteps: request.requiredSteps,
      datePrepared: request.datePrepared,
      dateRequired: request.dateRequired,
      grandTotal: Number(request.grandTotal),
      submittedAt: request.submittedAt,
    }))

  return {
    ok: true,
    data: {
      rows,
      total,
      page: payload.page,
      pageSize: payload.pageSize,
    },
  }
}

export async function getMaterialRequestApprovalHistoryPageAction(
  input: GetMaterialRequestApprovalHistoryPageInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestApprovalHistoryPage>> {
  const parsed = getMaterialRequestApprovalHistoryPageInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval history payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  const historyPage = await getEmployeePortalMaterialRequestApprovalHistoryPageReadModel({
    companyId: context.companyId,
    approverUserId: context.userId,
    isHR: isHrRole(companyRole),
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    departmentId: payload.departmentId,
  })

  return {
    ok: true,
    data: historyPage,
  }
}

export async function getMaterialRequestApprovalDecisionDetailsAction(
  input: GetMaterialRequestApprovalDecisionDetailsInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestApprovalDecisionDetail>> {
  const parsed = getMaterialRequestApprovalDecisionDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request detail payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: MaterialRequestStatus.PENDING_APPROVAL,
      steps: {
        some: {
          approverUserId: context.userId,
          status: MaterialRequestStepStatus.PENDING,
        },
      },
    },
    select: {
      id: true,
      requestNumber: true,
      currentStep: true,
      requiredSteps: true,
      datePrepared: true,
      dateRequired: true,
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
      steps: {
        where: {
          approverUserId: context.userId,
          status: MaterialRequestStepStatus.PENDING,
        },
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Material request not found or no longer pending approval." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: request.currentStep,
    steps: request.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to review this request at the current step." }
  }

  const skip = (payload.page - 1) * payload.pageSize
  const [totalItems, items] = await db.$transaction([
    db.materialRequestItem.count({
      where: {
        materialRequestId: request.id,
      },
    }),
    db.materialRequestItem.findMany({
      where: {
        materialRequestId: request.id,
      },
      orderBy: {
        lineNumber: "asc",
      },
      skip,
      take: payload.pageSize,
      select: {
        id: true,
        lineNumber: true,
        itemCode: true,
        description: true,
        uom: true,
        quantity: true,
        unitPrice: true,
        lineTotal: true,
        remarks: true,
      },
    }),
  ])

  return {
    ok: true,
    data: {
      id: request.id,
      requestNumber: request.requestNumber,
      requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
      requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
      departmentName: request.department.name,
      currentStep: request.currentStep ?? 1,
      requiredSteps: request.requiredSteps,
      datePreparedLabel: toPhDateInputValue(request.datePrepared),
      dateRequiredLabel: toPhDateInputValue(request.dateRequired),
      grandTotal: Number(request.grandTotal),
      totalItems,
      page: payload.page,
      pageSize: payload.pageSize,
      items: items.map((item) => ({
        id: item.id,
        lineNumber: item.lineNumber,
        itemCode: item.itemCode,
        description: item.description,
        uom: item.uom,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
        lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
        remarks: item.remarks,
      })),
    },
  }
}

export async function getMaterialRequestApprovalHistoryDetailsAction(
  input: GetMaterialRequestApprovalHistoryDetailsInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestApprovalHistoryDetail>> {
  const parsed = getMaterialRequestApprovalHistoryDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid history detail payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const canViewAnyHistory = isHrRole(companyRole)

  const request = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      ...(canViewAnyHistory
        ? {
            status: {
              in: [MaterialRequestStatus.APPROVED, MaterialRequestStatus.REJECTED],
            },
          }
        : {
            steps: {
              some: {
                actedByUserId: context.userId,
                actedAt: {
                  not: null,
                },
              },
            },
          }),
    },
    select: {
      id: true,
      requestNumber: true,
      series: true,
      requestType: true,
      status: true,
      datePrepared: true,
      dateRequired: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      currentStep: true,
      requiredSteps: true,
      subTotal: true,
      freight: true,
      discount: true,
      grandTotal: true,
      purpose: true,
      remarks: true,
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

  if (!request) {
    return { ok: false, error: "History detail not found or you are not allowed to view it." }
  }

  return {
    ok: true,
    data: {
      id: request.id,
      requestNumber: request.requestNumber,
      series: request.series,
      requestType: request.requestType,
      status: request.status,
      requesterName: `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`,
      requesterEmployeeNumber: request.requesterEmployee.employeeNumber,
      departmentName: request.department.name,
      datePreparedLabel: toPhDateInputValue(request.datePrepared),
      dateRequiredLabel: toPhDateInputValue(request.dateRequired),
      submittedAtLabel: formatDateTime(request.submittedAt),
      approvedAtLabel: formatDateTime(request.approvedAt),
      rejectedAtLabel: formatDateTime(request.rejectedAt),
      currentStep: request.currentStep,
      requiredSteps: request.requiredSteps,
      subTotal: Number(request.subTotal),
      freight: Number(request.freight),
      discount: Number(request.discount),
      grandTotal: Number(request.grandTotal),
      purpose: request.purpose,
      remarks: request.remarks,
      finalDecisionRemarks: request.finalDecisionRemarks,
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
        stepName: step.stepName,
        status: step.status,
        approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
        actedByName: step.actedByUser
          ? `${step.actedByUser.firstName} ${step.actedByUser.lastName}`
          : null,
        actedAtLabel: formatDateTime(step.actedAt),
        remarks: step.remarks,
      })),
    },
  }
}

const getPendingStepForActor = (params: {
  currentStep: number | null
  steps: Array<{
    id: string
    stepNumber: number
    stepName: string | null
    approverUserId: string
    status: MaterialRequestStepStatus
  }>
  actorUserId: string
}): {
  id: string
  stepNumber: number
  stepName: string | null
  approverUserId: string
  status: MaterialRequestStepStatus
} | null => {
  if (!params.currentStep) {
    return null
  }

  return (
    params.steps.find(
      (step) =>
        step.stepNumber === params.currentStep &&
        step.approverUserId === params.actorUserId &&
        step.status === MaterialRequestStepStatus.PENDING
    ) ?? null
  )
}

export async function approveMaterialRequestStepAction(
  input: DecideMaterialRequestStepInput
): Promise<MaterialRequestActionResult> {
  const parsed = decideMaterialRequestStepInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const materialRequest = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: MaterialRequestStatus.PENDING_APPROVAL,
    },
    select: {
      id: true,
      requestNumber: true,
      currentStep: true,
      requiredSteps: true,
      status: true,
      requestType: true,
      datePrepared: true,
      dateRequired: true,
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
      steps: {
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!materialRequest) {
    return { ok: false, error: "Material request not found or no longer pending approval." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: materialRequest.currentStep,
    steps: materialRequest.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to approve this request at the current step." }
  }

  const actedAt = new Date()
  const remarks = payload.remarks?.trim() || null
  const isFinalStep = actorStep.stepNumber >= materialRequest.requiredSteps

  try {
    await db.$transaction(async (tx) => {
      const stepUpdate = await tx.materialRequestApprovalStep.updateMany({
        where: {
          id: actorStep.id,
          status: MaterialRequestStepStatus.PENDING,
        },
        data: {
          status: MaterialRequestStepStatus.APPROVED,
          actedAt,
          actedByUserId: context.userId,
          remarks,
        },
      })

      if (stepUpdate.count !== 1) {
        throw new Error("The approval step is no longer pending.")
      }

      await tx.materialRequestApprovalStep.updateMany({
        where: {
          materialRequestId: materialRequest.id,
          stepNumber: actorStep.stepNumber,
          status: MaterialRequestStepStatus.PENDING,
          id: {
            not: actorStep.id,
          },
        },
        data: {
          status: MaterialRequestStepStatus.SKIPPED,
          actedAt,
          actedByUserId: context.userId,
          remarks: "Skipped after step approval",
        },
      })

      if (isFinalStep) {
        const finalizedUpdate = await tx.materialRequest.updateMany({
          where: {
            id: materialRequest.id,
            status: MaterialRequestStatus.PENDING_APPROVAL,
            currentStep: actorStep.stepNumber,
          },
          data: {
            status: MaterialRequestStatus.APPROVED,
            approvedAt: actedAt,
            processingStatus: MaterialRequestProcessingStatus.PENDING_PURCHASER,
            processingStartedAt: null,
            processingCompletedAt: null,
            processedByUserId: null,
            finalDecisionByUserId: context.userId,
            finalDecisionRemarks: remarks,
            currentStep: actorStep.stepNumber,
          },
        })

        if (finalizedUpdate.count !== 1) {
          throw new Error("The request state changed while processing the approval.")
        }
      } else {
        const nextStep = actorStep.stepNumber + 1
        const advancedUpdate = await tx.materialRequest.updateMany({
          where: {
            id: materialRequest.id,
            status: MaterialRequestStatus.PENDING_APPROVAL,
            currentStep: actorStep.stepNumber,
          },
          data: {
            currentStep: nextStep,
          },
        })

        if (advancedUpdate.count !== 1) {
          throw new Error("The request state changed while advancing to the next step.")
        }
      }

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: materialRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: isFinalStep ? "APPROVE_MATERIAL_REQUEST_FINAL_STEP" : "APPROVE_MATERIAL_REQUEST_STEP",
          changes: [
            {
              fieldName: "currentStep",
              oldValue: materialRequest.currentStep,
              newValue: isFinalStep ? actorStep.stepNumber : actorStep.stepNumber + 1,
            },
            {
              fieldName: "status",
              oldValue: materialRequest.status,
              newValue: isFinalStep ? MaterialRequestStatus.APPROVED : MaterialRequestStatus.PENDING_APPROVAL,
            },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to approve material request: ${message}` }
  }

  revalidateMaterialApprovalPaths(context.companyId)

  if (isFinalStep) {
    const existingNotificationMarker = await db.auditLog.findFirst({
      where: {
        tableName: "MaterialRequest",
        recordId: materialRequest.id,
        reason: {
          in: [
            MATERIAL_REQUEST_PURCHASER_NOTIFY_REASON,
            MATERIAL_REQUEST_PURCHASER_NOTIFY_SKIPPED_REASON,
          ],
        },
      },
      select: {
        id: true,
      },
    })

    if (!existingNotificationMarker) {
      const recipients = await resolveMaterialRequestPurchaserRecipients(context.companyId)

      if (recipients.length === 0) {
        await createAuditLog({
          tableName: "MaterialRequest",
          recordId: materialRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: MATERIAL_REQUEST_PURCHASER_NOTIFY_SKIPPED_REASON,
          changes: [{ fieldName: "notificationTargetCount", newValue: "0" }],
        })
      } else {
        const sendResult = await sendMaterialRequestPurchaserQueueEmail({
          recipients,
          companyName: context.companyName,
          requestNumber: materialRequest.requestNumber,
          requesterName: `${materialRequest.requesterEmployee.firstName} ${materialRequest.requesterEmployee.lastName}`,
          requesterEmployeeNumber: materialRequest.requesterEmployee.employeeNumber,
          departmentName: materialRequest.department.name,
          requestTypeLabel: toRequestTypeLabel(materialRequest.requestType),
          datePreparedLabel: toPhDateInputValue(materialRequest.datePrepared),
          dateRequiredLabel: toPhDateInputValue(materialRequest.dateRequired),
          amountLabel: `PHP ${currency.format(Number(materialRequest.grandTotal))}`,
          approvalPath: `/${context.companyId}/employee-portal/material-request-processing`,
        })

        await createAuditLog({
          tableName: "MaterialRequest",
          recordId: materialRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: MATERIAL_REQUEST_PURCHASER_NOTIFY_REASON,
          changes: [
            { fieldName: "notificationTargetCount", newValue: String(recipients.length) },
            { fieldName: "notificationSentCount", newValue: String(sendResult.sentCount) },
            { fieldName: "notificationFailedCount", newValue: String(sendResult.failedCount) },
          ],
        })

        if (sendResult.failedCount > 0) {
          console.error("[approveMaterialRequestStepAction] Purchaser queue notification failed for some recipients", {
            companyId: context.companyId,
            requestId: materialRequest.id,
            requestNumber: materialRequest.requestNumber,
            failedRecipients: sendResult.failedRecipients,
          })
        }
      }
    }
  }

  return {
    ok: true,
    message: isFinalStep
      ? `Material request ${materialRequest.requestNumber} approved.`
      : `${actorStep.stepName?.trim() || `Step ${actorStep.stepNumber}`} approved. Material request ${materialRequest.requestNumber} moved to next step.`,
  }
}

export async function rejectMaterialRequestStepAction(
  input: DecideMaterialRequestStepInput
): Promise<MaterialRequestActionResult> {
  const parsed = decideMaterialRequestStepInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rejection payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const materialRequest = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: MaterialRequestStatus.PENDING_APPROVAL,
    },
    select: {
      id: true,
      requestNumber: true,
      currentStep: true,
      status: true,
      steps: {
        select: {
          id: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!materialRequest) {
    return { ok: false, error: "Material request not found or no longer pending approval." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: materialRequest.currentStep,
    steps: materialRequest.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to reject this request at the current step." }
  }

  const actedAt = new Date()
  const remarks = payload.remarks?.trim() || "Rejected"

  try {
    await db.$transaction(async (tx) => {
      const stepUpdate = await tx.materialRequestApprovalStep.updateMany({
        where: {
          id: actorStep.id,
          status: MaterialRequestStepStatus.PENDING,
        },
        data: {
          status: MaterialRequestStepStatus.REJECTED,
          actedAt,
          actedByUserId: context.userId,
          remarks,
        },
      })

      if (stepUpdate.count !== 1) {
        throw new Error("The approval step is no longer pending.")
      }

      await tx.materialRequestApprovalStep.updateMany({
        where: {
          materialRequestId: materialRequest.id,
          status: MaterialRequestStepStatus.PENDING,
          stepNumber: {
            gte: actorStep.stepNumber,
          },
        },
        data: {
          status: MaterialRequestStepStatus.SKIPPED,
          actedAt,
          actedByUserId: context.userId,
          remarks: "Skipped after rejection",
        },
      })

      const requestUpdate = await tx.materialRequest.updateMany({
        where: {
          id: materialRequest.id,
          status: MaterialRequestStatus.PENDING_APPROVAL,
          currentStep: actorStep.stepNumber,
        },
        data: {
          status: MaterialRequestStatus.REJECTED,
          rejectedAt: actedAt,
          finalDecisionByUserId: context.userId,
          finalDecisionRemarks: remarks,
        },
      })

      if (requestUpdate.count !== 1) {
        throw new Error("The request state changed while processing the rejection.")
      }

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: materialRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "REJECT_MATERIAL_REQUEST_STEP",
          changes: [
            {
              fieldName: "status",
              oldValue: materialRequest.status,
              newValue: MaterialRequestStatus.REJECTED,
            },
            {
              fieldName: "currentStep",
              oldValue: materialRequest.currentStep,
              newValue: actorStep.stepNumber,
            },
            {
              fieldName: "finalDecisionRemarks",
              newValue: remarks,
            },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reject material request: ${message}` }
  }

  revalidateMaterialApprovalPaths(context.companyId)

  return {
    ok: true,
    message: `Material request ${materialRequest.requestNumber} rejected.`,
  }
}
