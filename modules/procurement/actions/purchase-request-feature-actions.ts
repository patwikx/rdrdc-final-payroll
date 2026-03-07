"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getPurchaseRequestFeatureInputSchema,
  updatePurchaseRequestFeatureInputSchema,
  type GetPurchaseRequestFeatureInput,
  type UpdatePurchaseRequestFeatureInput,
} from "@/modules/procurement/schemas/purchase-request-feature-actions-schema"
import type {
  ProcurementActionDataResult,
  ProcurementActionResult,
} from "@/modules/procurement/types/procurement-action-result"

type PurchaseRequestFeatureView = {
  enabled: boolean
}

const revalidateFeaturePaths = (companyId: string): void => {
  revalidatePath(`/${companyId}/settings/material-requests`)
  revalidatePath(`/${companyId}/employee-portal/request-settings`)
  revalidatePath(`/${companyId}/employee-portal`)
  revalidatePath(`/${companyId}/employee-portal/purchase-requests`)
  revalidatePath(`/${companyId}/employee-portal/purchase-orders`)
}

export async function getPurchaseRequestFeatureAction(
  input: GetPurchaseRequestFeatureInput
): Promise<ProcurementActionDataResult<PurchaseRequestFeatureView>> {
  const parsed = getPurchaseRequestFeatureInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feature payload." }
  }

  const context = await getActiveCompanyContext({ companyId: parsed.data.companyId })
  const company = await db.company.findUnique({
    where: {
      id: context.companyId,
    },
    select: {
      enablePurchaseRequestWorkflow: true,
    },
  })

  return {
    ok: true,
    data: {
      enabled: company?.enablePurchaseRequestWorkflow ?? false,
    },
  }
}

export async function updatePurchaseRequestFeatureAction(
  input: UpdatePurchaseRequestFeatureInput
): Promise<ProcurementActionResult> {
  const parsed = updatePurchaseRequestFeatureInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feature payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole

  if (!hasModuleAccess(companyRole, "settings")) {
    return { ok: false, error: "You do not have access to update procurement workflow settings." }
  }

  const existing = await db.company.findUnique({
    where: {
      id: context.companyId,
    },
    select: {
      enablePurchaseRequestWorkflow: true,
    },
  })

  if (!existing) {
    return { ok: false, error: "Company not found." }
  }

  if (existing.enablePurchaseRequestWorkflow === payload.enabled) {
    return {
      ok: true,
      message: payload.enabled
        ? "Purchase Request → Purchase Order workflow is already enabled."
        : "Purchase Request → Purchase Order workflow is already disabled.",
    }
  }

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: {
        id: context.companyId,
      },
      data: {
        enablePurchaseRequestWorkflow: payload.enabled,
      },
    })

    await createAuditLog(
      {
        tableName: "Company",
        recordId: context.companyId,
        action: "UPDATE",
        userId: context.userId,
        reason: "UPDATE_PURCHASE_REQUEST_WORKFLOW_FEATURE",
        changes: [
          {
            fieldName: "enablePurchaseRequestWorkflow",
            oldValue: existing.enablePurchaseRequestWorkflow,
            newValue: payload.enabled,
          },
        ],
      },
      tx
    )
  })

  revalidateFeaturePaths(context.companyId)

  return {
    ok: true,
    message: payload.enabled
      ? "Purchase Request → Purchase Order workflow enabled for this company."
      : "Purchase Request → Purchase Order workflow disabled for this company.",
  }
}
