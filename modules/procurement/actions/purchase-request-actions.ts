"use server"

import {
  MaterialRequestStepStatus,
  PurchaseRequestItemSource,
  PurchaseRequestStatus,
  Prisma,
} from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly, toPhDateInputValue } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  hasEmployeePortalCapability,
  type EmployeePortalCapability,
} from "@/modules/employee-portal/utils/employee-portal-access-policy"
import { getEmployeePortalCapabilityContext } from "@/modules/employee-portal/utils/employee-portal-capability-context"
import {
  acknowledgePurchaseRequestSendBackInputSchema,
  approvePurchaseRequestInputSchema,
  cancelPurchaseRequestInputSchema,
  createPurchaseRequestDraftInputSchema,
  getPurchaseRequestApprovalDecisionDetailsInputSchema,
  rejectPurchaseRequestInputSchema,
  sendBackPurchaseRequestInputSchema,
  submitPurchaseRequestInputSchema,
  updatePurchaseRequestDraftInputSchema,
  type AcknowledgePurchaseRequestSendBackInput,
  type ApprovePurchaseRequestInput,
  type CancelPurchaseRequestInput,
  type CreatePurchaseRequestDraftInput,
  type GetPurchaseRequestApprovalDecisionDetailsInput,
  type RejectPurchaseRequestInput,
  type SendBackPurchaseRequestInput,
  type SubmitPurchaseRequestInput,
  type UpdatePurchaseRequestDraftInput,
} from "@/modules/procurement/schemas/purchase-request-actions-schema"
import type {
  ProcurementActionDataResult,
  ProcurementActionResult,
} from "@/modules/procurement/types/procurement-action-result"
import type { PurchaseRequestApprovalDecisionDetail } from "@/modules/procurement/types/purchase-request-types"
import { getCompanyPurchaseRequestWorkflowEnabled } from "@/modules/procurement/utils/purchase-request-workflow"

const PURCHASE_REQUEST_NUMBER_PATTERN = /^PR-(PO|JO|OTHERS)-(\d{6})$/
const REQUEST_NUMBER_SEQUENCE_DIGITS = 6
const REQUEST_CREATE_MAX_RETRIES = 3

class PurchaseRequestStateConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PurchaseRequestStateConflictError"
  }
}

class PurchaseRequestApprovalValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PurchaseRequestApprovalValidationError"
  }
}

type PurchaseRequestItemPayload = {
  source: "CATALOG" | "MANUAL"
  procurementItemId: string | null
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  remarks: string | null
}

type PurchaseRequestCatalogItemInputPayload = {
  source: "CATALOG"
  procurementItemId: string
  quantity: number
  unitPrice: number | null
}

type PurchaseRequestManualItemInputPayload = {
  source: "MANUAL"
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  remarks: string | null
}

type PurchaseRequestItemInputPayload =
  | PurchaseRequestCatalogItemInputPayload
  | PurchaseRequestManualItemInputPayload

type PurchaseRequestApprovalStepRecord = {
  id: string
  approvalCycle: number
  stepNumber: number
  stepName: string | null
  approverUserId: string
  status: MaterialRequestStepStatus
}

const parseRequestNumberSequence = (requestNumber: string): number => {
  const match = PURCHASE_REQUEST_NUMBER_PATTERN.exec(requestNumber)
  if (!match) {
    return 0
  }

  const parsed = Number(match[2] ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeOptionalText = (value: string | undefined): string | null => {
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

const getStepDisplayName = (stepNumber: number, stepName: string | null | undefined): string => {
  const trimmed = stepName?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : `Step ${stepNumber}`
}

const toItemInputPayload = (
  inputItems: CreatePurchaseRequestDraftInput["items"]
): PurchaseRequestItemInputPayload[] => {
  const existingProcurementItemIds = new Set<string>()
  const existingManualItemCodes = new Set<string>()

  return inputItems.map((item) => {
    const source = item.source ?? PurchaseRequestItemSource.CATALOG
    const quantity = Number(item.quantity)
    const unitPrice = item.unitPrice === undefined ? null : Number(item.unitPrice)

    if (source === PurchaseRequestItemSource.CATALOG) {
      const procurementItemId = item.procurementItemId?.trim()
      if (!procurementItemId) {
        throw new Error("Catalog item is required.")
      }

      if (existingProcurementItemIds.has(procurementItemId)) {
        throw new Error("Duplicate catalog items are not allowed within the same purchase request.")
      }
      existingProcurementItemIds.add(procurementItemId)

      return {
        source: "CATALOG",
        procurementItemId,
        quantity,
        unitPrice,
      }
    }

    const normalizedManualItemCode = normalizeOptionalText(item.itemCode)?.toUpperCase() ?? null
    if (normalizedManualItemCode) {
      if (existingManualItemCodes.has(normalizedManualItemCode)) {
        throw new Error("Duplicate manual item codes are not allowed within the same purchase request.")
      }
      existingManualItemCodes.add(normalizedManualItemCode)
    }

    const description = item.description.trim()
    const uom = item.uom.trim().toUpperCase()

    return {
      source: "MANUAL",
      itemCode: normalizedManualItemCode,
      description,
      uom,
      quantity,
      unitPrice,
      remarks: normalizeOptionalText(item.remarks),
    }
  })
}

const resolveCatalogBackedItemPayload = async (
  itemInputs: PurchaseRequestItemInputPayload[]
): Promise<PurchaseRequestItemPayload[]> => {
  const catalogInputs = itemInputs.filter(
    (item): item is PurchaseRequestCatalogItemInputPayload => item.source === "CATALOG"
  )
  if (catalogInputs.length === 0) {
    return itemInputs.map((item) => {
      if (item.source === "CATALOG") {
        throw new Error("Catalog item is required.")
      }

      return {
        source: "MANUAL",
        procurementItemId: null,
        itemCode: item.itemCode,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice === null ? null : item.quantity * item.unitPrice,
        remarks: item.remarks,
      }
    })
  }

  const procurementItemIds = catalogInputs.map((item) => item.procurementItemId)
  const catalogItems = await db.procurementItem.findMany({
    where: {
      id: {
        in: procurementItemIds,
      },
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      uom: true,
    },
  })

  if (catalogItems.length !== procurementItemIds.length) {
    throw new Error("One or more selected catalog items are invalid or inactive.")
  }

  const catalogById = new Map(catalogItems.map((item) => [item.id, item]))

  return itemInputs.map((itemInput) => {
    if (itemInput.source === "MANUAL") {
      return {
        source: "MANUAL",
        procurementItemId: null,
        itemCode: itemInput.itemCode,
        description: itemInput.description,
        uom: itemInput.uom,
        quantity: itemInput.quantity,
        unitPrice: itemInput.unitPrice,
        lineTotal: itemInput.unitPrice === null ? null : itemInput.quantity * itemInput.unitPrice,
        remarks: itemInput.remarks,
      }
    }

    const catalogItem = catalogById.get(itemInput.procurementItemId)
    if (!catalogItem) {
      throw new Error("One or more selected catalog items are invalid or inactive.")
    }

    return {
      source: "CATALOG",
      procurementItemId: catalogItem.id,
      itemCode: catalogItem.code.trim().toUpperCase(),
      description: (catalogItem.description ?? catalogItem.name).trim(),
      uom: catalogItem.uom.trim().toUpperCase(),
      quantity: itemInput.quantity,
      unitPrice: itemInput.unitPrice,
      lineTotal: itemInput.unitPrice === null ? null : itemInput.quantity * itemInput.unitPrice,
      remarks: null,
    }
  })
}

const computeTotals = (items: PurchaseRequestItemPayload[]): {
  subTotal: Prisma.Decimal
  grandTotal: Prisma.Decimal
} => {
  const subTotalNumber = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)

  return {
    subTotal: new Prisma.Decimal(subTotalNumber),
    grandTotal: new Prisma.Decimal(Math.max(0, subTotalNumber)),
  }
}

const assertUniqueItemCodes = (items: PurchaseRequestItemPayload[]): void => {
  const seenItemCodes = new Set<string>()

  for (const item of items) {
    const normalizedItemCode = item.itemCode?.trim().toUpperCase()
    if (!normalizedItemCode) {
      continue
    }

    if (seenItemCodes.has(normalizedItemCode)) {
      throw new Error("Duplicate item codes are not allowed within the same purchase request.")
    }

    seenItemCodes.add(normalizedItemCode)
  }
}

const isConflictError = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

const revalidatePurchaseRequestPaths = (companyId: string): void => {
  revalidatePath(`/${companyId}/employee-portal/purchase-requests`)
  revalidatePath(`/${companyId}/employee-portal/purchase-orders`)
  revalidatePath(`/${companyId}/employee-portal`)
}

const ensurePurchaseRequestFeatureEnabled = async (companyId: string): Promise<boolean> => {
  return getCompanyPurchaseRequestWorkflowEnabled(companyId)
}

type PurchaseRequesterProfile = {
  requesterEmployeeId: string | null
  requesterExternalProfileId: string | null
  branchName: string | null
}

const resolveRequesterProfile = async (params: {
  userId: string
  companyId: string
}): Promise<PurchaseRequesterProfile | null> => {
  const [employee, externalRequesterProfile] = await Promise.all([
    db.employee.findFirst({
      where: {
        userId: params.userId,
        companyId: params.companyId,
        deletedAt: null,
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
    db.externalRequesterProfile.findFirst({
      where: {
        userId: params.userId,
        companyId: params.companyId,
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
  ])

  if (employee) {
    return {
      requesterEmployeeId: employee.id,
      requesterExternalProfileId: null,
      branchName: employee.branch?.name?.trim() || null,
    }
  }

  if (externalRequesterProfile) {
    return {
      requesterEmployeeId: null,
      requesterExternalProfileId: externalRequesterProfile.id,
      branchName: externalRequesterProfile.branch?.name?.trim() || null,
    }
  }

  return null
}

const ensurePurchaseRequestCapabilityAccess = async (params: {
  companyId: string
  capability: EmployeePortalCapability
  errorMessage: string
}): Promise<
  | { ok: true; context: Awaited<ReturnType<typeof getEmployeePortalCapabilityContext>>["activeCompany"] }
  | { ok: false; error: string }
> => {
  const access = await getEmployeePortalCapabilityContext(params.companyId)

  if (!hasEmployeePortalCapability(access.capabilities, params.capability)) {
    return { ok: false, error: params.errorMessage }
  }

  return {
    ok: true,
    context: access.activeCompany,
  }
}

const getPendingStepForActor = (params: {
  currentStep: number | null
  approvalCycle: number
  steps: PurchaseRequestApprovalStepRecord[]
  actorUserId: string
}): PurchaseRequestApprovalStepRecord | null => {
  if (!params.currentStep) {
    return null
  }

  return (
    params.steps.find(
      (step) =>
        step.approvalCycle === params.approvalCycle &&
        step.stepNumber === params.currentStep &&
        step.approverUserId === params.actorUserId &&
        step.status === MaterialRequestStepStatus.PENDING
    ) ?? null
  )
}

const isApproverStillEligible = async (params: {
  tx: Prisma.TransactionClient
  userId: string
  companyId: string
}): Promise<boolean> => {
  const eligibleUser = await params.tx.user.findFirst({
    where: {
      id: params.userId,
      isActive: true,
      isRequestApprover: true,
      companyAccess: {
        some: {
          companyId: params.companyId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(eligibleUser)
}

const createRequestNumberCandidate = async (
  companyId: string,
  series: CreatePurchaseRequestDraftInput["series"],
  offset: number
): Promise<string> => {
  const seriesPrefix = `PR-${series}-`
  const existingRequestNumbers = await db.purchaseRequest.findMany({
    where: {
      companyId,
      requestNumber: {
        startsWith: seriesPrefix,
      },
    },
    select: {
      requestNumber: true,
    },
  })

  const sequence =
    existingRequestNumbers.reduce((maxSequence, request) => {
      return Math.max(maxSequence, parseRequestNumberSequence(request.requestNumber))
    }, 0) +
    1 +
    offset
  return `${seriesPrefix}${String(sequence).padStart(REQUEST_NUMBER_SEQUENCE_DIGITS, "0")}`
}

export async function createPurchaseRequestDraftAction(
  input: CreatePurchaseRequestDraftInput
): Promise<ProcurementActionResult> {
  const parsed = createPurchaseRequestDraftInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase request payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.create",
    errorMessage: "You are not allowed to create purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const requesterProfile = await resolveRequesterProfile({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!requesterProfile) {
    return {
      ok: false,
      error:
        "No active requester profile found for this account in the active company. Link an employee profile or enable an external requester profile.",
    }
  }

  let itemInputs: PurchaseRequestItemInputPayload[]
  try {
    itemInputs = toItemInputPayload(payload.items)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid purchase request items."
    return { ok: false, error: message }
  }

  let items: PurchaseRequestItemPayload[]
  try {
    items = await resolveCatalogBackedItemPayload(itemInputs)
    assertUniqueItemCodes(items)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid purchase request items."
    return { ok: false, error: message }
  }

  const totals = computeTotals(items)

  const datePrepared = parsePhDateInputToUtcDateOnly(payload.datePrepared)
  const dateRequired = parsePhDateInputToUtcDateOnly(payload.dateRequired)
  if (!datePrepared || !dateRequired) {
    return { ok: false, error: "Invalid prepared/required date." }
  }

  for (let attempt = 0; attempt < REQUEST_CREATE_MAX_RETRIES; attempt += 1) {
    try {
      const requestNumber = await createRequestNumberCandidate(context.companyId, payload.series, attempt)

      const created = await db.purchaseRequest.create({
        data: {
          companyId: context.companyId,
          requestNumber,
          series: payload.series,
          requestType: payload.requestType,
          status: PurchaseRequestStatus.DRAFT,
          requesterEmployeeId: requesterProfile.requesterEmployeeId,
          requesterExternalProfileId: requesterProfile.requesterExternalProfileId,
          requesterUserId: context.userId,
          requesterBranchName: requesterProfile.branchName,
          departmentId: payload.departmentId,
          selectedInitialApproverUserId: toNullableId(payload.selectedInitialApproverUserId),
          selectedStepTwoApproverUserId: toNullableId(payload.selectedStepTwoApproverUserId),
          selectedStepThreeApproverUserId: toNullableId(payload.selectedStepThreeApproverUserId),
          selectedStepFourApproverUserId: toNullableId(payload.selectedStepFourApproverUserId),
          datePrepared,
          dateRequired,
          purpose: normalizeOptionalText(payload.purpose),
          remarks: normalizeOptionalText(payload.remarks),
          deliverTo: normalizeOptionalText(payload.deliverTo),
          isStoreUse: false,
          freight: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          subTotal: totals.subTotal,
          grandTotal: totals.grandTotal,
          items: {
            create: items.map((item, index) => ({
              lineNumber: index + 1,
              source: item.source,
              procurementItemId: item.procurementItemId,
              itemCode: item.itemCode,
              description: item.description,
              uom: item.uom,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: item.unitPrice === null ? null : new Prisma.Decimal(item.unitPrice),
              lineTotal: item.lineTotal === null ? null : new Prisma.Decimal(item.lineTotal),
              remarks: item.remarks,
            })),
          },
        },
        select: {
          id: true,
          requestNumber: true,
        },
      })

      await createAuditLog({
        tableName: "PurchaseRequest",
        recordId: created.id,
        action: "CREATE",
        userId: context.userId,
        reason: "CREATE_PURCHASE_REQUEST_DRAFT",
      })

      revalidatePurchaseRequestPaths(context.companyId)
      return { ok: true, message: `Draft ${created.requestNumber} created.`, requestId: created.id }
    } catch (error) {
      if (!isConflictError(error) || attempt === REQUEST_CREATE_MAX_RETRIES - 1) {
        const message = error instanceof Error ? error.message : "Failed to create purchase request draft."
        return { ok: false, error: message }
      }
    }
  }

  return { ok: false, error: "Failed to create purchase request draft." }
}

export async function updatePurchaseRequestDraftAction(
  input: UpdatePurchaseRequestDraftInput
): Promise<ProcurementActionResult> {
  const parsed = updatePurchaseRequestDraftInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase request payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.create",
    errorMessage: "You are not allowed to update purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      requesterUserId: context.userId,
    },
    select: {
      id: true,
      status: true,
      requestNumber: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (request.status !== PurchaseRequestStatus.DRAFT) {
    return { ok: false, error: "Only draft purchase requests can be updated." }
  }

  let itemInputs: PurchaseRequestItemInputPayload[]
  try {
    itemInputs = toItemInputPayload(payload.items)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid purchase request items."
    return { ok: false, error: message }
  }

  let items: PurchaseRequestItemPayload[]
  try {
    items = await resolveCatalogBackedItemPayload(itemInputs)
    assertUniqueItemCodes(items)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid purchase request items."
    return { ok: false, error: message }
  }

  const totals = computeTotals(items)

  const datePrepared = parsePhDateInputToUtcDateOnly(payload.datePrepared)
  const dateRequired = parsePhDateInputToUtcDateOnly(payload.dateRequired)
  if (!datePrepared || !dateRequired) {
    return { ok: false, error: "Invalid prepared/required date." }
  }

  await db.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: {
        id: request.id,
      },
      data: {
        departmentId: payload.departmentId,
        series: payload.series,
        requestType: payload.requestType,
        selectedInitialApproverUserId: toNullableId(payload.selectedInitialApproverUserId),
        selectedStepTwoApproverUserId: toNullableId(payload.selectedStepTwoApproverUserId),
        selectedStepThreeApproverUserId: toNullableId(payload.selectedStepThreeApproverUserId),
        selectedStepFourApproverUserId: toNullableId(payload.selectedStepFourApproverUserId),
        datePrepared,
        dateRequired,
        purpose: normalizeOptionalText(payload.purpose),
        remarks: normalizeOptionalText(payload.remarks),
        deliverTo: normalizeOptionalText(payload.deliverTo),
        isStoreUse: false,
        freight: new Prisma.Decimal(0),
        discount: new Prisma.Decimal(0),
        subTotal: totals.subTotal,
        grandTotal: totals.grandTotal,
        items: {
          deleteMany: {},
          create: items.map((item, index) => ({
            lineNumber: index + 1,
            source: item.source,
            procurementItemId: item.procurementItemId,
            itemCode: item.itemCode,
            description: item.description,
            uom: item.uom,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: item.unitPrice === null ? null : new Prisma.Decimal(item.unitPrice),
            lineTotal: item.lineTotal === null ? null : new Prisma.Decimal(item.lineTotal),
            remarks: item.remarks,
          })),
        },
      },
    })

    await createAuditLog(
      {
        tableName: "PurchaseRequest",
        recordId: request.id,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_PURCHASE_REQUEST_DRAFT",
      },
      tx
    )
  })

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `Draft ${request.requestNumber} updated.` }
}

export async function submitPurchaseRequestAction(
  input: SubmitPurchaseRequestInput
): Promise<ProcurementActionResult> {
  const parsed = submitPurchaseRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submit payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.create",
    errorMessage: "You are not allowed to submit purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      requesterUserId: context.userId,
    },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      approvalCycle: true,
      departmentId: true,
      selectedInitialApproverUserId: true,
      selectedStepTwoApproverUserId: true,
      selectedStepThreeApproverUserId: true,
      selectedStepFourApproverUserId: true,
      updatedAt: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (request.status !== PurchaseRequestStatus.DRAFT) {
    return { ok: false, error: "Only draft purchase requests can be submitted." }
  }

  if (request._count.items === 0) {
    return { ok: false, error: "At least one item is required before submitting the request." }
  }

  const approvalFlow = await db.departmentMaterialRequestApprovalFlow.findFirst({
    where: {
      companyId: context.companyId,
      departmentId: request.departmentId,
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

  if (request.selectedInitialApproverUserId) {
    selectedApproverByStep.set(1, request.selectedInitialApproverUserId)
  }

  if (request.selectedStepTwoApproverUserId) {
    selectedApproverByStep.set(2, request.selectedStepTwoApproverUserId)
  }

  if (request.selectedStepThreeApproverUserId) {
    selectedApproverByStep.set(3, request.selectedStepThreeApproverUserId)
  }

  if (request.selectedStepFourApproverUserId) {
    selectedApproverByStep.set(4, request.selectedStepFourApproverUserId)
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
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const lockedRequest = await tx.purchaseRequest.findFirst({
        where: {
          id: request.id,
          companyId: context.companyId,
          requesterUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          approvalCycle: true,
          sentBackAt: true,
          sentBackAcknowledgedAt: true,
          updatedAt: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      })

      if (!lockedRequest) {
        throw new PurchaseRequestStateConflictError("Purchase request not found.")
      }

      if (lockedRequest.updatedAt.getTime() !== request.updatedAt.getTime()) {
        throw new PurchaseRequestStateConflictError(
          "The request was updated by another user. Please refresh and submit again."
        )
      }

      if (lockedRequest.status !== PurchaseRequestStatus.DRAFT) {
        throw new PurchaseRequestStateConflictError("Only draft purchase requests can be submitted.")
      }

      if (lockedRequest._count.items === 0) {
        throw new PurchaseRequestStateConflictError(
          "At least one item is required before submitting the request."
        )
      }

      const nextApprovalCycle = lockedRequest.approvalCycle + 1

      await tx.purchaseRequestApprovalStep.createMany({
        data: submissionFlowSteps.map((step) => ({
          purchaseRequestId: request.id,
          approvalCycle: nextApprovalCycle,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          approverUserId: step.approverUserId,
        })),
      })

      const submitUpdate = await tx.purchaseRequest.updateMany({
        where: {
          id: request.id,
          status: PurchaseRequestStatus.DRAFT,
          updatedAt: lockedRequest.updatedAt,
        },
        data: {
          status: PurchaseRequestStatus.PENDING_APPROVAL,
          approvalCycle: nextApprovalCycle,
          requiredSteps: approvalFlow.requiredSteps,
          currentStep: 1,
          submittedAt,
          approvedAt: null,
          rejectedAt: null,
          finalDecisionByUserId: null,
          finalDecisionRemarks: null,
          sentBackAcknowledgedAt: lockedRequest.sentBackAt
            ? (lockedRequest.sentBackAcknowledgedAt ?? submittedAt)
            : null,
          cancellationReason: null,
          cancelledAt: null,
          cancelledByUserId: null,
        },
      })

      if (submitUpdate.count !== 1) {
        throw new PurchaseRequestStateConflictError("The request state changed while submitting. Please retry.")
      }

      await createAuditLog(
        {
          tableName: "PurchaseRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "SUBMIT_PURCHASE_REQUEST",
          changes: [
            {
              fieldName: "status",
              oldValue: PurchaseRequestStatus.DRAFT,
              newValue: PurchaseRequestStatus.PENDING_APPROVAL,
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
  } catch (error) {
    if (error instanceof PurchaseRequestStateConflictError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to submit purchase request: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `${request.requestNumber} submitted for approval.` }
}

export async function cancelPurchaseRequestAction(
  input: CancelPurchaseRequestInput
): Promise<ProcurementActionResult> {
  const parsed = cancelPurchaseRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cancellation payload." }
  }

  const payload = parsed.data
  const access = await getEmployeePortalCapabilityContext(payload.companyId)
  const context = access.activeCompany

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      status: true,
      approvalCycle: true,
      requestNumber: true,
      requesterUserId: true,
      updatedAt: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  const canCancel =
    request.requesterUserId === context.userId ||
    hasEmployeePortalCapability(access.capabilities, "purchase_requests.manage_all")
  if (!canCancel) {
    return { ok: false, error: "You are not allowed to cancel this purchase request." }
  }

  if (
    request.status !== PurchaseRequestStatus.DRAFT &&
    request.status !== PurchaseRequestStatus.PENDING_APPROVAL
  ) {
    return { ok: false, error: "Only draft or pending requests can be cancelled." }
  }

  const currentCycleActedCount =
    request.status === PurchaseRequestStatus.PENDING_APPROVAL
      ? await db.purchaseRequestApprovalStep.count({
          where: {
            purchaseRequestId: request.id,
            approvalCycle: request.approvalCycle,
            status: {
              in: [MaterialRequestStepStatus.APPROVED, MaterialRequestStepStatus.REJECTED],
            },
          },
        })
      : 0

  if (request.status === PurchaseRequestStatus.PENDING_APPROVAL && currentCycleActedCount > 0) {
    return {
      ok: false,
      error: "This request already has an approval decision and can no longer be cancelled.",
    }
  }

  const cancellationReason = normalizeOptionalText(payload.reason) ?? "Cancelled by requester"
  const cancelledAt = new Date()

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const lockedRequest = await tx.purchaseRequest.findFirst({
        where: {
          id: request.id,
          companyId: context.companyId,
        },
        select: {
          id: true,
          status: true,
          approvalCycle: true,
          requesterUserId: true,
          updatedAt: true,
        },
      })

      if (!lockedRequest) {
        throw new PurchaseRequestStateConflictError("Purchase request not found.")
      }

      const lockedCanCancel =
        lockedRequest.requesterUserId === context.userId ||
        hasEmployeePortalCapability(access.capabilities, "purchase_requests.manage_all")
      if (!lockedCanCancel) {
        throw new PurchaseRequestStateConflictError("You are not allowed to cancel this purchase request.")
      }

      if (lockedRequest.updatedAt.getTime() !== request.updatedAt.getTime()) {
        throw new PurchaseRequestStateConflictError(
          "The request was updated by another user. Please refresh and try again."
        )
      }

      if (
        lockedRequest.status !== PurchaseRequestStatus.DRAFT &&
        lockedRequest.status !== PurchaseRequestStatus.PENDING_APPROVAL
      ) {
        throw new PurchaseRequestStateConflictError("Only draft or pending requests can be cancelled.")
      }

      const lockedCurrentCycleActedCount =
        lockedRequest.status === PurchaseRequestStatus.PENDING_APPROVAL
          ? await tx.purchaseRequestApprovalStep.count({
              where: {
                purchaseRequestId: lockedRequest.id,
                approvalCycle: lockedRequest.approvalCycle,
                status: {
                  in: [MaterialRequestStepStatus.APPROVED, MaterialRequestStepStatus.REJECTED],
                },
              },
            })
          : 0

      if (
        lockedRequest.status === PurchaseRequestStatus.PENDING_APPROVAL &&
        lockedCurrentCycleActedCount > 0
      ) {
        throw new PurchaseRequestStateConflictError(
          "This request already has an approval decision and can no longer be cancelled."
        )
      }

      await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          purchaseRequestId: request.id,
          approvalCycle: request.approvalCycle,
          status: MaterialRequestStepStatus.PENDING,
        },
        data: {
          status: MaterialRequestStepStatus.SKIPPED,
          actedAt: cancelledAt,
          actedByUserId: context.userId,
          remarks: "Cancelled by requester",
        },
      })

      const cancelUpdate = await tx.purchaseRequest.updateMany({
        where: {
          id: request.id,
          updatedAt: lockedRequest.updatedAt,
          status: {
            in: [PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.PENDING_APPROVAL],
          },
        },
        data: {
          status: PurchaseRequestStatus.CANCELLED,
          cancellationReason,
          cancelledAt,
          cancelledByUserId: context.userId,
        },
      })

      if (cancelUpdate.count !== 1) {
        throw new PurchaseRequestStateConflictError("The request state changed while cancelling. Please retry.")
      }
    })
  } catch (error) {
    if (error instanceof PurchaseRequestStateConflictError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to cancel purchase request: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `${request.requestNumber} cancelled.` }
}

export async function getPurchaseRequestApprovalDecisionDetailsAction(
  input: GetPurchaseRequestApprovalDecisionDetailsInput
): Promise<ProcurementActionDataResult<PurchaseRequestApprovalDecisionDetail>> {
  const parsed = getPurchaseRequestApprovalDecisionDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase request detail payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.approve",
    errorMessage: "You are not allowed to review purchase request approvals.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      status: PurchaseRequestStatus.PENDING_APPROVAL,
    },
    select: {
      id: true,
      requestNumber: true,
      approvalCycle: true,
      currentStep: true,
      requiredSteps: true,
      datePrepared: true,
      dateRequired: true,
      purpose: true,
      grandTotal: true,
      requesterUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      requesterExternalProfile: {
        select: {
          requesterCode: true,
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
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found or no longer pending approval." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: request.currentStep,
    approvalCycle: request.approvalCycle,
    steps: request.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to review this request at the current step." }
  }

  const skip = (payload.page - 1) * payload.pageSize
  const [totalItems, items] = await db.$transaction([
    db.purchaseRequestItem.count({
      where: {
        purchaseRequestId: request.id,
      },
    }),
    db.purchaseRequestItem.findMany({
      where: {
        purchaseRequestId: request.id,
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
      requesterName: request.requesterEmployee
        ? `${request.requesterEmployee.firstName} ${request.requesterEmployee.lastName}`
        : `${request.requesterUser.firstName} ${request.requesterUser.lastName}`,
      requesterEmployeeNumber: request.requesterEmployee?.employeeNumber ?? request.requesterExternalProfile?.requesterCode ?? "N/A",
      departmentName: request.department.name,
      currentStep: request.currentStep ?? 1,
      requiredSteps: request.requiredSteps,
      datePreparedLabel: toPhDateInputValue(request.datePrepared),
      dateRequiredLabel: toPhDateInputValue(request.dateRequired),
      purpose: request.purpose,
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

export async function approvePurchaseRequestAction(
  input: ApprovePurchaseRequestInput
): Promise<ProcurementActionResult> {
  const parsed = approvePurchaseRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.approve",
    errorMessage: "You are not allowed to approve purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      approvalCycle: true,
      currentStep: true,
      requiredSteps: true,
      steps: {
        select: {
          id: true,
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (request.status !== PurchaseRequestStatus.PENDING_APPROVAL) {
    return { ok: false, error: "Only pending purchase requests can be approved." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: request.currentStep,
    approvalCycle: request.approvalCycle,
    steps: request.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to approve this request at the current step." }
  }

  const actedAt = new Date()
  const remarks = normalizeOptionalText(payload.remarks)
  const isFinalStep = actorStep.stepNumber >= request.requiredSteps

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const approverStillEligible = await isApproverStillEligible({
        tx,
        userId: context.userId,
        companyId: context.companyId,
      })

      if (!approverStillEligible) {
        throw new PurchaseRequestApprovalValidationError(
          "Your request approver access is no longer active. Please contact HR."
        )
      }

      const stepUpdate = await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          id: actorStep.id,
          approvalCycle: request.approvalCycle,
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

      await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          purchaseRequestId: request.id,
          approvalCycle: request.approvalCycle,
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
        const finalizedUpdate = await tx.purchaseRequest.updateMany({
          where: {
            id: request.id,
            status: PurchaseRequestStatus.PENDING_APPROVAL,
            approvalCycle: request.approvalCycle,
            currentStep: actorStep.stepNumber,
          },
          data: {
            status: PurchaseRequestStatus.APPROVED,
            approvedAt: actedAt,
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
        const advancedUpdate = await tx.purchaseRequest.updateMany({
          where: {
            id: request.id,
            status: PurchaseRequestStatus.PENDING_APPROVAL,
            approvalCycle: request.approvalCycle,
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
          tableName: "PurchaseRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: isFinalStep ? "APPROVE_PURCHASE_REQUEST_FINAL_STEP" : "APPROVE_PURCHASE_REQUEST_STEP",
          changes: [
            {
              fieldName: "currentStep",
              oldValue: request.currentStep,
              newValue: isFinalStep ? actorStep.stepNumber : actorStep.stepNumber + 1,
            },
            {
              fieldName: "status",
              oldValue: request.status,
              newValue: isFinalStep
                ? PurchaseRequestStatus.APPROVED
                : PurchaseRequestStatus.PENDING_APPROVAL,
            },
          ],
        },
        tx
      )
    })
  } catch (error) {
    if (error instanceof PurchaseRequestApprovalValidationError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to approve purchase request: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return {
    ok: true,
    message: isFinalStep
      ? `${request.requestNumber} approved.`
      : `${actorStep.stepName?.trim() || `Step ${actorStep.stepNumber}`} approved. ${request.requestNumber} moved to next step.`,
  }
}

export async function rejectPurchaseRequestAction(
  input: RejectPurchaseRequestInput
): Promise<ProcurementActionResult> {
  const parsed = rejectPurchaseRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rejection payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.approve",
    errorMessage: "You are not allowed to reject purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      approvalCycle: true,
      currentStep: true,
      steps: {
        select: {
          id: true,
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (request.status !== PurchaseRequestStatus.PENDING_APPROVAL) {
    return { ok: false, error: "Only pending purchase requests can be rejected." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: request.currentStep,
    approvalCycle: request.approvalCycle,
    steps: request.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to reject this request at the current step." }
  }

  const actedAt = new Date()
  const remarks = payload.remarks.trim()

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const approverStillEligible = await isApproverStillEligible({
        tx,
        userId: context.userId,
        companyId: context.companyId,
      })

      if (!approverStillEligible) {
        throw new PurchaseRequestApprovalValidationError(
          "Your request approver access is no longer active. Please contact HR."
        )
      }

      const stepUpdate = await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          id: actorStep.id,
          approvalCycle: request.approvalCycle,
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

      await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          purchaseRequestId: request.id,
          approvalCycle: request.approvalCycle,
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

      const requestUpdate = await tx.purchaseRequest.updateMany({
        where: {
          id: request.id,
          status: PurchaseRequestStatus.PENDING_APPROVAL,
          approvalCycle: request.approvalCycle,
          currentStep: actorStep.stepNumber,
        },
        data: {
          status: PurchaseRequestStatus.REJECTED,
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
          tableName: "PurchaseRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "REJECT_PURCHASE_REQUEST_STEP",
          changes: [
            {
              fieldName: "status",
              oldValue: request.status,
              newValue: PurchaseRequestStatus.REJECTED,
            },
            {
              fieldName: "currentStep",
              oldValue: request.currentStep,
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
    if (error instanceof PurchaseRequestApprovalValidationError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to reject purchase request: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `${request.requestNumber} rejected.` }
}

export async function sendBackPurchaseRequestForEditAction(
  input: SendBackPurchaseRequestInput
): Promise<ProcurementActionResult> {
  const parsed = sendBackPurchaseRequestInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid send-back payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.approve",
    errorMessage: "You are not allowed to send back purchase requests for editing.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      status: true,
      requestNumber: true,
      approvalCycle: true,
      currentStep: true,
      steps: {
        select: {
          id: true,
          approvalCycle: true,
          stepNumber: true,
          stepName: true,
          approverUserId: true,
          status: true,
        },
      },
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (request.status !== PurchaseRequestStatus.PENDING_APPROVAL) {
    return { ok: false, error: "Only pending purchase requests can be sent back for editing." }
  }

  const actorStep = getPendingStepForActor({
    currentStep: request.currentStep,
    approvalCycle: request.approvalCycle,
    steps: request.steps,
    actorUserId: context.userId,
  })

  if (!actorStep) {
    return { ok: false, error: "You are not allowed to send back this request at the current step." }
  }

  const actedAt = new Date()
  const remarks = payload.remarks.trim()

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id" = ${request.id} FOR UPDATE`

      const approverStillEligible = await isApproverStillEligible({
        tx,
        userId: context.userId,
        companyId: context.companyId,
      })

      if (!approverStillEligible) {
        throw new PurchaseRequestApprovalValidationError(
          "Your request approver access is no longer active. Please contact HR."
        )
      }

      const stepUpdate = await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          id: actorStep.id,
          approvalCycle: request.approvalCycle,
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

      await tx.purchaseRequestApprovalStep.updateMany({
        where: {
          purchaseRequestId: request.id,
          approvalCycle: request.approvalCycle,
          status: MaterialRequestStepStatus.PENDING,
          id: {
            not: actorStep.id,
          },
          stepNumber: {
            gte: actorStep.stepNumber,
          },
        },
        data: {
          status: MaterialRequestStepStatus.SKIPPED,
          actedAt,
          actedByUserId: context.userId,
          remarks: "Skipped after request was sent back for editing",
        },
      })

      const requestUpdate = await tx.purchaseRequest.updateMany({
        where: {
          id: request.id,
          status: PurchaseRequestStatus.PENDING_APPROVAL,
          approvalCycle: request.approvalCycle,
          currentStep: actorStep.stepNumber,
        },
        data: {
          status: PurchaseRequestStatus.DRAFT,
          requiredSteps: 0,
          currentStep: null,
          submittedAt: null,
          approvedAt: null,
          rejectedAt: null,
          finalDecisionByUserId: context.userId,
          finalDecisionRemarks: remarks,
          sentBackAt: actedAt,
          sentBackReason: remarks,
          sentBackByUserId: context.userId,
          sentBackAcknowledgedAt: null,
          cancellationReason: null,
          cancelledAt: null,
          cancelledByUserId: null,
        },
      })

      if (requestUpdate.count !== 1) {
        throw new Error("The request state changed while sending back for edit.")
      }

      await createAuditLog(
        {
          tableName: "PurchaseRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "SEND_BACK_PURCHASE_REQUEST_FOR_EDIT",
          changes: [
            {
              fieldName: "status",
              oldValue: request.status,
              newValue: PurchaseRequestStatus.DRAFT,
            },
            {
              fieldName: "currentStep",
              oldValue: request.currentStep,
              newValue: null,
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
    if (error instanceof PurchaseRequestApprovalValidationError) {
      return { ok: false, error: error.message }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to send back purchase request for edit: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `${request.requestNumber} sent back for editing.` }
}

export async function acknowledgePurchaseRequestSendBackNoticeAction(
  input: AcknowledgePurchaseRequestSendBackInput
): Promise<ProcurementActionResult> {
  const parsed = acknowledgePurchaseRequestSendBackInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid acknowledgement payload." }
  }

  const payload = parsed.data
  const access = await ensurePurchaseRequestCapabilityAccess({
    companyId: payload.companyId,
    capability: "purchase_requests.view",
    errorMessage: "You are not allowed to view purchase requests.",
  })
  if (!access.ok) {
    return access
  }
  const context = access.context

  if (!(await ensurePurchaseRequestFeatureEnabled(context.companyId))) {
    return { ok: false, error: "Purchase Request workflow is disabled for this company." }
  }

  const request = await db.purchaseRequest.findFirst({
    where: {
      id: payload.requestId,
      companyId: context.companyId,
      requesterUserId: context.userId,
    },
    select: {
      id: true,
      requestNumber: true,
      sentBackAt: true,
      sentBackAcknowledgedAt: true,
    },
  })

  if (!request) {
    return { ok: false, error: "Purchase request not found." }
  }

  if (!request.sentBackAt) {
    return { ok: true, message: "No send-back notice to acknowledge." }
  }

  if (request.sentBackAcknowledgedAt) {
    return { ok: true, message: "Send-back notice already acknowledged." }
  }

  const acknowledgedAt = new Date()

  try {
    await db.$transaction(async (tx) => {
      const updateResult = await tx.purchaseRequest.updateMany({
        where: {
          id: request.id,
          sentBackAt: {
            not: null,
          },
          sentBackAcknowledgedAt: null,
        },
        data: {
          sentBackAcknowledgedAt: acknowledgedAt,
        },
      })

      if (updateResult.count !== 1) {
        throw new PurchaseRequestStateConflictError("Send-back notice was already acknowledged.")
      }

      await createAuditLog(
        {
          tableName: "PurchaseRequest",
          recordId: request.id,
          action: "UPDATE",
          userId: context.userId,
          reason: "ACKNOWLEDGE_PURCHASE_REQUEST_SEND_BACK_NOTICE",
          changes: [
            {
              fieldName: "sentBackAcknowledgedAt",
              oldValue: null,
              newValue: acknowledgedAt,
            },
          ],
        },
        tx
      )
    })
  } catch (error) {
    if (error instanceof PurchaseRequestStateConflictError) {
      return { ok: true, message: "Send-back notice already acknowledged." }
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to acknowledge send-back notice: ${message}` }
  }

  revalidatePurchaseRequestPaths(context.companyId)
  return { ok: true, message: `${request.requestNumber} send-back notice acknowledged.` }
}
