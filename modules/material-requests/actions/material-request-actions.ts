"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestItemSource,
  MaterialRequestProcessingStatus,
  MaterialRequestStatus,
  MaterialRequestStepStatus,
  Prisma,
} from "@prisma/client"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  acknowledgeMaterialRequestReceiptInputSchema,
  cancelMaterialRequestInputSchema,
  createMaterialRequestDraftInputSchema,
  submitMaterialRequestInputSchema,
  updateMaterialRequestDraftInputSchema,
  type AcknowledgeMaterialRequestReceiptInput,
  type CancelMaterialRequestInput,
  type CreateMaterialRequestDraftInput,
  type SubmitMaterialRequestInput,
  type UpdateMaterialRequestDraftInput,
} from "@/modules/material-requests/schemas/material-request-actions-schema"
import type { MaterialRequestActionResult } from "@/modules/material-requests/types/material-request-action-result"

const MATERIAL_REQUEST_NUMBER_PATTERN = /^MRS-(PO|JO|OTHERS)-(\d{6})$/
const REQUEST_NUMBER_SEQUENCE_DIGITS = 6
const QUANTITY_TOLERANCE = 0.0005
const ACKNOWLEDGE_RECEIPT_MAX_RETRIES = 3

class MaterialRequestStateConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MaterialRequestStateConflictError"
  }
}

const toNullableText = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeItemCode = (value: string | undefined): string | null => {
  const normalized = toNullableText(value)
  return normalized ? normalized.toUpperCase() : null
}

const toNullableId = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const roundTo = (value: number, precision: number): number => {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

const toCurrency = (value: number): number => roundTo(value, 2)
const toQuantity = (value: number): number => roundTo(value, 3)

const getStepDisplayName = (stepNumber: number, stepName: string | null | undefined): string => {
  const trimmed = stepName?.trim()
  return trimmed ? trimmed : `Step ${stepNumber}`
}

const parseMaterialRequestDate = (value: string): Date | null => {
  return parsePhDateInputToUtcDateOnly(value)
}

type NormalizedMaterialRequestItem = {
  lineNumber: number
  source: MaterialRequestItemSource
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

const normalizeMaterialRequestItems = (
  items: CreateMaterialRequestDraftInput["items"]
): NormalizedMaterialRequestItem[] => {
  return items.map((item, index) => {
    const quantity = toQuantity(item.quantity)
    const unitPrice = item.unitPrice === undefined ? null : toCurrency(item.unitPrice)
    const lineTotal = unitPrice === null ? null : toCurrency(quantity * unitPrice)

    return {
      lineNumber: index + 1,
      source: item.source ?? MaterialRequestItemSource.MANUAL,
      itemCode: normalizeItemCode(item.itemCode),
      description: item.description.trim(),
      uom: item.uom.trim(),
      quantity,
      unitPrice,
      lineTotal,
      remarks: toNullableText(item.remarks),
    }
  })
}

const validateUniqueItemCodes = (
  items: NormalizedMaterialRequestItem[]
): { ok: true } | { ok: false; error: string } => {
  const firstLineByCode = new Map<string, number>()

  for (const item of items) {
    if (!item.itemCode) {
      continue
    }

    const firstLine = firstLineByCode.get(item.itemCode)
    if (firstLine !== undefined) {
      return {
        ok: false,
        error: `Duplicate item code "${item.itemCode}" found on line ${firstLine} and line ${item.lineNumber}.`,
      }
    }

    firstLineByCode.set(item.itemCode, item.lineNumber)
  }

  return { ok: true }
}

const computeMaterialRequestTotals = (params: {
  items: NormalizedMaterialRequestItem[]
  freight: number
  discount: number
}): {
  freight: number
  discount: number
  subTotal: number
  grandTotal: number
} => {
  const subTotal = toCurrency(
    params.items.reduce((sum, item) => {
      return sum + (item.lineTotal ?? 0)
    }, 0)
  )

  const freight = toCurrency(params.freight)
  const discount = toCurrency(params.discount)

  return {
    freight,
    discount,
    subTotal,
    grandTotal: toCurrency(subTotal + freight - discount),
  }
}

const parseRequestNumberSequence = (requestNumber: string): number => {
  const match = MATERIAL_REQUEST_NUMBER_PATTERN.exec(requestNumber)
  if (!match) {
    return 0
  }

  const parsed = Number(match[2] ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

const generateMaterialRequestNumber = async (params: {
  companyId: string
  series: string
  attemptOffset?: number
}): Promise<string> => {
  const seriesPrefix = `MRS-${params.series}-`
  const existingRequestNumbers = await db.materialRequest.findMany({
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
    }, 0) +
    1 +
    (params.attemptOffset ?? 0)
  const suffix = nextSequence.toString().padStart(REQUEST_NUMBER_SEQUENCE_DIGITS, "0")
  return `${seriesPrefix}${suffix}`
}

const hasUniqueConflictTarget = (error: Prisma.PrismaClientKnownRequestError, fields: string[]): boolean => {
  const target = error.meta?.target

  if (Array.isArray(target)) {
    const normalizedTarget = target.map((value) => String(value))
    return fields.every((field) => normalizedTarget.includes(field))
  }

  if (typeof target === "string") {
    return fields.every((field) => target.includes(field))
  }

  return false
}

const isRequestNumberConflictError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    hasUniqueConflictTarget(error, ["companyId", "requestNumber"])
  )
}

const isMaterialRequestItemCodeConflictError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    hasUniqueConflictTarget(error, ["materialRequestId", "itemCode"])
  )
}

const isTransactionSerializationConflict = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

const createMaterialRequestRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/employee-portal/material-request-receiving-reports`,
    `/${companyId}/employee-portal/material-request-processing`,
    `/${companyId}/employee-portal/material-request-posting`,
    `/${companyId}/employee-portal`,
    `/${companyId}/employee-portal/approvers`,
    `/${companyId}/dashboard`,
  ]
}

const revalidateMaterialRequestPaths = (companyId: string): void => {
  for (const path of createMaterialRequestRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

const getRequesterEmployeeForCompanyAccess = async (params: {
  userId: string
  companyId: string
}): Promise<{
  id: string
  departmentId: string | null
} | null> => {
  const companyEmployee = await db.employee.findFirst({
    where: {
      userId: params.userId,
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      departmentId: true,
    },
  })

  if (!companyEmployee) {
    const fallbackEmployee = await db.employee.findFirst({
      where: {
        userId: params.userId,
        companyId: {
          not: params.companyId,
        },
        deletedAt: null,
        isActive: true,
        company: {
          isActive: true,
          userCompanyAccess: {
            some: {
              userId: params.userId,
              isActive: true,
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        departmentId: true,
      },
    })

    if (!fallbackEmployee) {
      return null
    }

    return {
      id: fallbackEmployee.id,
      departmentId: fallbackEmployee.departmentId,
    }
  }

  return {
    id: companyEmployee.id,
    departmentId: companyEmployee.departmentId,
  }
}



const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const canAcknowledgeOnBehalfOfRequester = (params: {
  companyRole: CompanyRole
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
}): boolean => {
  return isHrRole(params.companyRole) || params.isMaterialRequestPurchaser || params.isMaterialRequestPoster
}

const resolveRequestDepartment = async (params: {
  companyId: string
  employeeDepartmentId: string | null
  payloadDepartmentId?: string
}): Promise<{ ok: true; departmentId: string } | { ok: false; error: string }> => {
  const departmentId = params.payloadDepartmentId ?? params.employeeDepartmentId
  if (!departmentId) {
    return { ok: false, error: "Department is required before creating a material request." }
  }

  const department = await db.department.findFirst({
    where: {
      id: departmentId,
      companyId: params.companyId,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (!department) {
    return { ok: false, error: "Department is not available in the active company." }
  }

  return { ok: true, departmentId: department.id }
}

export async function createMaterialRequestDraftAction(
  input: CreateMaterialRequestDraftInput
): Promise<MaterialRequestActionResult> {
  const parsed = createMaterialRequestDraftInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid material request payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const requesterEmployee = await getRequesterEmployeeForCompanyAccess({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!requesterEmployee) {
    return { ok: false, error: "No linked employee profile found in the active company for this account." }
  }

  const resolvedDepartment = await resolveRequestDepartment({
    companyId: context.companyId,
    employeeDepartmentId: requesterEmployee.departmentId,
    payloadDepartmentId: payload.departmentId,
  })

  if (!resolvedDepartment.ok) {
    return resolvedDepartment
  }

  const datePrepared = parseMaterialRequestDate(payload.datePrepared)
  const dateRequired = parseMaterialRequestDate(payload.dateRequired)
  if (!datePrepared || !dateRequired) {
    return { ok: false, error: "Prepared date or required date is invalid." }
  }

  const items = normalizeMaterialRequestItems(payload.items)
  const uniqueItemCodesValidation = validateUniqueItemCodes(items)
  if (!uniqueItemCodesValidation.ok) {
    return uniqueItemCodesValidation
  }
  const totals = computeMaterialRequestTotals({
    items,
    freight: payload.freight,
    discount: payload.discount,
  })

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let requestNumber: string
    try {
      requestNumber = await generateMaterialRequestNumber({
        companyId: context.companyId,
        series: payload.series,
        attemptOffset: attempt,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return { ok: false, error: `Failed to generate request number: ${message}` }
    }

    try {
      const created = await db.$transaction(async (tx) => {
        const materialRequest = await tx.materialRequest.create({
          data: {
            companyId: context.companyId,
            requestNumber,
            series: payload.series,
            requestType: payload.requestType,
            status: MaterialRequestStatus.DRAFT,
            requesterEmployeeId: requesterEmployee.id,
            requesterUserId: context.userId,
            selectedInitialApproverUserId: toNullableId(payload.selectedInitialApproverUserId),
            selectedStepTwoApproverUserId: toNullableId(payload.selectedStepTwoApproverUserId),
            selectedStepThreeApproverUserId: toNullableId(payload.selectedStepThreeApproverUserId),
            selectedStepFourApproverUserId: toNullableId(payload.selectedStepFourApproverUserId),
            departmentId: resolvedDepartment.departmentId,
            datePrepared,
            dateRequired,
            chargeTo: toNullableText(payload.chargeTo),
            bldgCode: toNullableText(payload.bldgCode),
            purpose: toNullableText(payload.purpose),
            remarks: toNullableText(payload.remarks),
            deliverTo: toNullableText(payload.deliverTo),
            isStoreUse: Boolean(payload.isStoreUse),
            freight: totals.freight,
            discount: totals.discount,
            subTotal: totals.subTotal,
            grandTotal: totals.grandTotal,
            requiredSteps: 0,
            currentStep: null,
            items: {
              create: items.map((item) => ({
                lineNumber: item.lineNumber,
                source: item.source,
                itemCode: item.itemCode,
                description: item.description,
                uom: item.uom,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                remarks: item.remarks,
              })),
            },
          },
          select: {
            id: true,
            requestNumber: true,
            status: true,
          },
        })

        await createAuditLog(
          {
            tableName: "MaterialRequest",
            recordId: materialRequest.id,
            action: "CREATE",
            userId: context.userId,
            reason: "EMPLOYEE_CREATE_MATERIAL_REQUEST_DRAFT",
            changes: [
              {
                fieldName: "requestNumber",
                newValue: materialRequest.requestNumber,
              },
              {
                fieldName: "status",
                newValue: materialRequest.status,
              },
              {
                fieldName: "itemCount",
                newValue: items.length,
              },
              {
                fieldName: "grandTotal",
                newValue: totals.grandTotal,
              },
            ],
          },
          tx
        )

        return materialRequest
      })

      revalidateMaterialRequestPaths(context.companyId)

      return {
        ok: true,
        message: `Material request ${created.requestNumber} saved as draft.`,
        requestId: created.id,
      }
    } catch (error) {
      if (isMaterialRequestItemCodeConflictError(error)) {
        return { ok: false, error: "Duplicate item codes are not allowed within the same material request." }
      }

      if (isRequestNumberConflictError(error) && attempt < 11) {
        continue
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      return { ok: false, error: `Failed to create material request draft: ${message}` }
    }
  }

  return { ok: false, error: "Failed to create material request draft: REQUEST_NUMBER_GENERATION_FAILED" }
}

export async function updateMaterialRequestDraftAction(
  input: UpdateMaterialRequestDraftInput
): Promise<MaterialRequestActionResult> {
  const parsed = updateMaterialRequestDraftInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid material request update payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const [requesterEmployee, existingRequest] = await Promise.all([
    getRequesterEmployeeForCompanyAccess({
      userId: context.userId,
      companyId: context.companyId,
    }),
    db.materialRequest.findFirst({
      where: {
        id: payload.requestId,
        companyId: context.companyId,
        requesterUserId: context.userId,
      },
      select: {
        id: true,
        requestNumber: true,
        departmentId: true,
        status: true,
        updatedAt: true,
        steps: {
          select: {
            status: true,
            actedAt: true,
            actedByUserId: true,
          },
        },
      },
    }),
  ])

  if (!existingRequest) {
    return { ok: false, error: "Material request not found in the active company." }
  }

  const hasApprovalHistory = existingRequest.steps.some(
    (step) =>
      step.status !== MaterialRequestStepStatus.PENDING ||
      step.actedAt !== null ||
      step.actedByUserId !== null
  )

  const canEditPendingWithoutHistory =
    existingRequest.status === MaterialRequestStatus.PENDING_APPROVAL && !hasApprovalHistory

  if (existingRequest.status !== MaterialRequestStatus.DRAFT && !canEditPendingWithoutHistory) {
    return {
      ok: false,
      error: "Only draft requests or pending requests without approval decisions can be edited.",
    }
  }

  const resolvedDepartment = await resolveRequestDepartment({
    companyId: context.companyId,
    employeeDepartmentId: requesterEmployee?.departmentId ?? existingRequest.departmentId,
    payloadDepartmentId: payload.departmentId,
  })

  if (!resolvedDepartment.ok) {
    return resolvedDepartment
  }

  const datePrepared = parseMaterialRequestDate(payload.datePrepared)
  const dateRequired = parseMaterialRequestDate(payload.dateRequired)
  if (!datePrepared || !dateRequired) {
    return { ok: false, error: "Prepared date or required date is invalid." }
  }

  const items = normalizeMaterialRequestItems(payload.items)
  const uniqueItemCodesValidation = validateUniqueItemCodes(items)
  if (!uniqueItemCodesValidation.ok) {
    return uniqueItemCodesValidation
  }
  const totals = computeMaterialRequestTotals({
    items,
    freight: payload.freight,
    discount: payload.discount,
  })

  let pendingSubmissionFlow:
    | {
        requiredSteps: number
        submissionFlowSteps: Array<{
          stepNumber: number
          stepName: string | null
          approverUserId: string
        }>
      }
    | null = null

  if (canEditPendingWithoutHistory) {
    const approvalFlow = await db.departmentMaterialRequestApprovalFlow.findFirst({
      where: {
        companyId: context.companyId,
        departmentId: resolvedDepartment.departmentId,
        isActive: true,
      },
      include: {
        steps: {
          orderBy: {
            stepNumber: "asc",
          },
          select: {
            stepNumber: true,
            stepName: true,
            approverUserId: true,
          },
        },
      },
    })

    if (!approvalFlow) {
      return { ok: false, error: "No active department approval flow found for this request." }
    }

    const sortedFlowSteps = [...approvalFlow.steps].sort((a, b) => a.stepNumber - b.stepNumber)
    const selectedApproverByStep = new Map<number, string>()

    const selectedInitialApproverUserId = toNullableId(payload.selectedInitialApproverUserId)
    const selectedStepTwoApproverUserId = toNullableId(payload.selectedStepTwoApproverUserId)
    const selectedStepThreeApproverUserId = toNullableId(payload.selectedStepThreeApproverUserId)
    const selectedStepFourApproverUserId = toNullableId(payload.selectedStepFourApproverUserId)

    if (selectedInitialApproverUserId) {
      selectedApproverByStep.set(1, selectedInitialApproverUserId)
    }

    if (selectedStepTwoApproverUserId) {
      selectedApproverByStep.set(2, selectedStepTwoApproverUserId)
    }

    if (selectedStepThreeApproverUserId) {
      selectedApproverByStep.set(3, selectedStepThreeApproverUserId)
    }

    if (selectedStepFourApproverUserId) {
      selectedApproverByStep.set(4, selectedStepFourApproverUserId)
    }

    for (let stepNumber = 1; stepNumber <= approvalFlow.requiredSteps; stepNumber += 1) {
      const stepApprovers = sortedFlowSteps.filter((step) => step.stepNumber === stepNumber)
      if (stepApprovers.length === 0) {
        continue
      }

      if (!selectedApproverByStep.get(stepNumber)) {
        const stepDisplayName = getStepDisplayName(stepNumber, stepApprovers[0]?.stepName)
        return {
          ok: false,
          error: `${stepDisplayName} approver selection is required before saving this pending request.`,
        }
      }
    }

    for (const [stepNumber, selectedApproverUserId] of selectedApproverByStep.entries()) {
      if (stepNumber > approvalFlow.requiredSteps) {
        continue
      }

      const stepApprovers = sortedFlowSteps.filter((step) => step.stepNumber === stepNumber)
      if (!stepApprovers.some((step) => step.approverUserId === selectedApproverUserId)) {
        const stepDisplayName = getStepDisplayName(stepNumber, stepApprovers[0]?.stepName)
        return {
          ok: false,
          error: `Selected approver for ${stepDisplayName} is no longer valid for the department flow.`,
        }
      }
    }

    const submissionFlowSteps = sortedFlowSteps.filter((step) => {
      if (step.stepNumber < 1 || step.stepNumber > approvalFlow.requiredSteps) {
        return false
      }

      const selectedApproverUserId = selectedApproverByStep.get(step.stepNumber)
      if (!selectedApproverUserId) {
        return true
      }

      return step.approverUserId === selectedApproverUserId
    })

    for (let expectedStep = 1; expectedStep <= approvalFlow.requiredSteps; expectedStep += 1) {
      const stepApprovers = submissionFlowSteps.filter((step) => step.stepNumber === expectedStep)
      if (stepApprovers.length === 0) {
        return {
          ok: false,
          error: "Department approval flow is invalid. Each required step must have at least one approver.",
        }
      }
    }

    if (submissionFlowSteps.some((step) => step.stepNumber < 1 || step.stepNumber > approvalFlow.requiredSteps)) {
      return {
        ok: false,
        error: "Department approval flow is invalid. One or more approvers are assigned outside the required step range.",
      }
    }

    const uniqueApproverUserIds = [...new Set(submissionFlowSteps.map((step) => step.approverUserId))]

    const approverUsers = await db.user.findMany({
      where: {
        id: {
          in: uniqueApproverUserIds,
        },
        isActive: true,
        isRequestApprover: true,
        companyAccess: {
          some: {
            companyId: context.companyId,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
      },
    })

    if (approverUsers.length !== uniqueApproverUserIds.length) {
      return {
        ok: false,
        error: "Department approval flow contains one or more inactive or unauthorized approvers.",
      }
    }

    pendingSubmissionFlow = {
      requiredSteps: approvalFlow.requiredSteps,
      submissionFlowSteps: submissionFlowSteps.map((step) => ({
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        approverUserId: step.approverUserId,
      })),
    }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${existingRequest.id} FOR UPDATE`

      const lockedRequest = await tx.materialRequest.findFirst({
        where: {
          id: existingRequest.id,
          companyId: context.companyId,
          requesterUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          steps: {
            select: {
              status: true,
              actedAt: true,
              actedByUserId: true,
            },
          },
        },
      })

      if (!lockedRequest) {
        throw new MaterialRequestStateConflictError("Material request not found in the active company.")
      }

      if (lockedRequest.updatedAt.getTime() !== existingRequest.updatedAt.getTime()) {
        throw new MaterialRequestStateConflictError("The request was updated by another user. Please refresh and try again.")
      }

      const lockedHasApprovalHistory = lockedRequest.steps.some(
        (step) =>
          step.status !== MaterialRequestStepStatus.PENDING ||
          step.actedAt !== null ||
          step.actedByUserId !== null
      )
      const lockedCanEditPendingWithoutHistory =
        lockedRequest.status === MaterialRequestStatus.PENDING_APPROVAL && !lockedHasApprovalHistory

      if (lockedRequest.status !== MaterialRequestStatus.DRAFT && !lockedCanEditPendingWithoutHistory) {
        throw new MaterialRequestStateConflictError(
          "Only draft requests or pending requests without approval decisions can be edited."
        )
      }

      if (lockedCanEditPendingWithoutHistory !== canEditPendingWithoutHistory) {
        throw new MaterialRequestStateConflictError("The request state changed. Please refresh and try again.")
      }

      await tx.materialRequestItem.deleteMany({
        where: {
          materialRequestId: existingRequest.id,
        },
      })

      if (pendingSubmissionFlow) {
        await tx.materialRequestApprovalStep.deleteMany({
          where: {
            materialRequestId: existingRequest.id,
          },
        })

        await tx.materialRequestApprovalStep.createMany({
          data: pendingSubmissionFlow.submissionFlowSteps.map((step) => ({
            materialRequestId: existingRequest.id,
            stepNumber: step.stepNumber,
            stepName: step.stepName,
            approverUserId: step.approverUserId,
          })),
        })
      }

      await tx.materialRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          series: payload.series,
          requestType: payload.requestType,
          departmentId: resolvedDepartment.departmentId,
          selectedInitialApproverUserId: toNullableId(payload.selectedInitialApproverUserId),
          selectedStepTwoApproverUserId: toNullableId(payload.selectedStepTwoApproverUserId),
          selectedStepThreeApproverUserId: toNullableId(payload.selectedStepThreeApproverUserId),
          selectedStepFourApproverUserId: toNullableId(payload.selectedStepFourApproverUserId),
          datePrepared,
          dateRequired,
          chargeTo: toNullableText(payload.chargeTo),
          bldgCode: toNullableText(payload.bldgCode),
          purpose: toNullableText(payload.purpose),
          remarks: toNullableText(payload.remarks),
          deliverTo: toNullableText(payload.deliverTo),
          isStoreUse: Boolean(payload.isStoreUse),
          freight: totals.freight,
          discount: totals.discount,
          subTotal: totals.subTotal,
          grandTotal: totals.grandTotal,
          ...(pendingSubmissionFlow
            ? {
                requiredSteps: pendingSubmissionFlow.requiredSteps,
                currentStep: 1,
              }
            : {}),
          items: {
            create: items.map((item) => ({
              lineNumber: item.lineNumber,
              source: item.source,
              itemCode: item.itemCode,
              description: item.description,
              uom: item.uom,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              remarks: item.remarks,
            })),
          },
        },
      })

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: existingRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: pendingSubmissionFlow
            ? "EMPLOYEE_UPDATE_MATERIAL_REQUEST_PENDING_NO_HISTORY"
            : "EMPLOYEE_UPDATE_MATERIAL_REQUEST_DRAFT",
          changes: [
            {
              fieldName: "itemCount",
              newValue: items.length,
            },
            {
              fieldName: "grandTotal",
              newValue: totals.grandTotal,
            },
          ],
        },
        tx
      )
    })

    revalidateMaterialRequestPaths(context.companyId)

    return {
      ok: true,
      message: `Material request ${existingRequest.requestNumber} updated.`,
      requestId: existingRequest.id,
    }
  } catch (error) {
    if (error instanceof MaterialRequestStateConflictError) {
      return { ok: false, error: error.message }
    }

    if (isMaterialRequestItemCodeConflictError(error)) {
      return { ok: false, error: "Duplicate item codes are not allowed within the same material request." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update material request: ${message}` }
  }
}

export async function submitMaterialRequestAction(
  input: SubmitMaterialRequestInput
): Promise<MaterialRequestActionResult> {
  const parsed = submitMaterialRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submission payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const materialRequest = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      requesterUserId: context.userId,
    },
    select: {
      id: true,
      requestNumber: true,
      departmentId: true,
      updatedAt: true,
      selectedInitialApproverUserId: true,
      selectedStepTwoApproverUserId: true,
      selectedStepThreeApproverUserId: true,
      selectedStepFourApproverUserId: true,
      status: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  })

  if (!materialRequest) {
    return { ok: false, error: "Material request not found in the active company." }
  }

  if (materialRequest.status !== MaterialRequestStatus.DRAFT) {
    return { ok: false, error: "Only draft material requests can be submitted for approval." }
  }

  if (materialRequest._count.items === 0) {
    return { ok: false, error: "At least one item is required before submitting the request." }
  }

  const approvalFlow = await db.departmentMaterialRequestApprovalFlow.findFirst({
    where: {
      companyId: context.companyId,
      departmentId: materialRequest.departmentId,
      isActive: true,
    },
    include: {
      steps: {
        orderBy: {
          stepNumber: "asc",
        },
        select: {
          stepNumber: true,
          stepName: true,
          approverUserId: true,
        },
      },
    },
  })

  if (!approvalFlow) {
    return { ok: false, error: "No active department approval flow found for this request." }
  }

  const sortedFlowSteps = [...approvalFlow.steps].sort((a, b) => a.stepNumber - b.stepNumber)
  const selectedApproverByStep = new Map<number, string>()

  if (materialRequest.selectedInitialApproverUserId) {
    selectedApproverByStep.set(1, materialRequest.selectedInitialApproverUserId)
  }

  if (materialRequest.selectedStepTwoApproverUserId) {
    selectedApproverByStep.set(2, materialRequest.selectedStepTwoApproverUserId)
  }

  if (materialRequest.selectedStepThreeApproverUserId) {
    selectedApproverByStep.set(3, materialRequest.selectedStepThreeApproverUserId)
  }

  if (materialRequest.selectedStepFourApproverUserId) {
    selectedApproverByStep.set(4, materialRequest.selectedStepFourApproverUserId)
  }

  for (let stepNumber = 1; stepNumber <= approvalFlow.requiredSteps; stepNumber += 1) {
    const stepApprovers = sortedFlowSteps.filter((step) => step.stepNumber === stepNumber)
    if (stepApprovers.length === 0) {
      continue
    }

    if (!selectedApproverByStep.get(stepNumber)) {
      const stepDisplayName = getStepDisplayName(stepNumber, stepApprovers[0]?.stepName)
      return {
        ok: false,
        error: `${stepDisplayName} approver selection is required before submitting.`,
      }
    }
  }

  for (const [stepNumber, selectedApproverUserId] of selectedApproverByStep.entries()) {
    if (stepNumber > approvalFlow.requiredSteps) {
      continue
    }

    const stepApprovers = sortedFlowSteps.filter((step) => step.stepNumber === stepNumber)
    if (!stepApprovers.some((step) => step.approverUserId === selectedApproverUserId)) {
      const stepDisplayName = getStepDisplayName(stepNumber, stepApprovers[0]?.stepName)
      return {
        ok: false,
        error: `Selected approver for ${stepDisplayName} is no longer valid for the department flow.`,
      }
    }
  }

  const submissionFlowSteps = sortedFlowSteps.filter((step) => {
    if (step.stepNumber < 1 || step.stepNumber > approvalFlow.requiredSteps) {
      return false
    }

    const selectedApproverUserId = selectedApproverByStep.get(step.stepNumber)
    if (!selectedApproverUserId) {
      return true
    }

    return step.approverUserId === selectedApproverUserId
  })

  for (let expectedStep = 1; expectedStep <= approvalFlow.requiredSteps; expectedStep += 1) {
    const stepApprovers = submissionFlowSteps.filter((step) => step.stepNumber === expectedStep)
    if (stepApprovers.length === 0) {
      return {
        ok: false,
        error: "Department approval flow is invalid. Each required step must have at least one approver.",
      }
    }
  }

  if (submissionFlowSteps.some((step) => step.stepNumber < 1 || step.stepNumber > approvalFlow.requiredSteps)) {
    return {
      ok: false,
      error: "Department approval flow is invalid. One or more approvers are assigned outside the required step range.",
    }
  }

  const uniqueApproverUserIds = [...new Set(submissionFlowSteps.map((step) => step.approverUserId))]

  const approverUsers = await db.user.findMany({
    where: {
      id: {
        in: uniqueApproverUserIds,
      },
      isActive: true,
      isRequestApprover: true,
      companyAccess: {
        some: {
          companyId: context.companyId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
    },
  })

  if (approverUsers.length !== uniqueApproverUserIds.length) {
    return {
      ok: false,
      error: "Department approval flow contains one or more inactive or unauthorized approvers.",
    }
  }

  const submittedAt = new Date()

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${materialRequest.id} FOR UPDATE`

      const lockedRequest = await tx.materialRequest.findFirst({
        where: {
          id: materialRequest.id,
          companyId: context.companyId,
          requesterUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      })

      if (!lockedRequest) {
        throw new MaterialRequestStateConflictError("Material request not found in the active company.")
      }

      if (lockedRequest.updatedAt.getTime() !== materialRequest.updatedAt.getTime()) {
        throw new MaterialRequestStateConflictError("The request was updated by another user. Please refresh and submit again.")
      }

      if (lockedRequest.status !== MaterialRequestStatus.DRAFT) {
        throw new MaterialRequestStateConflictError("Only draft material requests can be submitted for approval.")
      }

      if (lockedRequest._count.items === 0) {
        throw new MaterialRequestStateConflictError("At least one item is required before submitting the request.")
      }

      await tx.materialRequestApprovalStep.deleteMany({
        where: {
          materialRequestId: materialRequest.id,
        },
      })

      await tx.materialRequestApprovalStep.createMany({
        data: submissionFlowSteps.map((step) => ({
          materialRequestId: materialRequest.id,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          approverUserId: step.approverUserId,
        })),
      })

      const submitUpdate = await tx.materialRequest.updateMany({
        where: {
          id: materialRequest.id,
          status: MaterialRequestStatus.DRAFT,
          updatedAt: lockedRequest.updatedAt,
        },
        data: {
          status: MaterialRequestStatus.PENDING_APPROVAL,
          requiredSteps: approvalFlow.requiredSteps,
          currentStep: 1,
          submittedAt,
          approvedAt: null,
          rejectedAt: null,
          finalDecisionByUserId: null,
          finalDecisionRemarks: null,
          cancellationReason: null,
          cancelledAt: null,
          cancelledByUserId: null,
        },
      })

      if (submitUpdate.count !== 1) {
        throw new MaterialRequestStateConflictError("The request state changed while submitting. Please retry.")
      }

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: materialRequest.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_SUBMIT_MATERIAL_REQUEST",
          changes: [
            {
              fieldName: "status",
              oldValue: materialRequest.status,
              newValue: MaterialRequestStatus.PENDING_APPROVAL,
            },
            {
              fieldName: "requiredSteps",
              newValue: approvalFlow.requiredSteps,
            },
          ],
        },
        tx
      )
    })

    revalidateMaterialRequestPaths(context.companyId)

    return {
      ok: true,
      message: `Material request ${materialRequest.requestNumber} submitted for approval.`,
    }
  } catch (error) {
    if (error instanceof MaterialRequestStateConflictError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to submit material request: ${message}` }
  }
}

export async function cancelMaterialRequestAction(
  input: CancelMaterialRequestInput
): Promise<MaterialRequestActionResult> {
  const parsed = cancelMaterialRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancellation payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.materialRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      requesterUserId: context.userId,
    },
    select: {
      id: true,
      requestNumber: true,
      status: true,
      updatedAt: true,
      steps: {
        where: {
          status: {
            in: [MaterialRequestStepStatus.APPROVED, MaterialRequestStepStatus.REJECTED],
          },
        },
        select: {
          id: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Material request not found in the active company." }
  }

  if (
    request.status !== MaterialRequestStatus.DRAFT &&
    request.status !== MaterialRequestStatus.PENDING_APPROVAL
  ) {
    return { ok: false, error: "Only draft or pending requests can be cancelled." }
  }

  if (request.status === MaterialRequestStatus.PENDING_APPROVAL && request.steps.length > 0) {
    return {
      ok: false,
      error: "This request already has an approval decision and can no longer be cancelled.",
    }
  }

  const cancellationReason = toNullableText(payload.reason) ?? "Cancelled by requester"

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const lockedRequest = await tx.materialRequest.findFirst({
        where: {
          id: request.id,
          companyId: context.companyId,
          requesterUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          steps: {
            where: {
              status: {
                in: [MaterialRequestStepStatus.APPROVED, MaterialRequestStepStatus.REJECTED],
              },
            },
            select: {
              id: true,
            },
          },
        },
      })

      if (!lockedRequest) {
        throw new MaterialRequestStateConflictError("Material request not found in the active company.")
      }

      if (lockedRequest.updatedAt.getTime() !== request.updatedAt.getTime()) {
        throw new MaterialRequestStateConflictError("The request was updated by another user. Please refresh and try again.")
      }

      if (
        lockedRequest.status !== MaterialRequestStatus.DRAFT &&
        lockedRequest.status !== MaterialRequestStatus.PENDING_APPROVAL
      ) {
        throw new MaterialRequestStateConflictError("Only draft or pending requests can be cancelled.")
      }

      if (
        lockedRequest.status === MaterialRequestStatus.PENDING_APPROVAL &&
        lockedRequest.steps.length > 0
      ) {
        throw new MaterialRequestStateConflictError(
          "This request already has an approval decision and can no longer be cancelled."
        )
      }

      await tx.materialRequestApprovalStep.updateMany({
        where: {
          materialRequestId: request.id,
          status: MaterialRequestStepStatus.PENDING,
        },
        data: {
          status: MaterialRequestStepStatus.SKIPPED,
          actedAt: new Date(),
          actedByUserId: context.userId,
          remarks: "Cancelled by requester",
        },
      })

      const cancelUpdate = await tx.materialRequest.updateMany({
        where: {
          id: request.id,
          updatedAt: lockedRequest.updatedAt,
          status: {
            in: [MaterialRequestStatus.DRAFT, MaterialRequestStatus.PENDING_APPROVAL],
          },
        },
        data: {
          status: MaterialRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason,
          cancelledByUserId: context.userId,
        },
      })

      if (cancelUpdate.count !== 1) {
        throw new MaterialRequestStateConflictError("The request state changed while cancelling. Please retry.")
      }

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_CANCEL_MATERIAL_REQUEST",
          changes: [
            {
              fieldName: "status",
              oldValue: request.status,
              newValue: MaterialRequestStatus.CANCELLED,
            },
            {
              fieldName: "cancellationReason",
              newValue: cancellationReason,
            },
          ],
        },
        tx
      )
    })

    revalidateMaterialRequestPaths(context.companyId)

    return {
      ok: true,
      message: `Material request ${request.requestNumber} cancelled.`,
    }
  } catch (error) {
    if (error instanceof MaterialRequestStateConflictError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to cancel material request: ${message}` }
  }
}

export async function acknowledgeMaterialRequestReceiptAction(
  input: AcknowledgeMaterialRequestReceiptInput
): Promise<MaterialRequestActionResult> {
  const parsed = acknowledgeMaterialRequestReceiptInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid acknowledgment payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const actedAt = new Date()
  const remarks = toNullableText(payload.remarks)
  let outcome:
    | {
        kind: "error"
        message: string
      }
    | {
        kind: "not_required"
        requestNumber: string
        receivingReportId: string | null
      }
    | {
        kind: "already_acknowledged"
        requestNumber: string
        receivingReportId: string
      }
    | {
        kind: "acknowledged"
        requestNumber: string
        receivingReportId: string
        acknowledgedOnBehalf: boolean
      }
    | null = null

  for (let attempt = 0; attempt < ACKNOWLEDGE_RECEIPT_MAX_RETRIES; attempt += 1) {
    try {
      outcome = await db.$transaction(async (tx) => {
      // Lock request row to avoid duplicate receiving report creation.
        await tx.$queryRaw`SELECT "id" FROM "MaterialRequest" WHERE "id" = ${payload.requestId} FOR UPDATE`

        const request = await tx.materialRequest.findFirst({
          where: {
            id: payload.requestId,
            companyId: context.companyId,
            status: MaterialRequestStatus.APPROVED,
            processingStatus: MaterialRequestProcessingStatus.COMPLETED,
          },
          select: {
            id: true,
            requestNumber: true,
            requesterUserId: true,
            requesterAcknowledgedAt: true,
            requesterAcknowledgedByUserId: true,
            requiresReceiptAcknowledgment: true,
            receivingReports: {
              orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                id: true,
                reportNumber: true,
                remarks: true,
                receivedAt: true,
              },
            },
            items: {
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
                serveBatchItems: {
                  select: {
                    quantityServed: true,
                  },
                },
              },
            },
          },
        })

        if (!request) {
          return { kind: "error" as const, message: "Completed material request not found." }
        }

        let acknowledgedOnBehalf = false

        if (request.requesterUserId !== context.userId) {
          const [requesterUser, requesterCompanyAccess, actorCompanyAccess] = await Promise.all([
            tx.user.findUnique({
              where: {
                id: request.requesterUserId,
              },
              select: {
                isActive: true,
              },
            }),
            tx.userCompanyAccess.findUnique({
              where: {
                userId_companyId: {
                  userId: request.requesterUserId,
                  companyId: context.companyId,
                },
              },
              select: {
                isActive: true,
              },
            }),
            tx.userCompanyAccess.findUnique({
              where: {
                userId_companyId: {
                  userId: context.userId,
                  companyId: context.companyId,
                },
              },
              select: {
                isActive: true,
                isMaterialRequestPurchaser: true,
                isMaterialRequestPoster: true,
              },
            }),
          ])

          const requesterUnavailable = !requesterUser?.isActive || !requesterCompanyAccess?.isActive
          const actorCanAcknowledgeOnBehalf =
            requesterUnavailable &&
            canAcknowledgeOnBehalfOfRequester({
              companyRole,
              isMaterialRequestPurchaser: Boolean(
                actorCompanyAccess?.isActive && actorCompanyAccess.isMaterialRequestPurchaser
              ),
              isMaterialRequestPoster: Boolean(actorCompanyAccess?.isActive && actorCompanyAccess.isMaterialRequestPoster),
            })

          if (actorCanAcknowledgeOnBehalf) {
            acknowledgedOnBehalf = true
          }

          if (!actorCanAcknowledgeOnBehalf) {
            return {
              kind: "error" as const,
              message: requesterUnavailable
                ? "Requester is unavailable. Only HR, purchaser, or posting users can acknowledge on behalf."
                : "Only the original requester can acknowledge receipt for this material request.",
            }
          }
        }

        if (!request.requiresReceiptAcknowledgment) {
          return {
            kind: "not_required" as const,
            requestNumber: request.requestNumber,
            receivingReportId: request.receivingReports[0]?.id ?? null,
          }
        }

        const hasRemainingQuantity = request.items.some((item) => {
          const requestedQuantity = Number(item.quantity)
          const receivedQuantity = item.serveBatchItems.reduce((accumulator, servedItem) => {
            return accumulator + Number(servedItem.quantityServed)
          }, 0)

          return requestedQuantity - receivedQuantity > QUANTITY_TOLERANCE
        })

        if (hasRemainingQuantity) {
          return {
            kind: "error" as const,
            message: "Cannot acknowledge receipt while one or more items still have remaining quantities.",
          }
        }

        const existingReport = request.receivingReports[0] ?? null
        if (request.requesterAcknowledgedAt && existingReport) {
          return {
            kind: "already_acknowledged" as const,
            requestNumber: request.requestNumber,
            receivingReportId: existingReport.id,
          }
        }

        const report = existingReport
          ? await tx.materialRequestReceivingReport.update({
              where: {
                id: existingReport.id,
              },
              data: {
                remarks: remarks ?? existingReport.remarks,
              },
              select: {
                id: true,
                reportNumber: true,
              },
            })
          : await tx.materialRequestReceivingReport.create({
              data: {
                companyId: context.companyId,
                materialRequestId: request.id,
                reportNumber: `RR-${request.requestNumber}`,
                remarks,
                receivedAt: actedAt,
                receivedByUserId: context.userId,
                items: {
                  create: request.items.map((item) => {
                    const receivedQuantity = item.serveBatchItems.reduce((accumulator, servedItem) => {
                      return accumulator + Number(servedItem.quantityServed)
                    }, 0)

                    return {
                      materialRequestItemId: item.id,
                      lineNumber: item.lineNumber,
                      itemCode: item.itemCode,
                      description: item.description,
                      uom: item.uom,
                      requestedQuantity: Number(item.quantity),
                      receivedQuantity,
                      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
                      lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
                      remarks: item.remarks,
                    }
                  }),
                },
              },
              select: {
                id: true,
                reportNumber: true,
              },
            })

        await tx.materialRequest.update({
          where: {
            id: request.id,
          },
          data: {
            requesterAcknowledgedAt: request.requesterAcknowledgedAt ?? actedAt,
            requesterAcknowledgedByUser: {
              connect: {
                id: context.userId,
              },
            },
          },
        })

        await createAuditLog(
          {
            tableName: "MaterialRequest",
            recordId: request.id,
            action: "UPDATE",
            userId: context.userId,
            reason: acknowledgedOnBehalf
              ? "ACKNOWLEDGE_MATERIAL_REQUEST_RECEIPT_ON_BEHALF"
              : "EMPLOYEE_ACKNOWLEDGE_MATERIAL_REQUEST_RECEIPT",
            changes: [
              {
                fieldName: "requesterAcknowledgedAt",
                oldValue: request.requesterAcknowledgedAt,
                newValue: request.requesterAcknowledgedAt ?? actedAt,
              },
              {
                fieldName: "requesterAcknowledgedByUserId",
                oldValue: request.requesterAcknowledgedByUserId,
                newValue: context.userId,
              },
              {
                fieldName: "receivingReportNumber",
                oldValue: existingReport?.reportNumber ?? null,
                newValue: report.reportNumber,
              },
              {
                fieldName: "acknowledgedOnBehalf",
                newValue: acknowledgedOnBehalf,
              },
            ],
          },
          tx
        )

        return {
          kind: "acknowledged" as const,
          requestNumber: request.requestNumber,
          receivingReportId: report.id,
          acknowledgedOnBehalf,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
      break
    } catch (error) {
      if (isTransactionSerializationConflict(error) && attempt < ACKNOWLEDGE_RECEIPT_MAX_RETRIES - 1) {
        continue
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      return { ok: false, error: `Failed to acknowledge material request receipt: ${message}` }
    }
  }

  if (!outcome) {
    return {
      ok: false,
      error: "Failed to acknowledge material request receipt due to concurrent updates. Please retry.",
    }
  }

  if (outcome.kind === "error") {
    return { ok: false, error: outcome.message }
  }

  revalidateMaterialRequestPaths(context.companyId)

  if (outcome.kind === "already_acknowledged") {
    return {
      ok: true,
      message: `Material request ${outcome.requestNumber} is already acknowledged.`,
      receivingReportId: outcome.receivingReportId,
    }
  }

  if (outcome.kind === "not_required") {
    return {
      ok: true,
      message: `Material request ${outcome.requestNumber} does not require receipt acknowledgment.`,
      receivingReportId: outcome.receivingReportId ?? undefined,
    }
  }

  return {
    ok: true,
    message: outcome.acknowledgedOnBehalf
      ? `Material request ${outcome.requestNumber} receipt acknowledged on behalf of the requester.`
      : `Material request ${outcome.requestNumber} receipt acknowledged successfully.`,
    receivingReportId: outcome.receivingReportId,
  }
}
