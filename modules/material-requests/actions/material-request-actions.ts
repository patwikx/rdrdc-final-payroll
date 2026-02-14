"use server"

import { revalidatePath } from "next/cache"

import {
  MaterialRequestItemSource,
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
  cancelMaterialRequestInputSchema,
  createMaterialRequestDraftInputSchema,
  submitMaterialRequestInputSchema,
  updateMaterialRequestDraftInputSchema,
  type CancelMaterialRequestInput,
  type CreateMaterialRequestDraftInput,
  type SubmitMaterialRequestInput,
  type UpdateMaterialRequestDraftInput,
} from "@/modules/material-requests/schemas/material-request-actions-schema"
import type { MaterialRequestActionResult } from "@/modules/material-requests/types/material-request-action-result"

const REQUEST_NUMBER_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
})
const REQUEST_NUMBER_SEQUENCE_DIGITS = 6

const toNullableText = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
      itemCode: toNullableText(item.itemCode),
      description: item.description.trim(),
      uom: item.uom.trim(),
      quantity,
      unitPrice,
      lineTotal,
      remarks: toNullableText(item.remarks),
    }
  })
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

const generateMaterialRequestNumber = async (params: {
  companyId: string
  series: string
  attemptOffset?: number
}): Promise<string> => {
  const stamp = getRequestNumberDateStamp()
  const prefix = `MR-${params.series}-${stamp}-`
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

  const nextSequence = parseRequestNumberSequence(latestRequest?.requestNumber ?? "") + 1 + (params.attemptOffset ?? 0)
  const suffix = nextSequence.toString().padStart(REQUEST_NUMBER_SEQUENCE_DIGITS, "0")
  return `${prefix}${suffix}`
}

const isRequestNumberConflictError = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

const createMaterialRequestRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/employee-portal/material-request-processing`,
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
  isInActiveCompany: boolean
} | null> => {
  const employees = await db.employee.findMany({
    where: {
      userId: params.userId,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      departmentId: true,
      companyId: true,
    },
  })

  const companyEmployee = employees.find((employee) => employee.companyId === params.companyId)
  if (companyEmployee) {
    return {
      id: companyEmployee.id,
      departmentId: companyEmployee.departmentId,
      isInActiveCompany: true,
    }
  }

  const fallbackEmployee = employees[0]
  if (!fallbackEmployee) {
    return null
  }

  return {
    id: fallbackEmployee.id,
    // Fallback employee can belong to a different company. Do not reuse
    // that department as default for the active company request.
    departmentId: null,
    isInActiveCompany: false,
  }
}

const ensureEmployeeRole = (companyRole: CompanyRole): MaterialRequestActionResult => {
  if (companyRole !== "EMPLOYEE") {
    return { ok: false, error: "Only employees can submit material requests in this portal." }
  }

  return { ok: true, message: "Employee role validated." }
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
  const companyRole = context.companyRole as CompanyRole

  const employeeRoleValidation = ensureEmployeeRole(companyRole)
  if (!employeeRoleValidation.ok) {
    return employeeRoleValidation
  }

  const requesterEmployee = await getRequesterEmployeeForCompanyAccess({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!requesterEmployee) {
    return { ok: false, error: "No linked employee profile found for this account." }
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
  const companyRole = context.companyRole as CompanyRole

  const employeeRoleValidation = ensureEmployeeRole(companyRole)
  if (!employeeRoleValidation.ok) {
    return employeeRoleValidation
  }

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
        status: true,
      },
    }),
  ])

  if (!requesterEmployee) {
    return { ok: false, error: "No linked employee profile found for this account." }
  }

  if (!existingRequest) {
    return { ok: false, error: "Material request draft not found." }
  }

  if (existingRequest.status !== MaterialRequestStatus.DRAFT) {
    return { ok: false, error: "Only draft material requests can be edited." }
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
  const totals = computeMaterialRequestTotals({
    items,
    freight: payload.freight,
    discount: payload.discount,
  })

  try {
    await db.$transaction(async (tx) => {
      await tx.materialRequestItem.deleteMany({
        where: {
          materialRequestId: existingRequest.id,
        },
      })

      const updated = await tx.materialRequest.update({
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
          recordId: updated.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "EMPLOYEE_UPDATE_MATERIAL_REQUEST_DRAFT",
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
      message: `Material request ${existingRequest.requestNumber} draft updated.`,
      requestId: existingRequest.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update material request draft: ${message}` }
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
  const companyRole = context.companyRole as CompanyRole

  const employeeRoleValidation = ensureEmployeeRole(companyRole)
  if (!employeeRoleValidation.ok) {
    return employeeRoleValidation
  }

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

      await tx.materialRequest.update({
        where: {
          id: materialRequest.id,
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
  const companyRole = context.companyRole as CompanyRole

  const employeeRoleValidation = ensureEmployeeRole(companyRole)
  if (!employeeRoleValidation.ok) {
    return employeeRoleValidation
  }

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

      await tx.materialRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: MaterialRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason,
          cancelledByUserId: context.userId,
        },
      })

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
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to cancel material request: ${message}` }
  }
}
