"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  deleteDepartmentMaterialRequestApprovalFlowInputSchema,
  getDepartmentMaterialRequestApprovalFlowsInputSchema,
  upsertDepartmentMaterialRequestApprovalFlowInputSchema,
  type DeleteDepartmentMaterialRequestApprovalFlowInput,
  type GetDepartmentMaterialRequestApprovalFlowsInput,
  type UpsertDepartmentMaterialRequestApprovalFlowInput,
} from "@/modules/material-requests/schemas/department-approval-flow-actions-schema"
import type {
  MaterialRequestActionDataResult,
  MaterialRequestActionResult,
} from "@/modules/material-requests/types/material-request-action-result"

type DepartmentMaterialRequestApprovalFlowView = {
  id: string
  companyId: string
  department: {
    id: string
    code: string
    name: string
    isActive: boolean
  }
  requiredSteps: number
  isActive: boolean
  steps: Array<{
    id: string
    stepNumber: number
    stepName: string | null
    approverUserId: string
    approverName: string
    approverEmail: string
  }>
  updatedAt: Date
}

const hasMaterialApprovalFlowAccess = (companyRole: CompanyRole): boolean => {
  return hasModuleAccess(companyRole, "approval-workflows")
}

const createDepartmentFlowRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/settings/organization/departments`,
    `/${companyId}/settings/organization`,
    `/${companyId}/settings/material-requests`,
  ]
}

const revalidateDepartmentFlowPaths = (companyId: string): void => {
  for (const path of createDepartmentFlowRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

const mapDepartmentFlow = (flow: {
  id: string
  companyId: string
  requiredSteps: number
  isActive: boolean
  updatedAt: Date
  department: {
    id: string
    code: string
    name: string
    isActive: boolean
  }
  steps: Array<{
    id: string
    stepNumber: number
    stepName: string | null
    approverUserId: string
    approverUser: {
      firstName: string
      lastName: string
      email: string
    }
  }>
}): DepartmentMaterialRequestApprovalFlowView => {
  return {
    id: flow.id,
    companyId: flow.companyId,
    department: flow.department,
    requiredSteps: flow.requiredSteps,
    isActive: flow.isActive,
    steps: flow.steps
      .sort((a, b) => {
        if (a.stepNumber !== b.stepNumber) {
          return a.stepNumber - b.stepNumber
        }

        return `${a.approverUser.firstName} ${a.approverUser.lastName}`.localeCompare(
          `${b.approverUser.firstName} ${b.approverUser.lastName}`
        )
      })
      .map((step) => ({
        id: step.id,
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        approverUserId: step.approverUserId,
        approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
        approverEmail: step.approverUser.email,
      })),
    updatedAt: flow.updatedAt,
  }
}

const validateApproverAssignments = async (
  companyId: string,
  approverUserIds: string[]
): Promise<MaterialRequestActionResult> => {
  const approverUsers = await db.user.findMany({
    where: {
      id: {
        in: approverUserIds,
      },
      isActive: true,
      isRequestApprover: true,
      companyAccess: {
        some: {
          companyId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
    },
  })

  const foundUserIds = new Set(approverUsers.map((item) => item.id))
  const missingUserIds = approverUserIds.filter((id) => !foundUserIds.has(id))

  if (missingUserIds.length > 0) {
    return {
      ok: false,
      error:
        "One or more approvers are invalid. Approvers must be active request approvers with active access to this company.",
    }
  }

  return { ok: true, message: "Approver assignments validated." }
}

export async function getDepartmentMaterialRequestApprovalFlowsAction(
  input: GetDepartmentMaterialRequestApprovalFlowsInput
): Promise<MaterialRequestActionDataResult<DepartmentMaterialRequestApprovalFlowView[]>> {
  const parsed = getDepartmentMaterialRequestApprovalFlowsInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval-flow query payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (!hasMaterialApprovalFlowAccess(companyRole)) {
    return { ok: false, error: "You do not have access to manage material-request approval flows." }
  }

  const flows = await db.departmentMaterialRequestApprovalFlow.findMany({
    where: {
      companyId: context.companyId,
      ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
    },
    include: {
      department: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
      steps: {
        include: {
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
    orderBy: [
      {
        department: {
          name: "asc",
        },
      },
    ],
  })

  return {
    ok: true,
    data: flows.map(mapDepartmentFlow),
  }
}

export async function upsertDepartmentMaterialRequestApprovalFlowAction(
  input: UpsertDepartmentMaterialRequestApprovalFlowInput
): Promise<MaterialRequestActionResult> {
  const parsed = upsertDepartmentMaterialRequestApprovalFlowInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid approval-flow payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (!hasMaterialApprovalFlowAccess(companyRole)) {
    return { ok: false, error: "You do not have access to manage material-request approval flows." }
  }

  const sortedSteps = [...payload.steps].sort((a, b) => a.stepNumber - b.stepNumber)
  const approverValidation = await validateApproverAssignments(
    context.companyId,
    [...new Set(sortedSteps.map((step) => step.approverUserId))]
  )

  if (!approverValidation.ok) {
    return approverValidation
  }

  const department = await db.department.findFirst({
    where: {
      id: payload.departmentId,
      companyId: context.companyId,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  if (!department) {
    return { ok: false, error: "Department not found in the active company." }
  }

  try {
    await db.$transaction(async (tx) => {
      const existingFlow = await tx.departmentMaterialRequestApprovalFlow.findUnique({
        where: {
          departmentId: payload.departmentId,
        },
        select: {
          id: true,
          requiredSteps: true,
          isActive: true,
        },
      })

      const flow = existingFlow
        ? await tx.departmentMaterialRequestApprovalFlow.update({
            where: {
              id: existingFlow.id,
            },
            data: {
              requiredSteps: payload.requiredSteps,
              isActive: payload.isActive ?? true,
              updatedById: context.userId,
            },
            select: {
              id: true,
            },
          })
        : await tx.departmentMaterialRequestApprovalFlow.create({
            data: {
              companyId: context.companyId,
              departmentId: payload.departmentId,
              requiredSteps: payload.requiredSteps,
              isActive: payload.isActive ?? true,
              createdById: context.userId,
              updatedById: context.userId,
            },
            select: {
              id: true,
            },
          })

      await tx.departmentMaterialRequestApprovalFlowStep.deleteMany({
        where: {
          flowId: flow.id,
        },
      })

      await tx.departmentMaterialRequestApprovalFlowStep.createMany({
        data: sortedSteps.map((step) => ({
          flowId: flow.id,
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          approverUserId: step.approverUserId,
        })),
      })

      await createAuditLog(
        {
          tableName: "DepartmentMaterialRequestApprovalFlow",
          recordId: flow.id,
          action: existingFlow ? "UPDATE" : "CREATE",
          userId: context.userId,
          reason: "UPSERT_DEPARTMENT_MATERIAL_REQUEST_APPROVAL_FLOW",
          changes: [
            {
              fieldName: "departmentId",
              newValue: payload.departmentId,
            },
            {
              fieldName: "requiredSteps",
              oldValue: existingFlow?.requiredSteps,
              newValue: payload.requiredSteps,
            },
            {
              fieldName: "isActive",
              oldValue: existingFlow?.isActive,
              newValue: payload.isActive ?? true,
            },
          ],
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save department approval flow: ${message}` }
  }

  revalidateDepartmentFlowPaths(context.companyId)

  return {
    ok: true,
    message: `Material-request approval flow saved for department ${department.name}.`,
  }
}

export async function deleteDepartmentMaterialRequestApprovalFlowAction(
  input: DeleteDepartmentMaterialRequestApprovalFlowInput
): Promise<MaterialRequestActionResult> {
  const parsed = deleteDepartmentMaterialRequestApprovalFlowInputSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid delete payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (!hasMaterialApprovalFlowAccess(companyRole)) {
    return { ok: false, error: "You do not have access to manage material-request approval flows." }
  }

  const flow = await db.departmentMaterialRequestApprovalFlow.findFirst({
    where: {
      companyId: context.companyId,
      departmentId: payload.departmentId,
    },
    select: {
      id: true,
      department: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!flow) {
    return { ok: false, error: "Department approval flow not found." }
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.departmentMaterialRequestApprovalFlow.delete({
        where: {
          id: flow.id,
        },
      })

      await createAuditLog(
        {
          tableName: "DepartmentMaterialRequestApprovalFlow",
          recordId: flow.id,
          action: "DELETE",
          userId: context.userId,
          reason: "DELETE_DEPARTMENT_MATERIAL_REQUEST_APPROVAL_FLOW",
        },
        tx
      )
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to delete department approval flow: ${message}` }
  }

  revalidateDepartmentFlowPaths(context.companyId)

  return {
    ok: true,
    message: `Material-request approval flow deleted for department ${flow.department.name}.`,
  }
}
